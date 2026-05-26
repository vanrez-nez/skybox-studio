import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImagePlus, Trash2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Point2Input,
  type LockConfig,
  type LockPair,
  type Point2Value,
  type PointInputChangeOptions,
} from "@/components/ui/point-input";
import { RotationField } from "@/components/ui/rotation-field";
import { Widget } from "@/components/widgets/Widget";
import {
  createImageAssetId,
  putImageAsset,
} from "@/lib/image-assets";
import { cn } from "@/lib/utils";
import {
  IMAGE_PLACEMENT_ELEVATION_LIMIT,
  placementFromPosition,
  placementFromRotation,
  placementFromScale,
  positionFromPlacement,
  rotationFromPlacement,
  scaleFromPlacement,
} from "@/runtime/image-placement-transform";
import { useWorkspaceStore } from "@/store/app";
import {
  IMAGE_PLACEMENT_TRANSACTION_SCOPE,
  type ImageState,
} from "@/store/modules/layers";

const DIALOG_PREVIEW_HEIGHT = 400;
const DIALOG_PREVIEW_WIDTH = 600;
const TRANSPARENT_PLACEHOLDER_ACTION_CLASS =
  "bg-secondary text-secondary-foreground shadow-sm hover:bg-card!";
const SCALE_LOCKS: LockConfig[] = [
  { pair: ["x", "y"], optional: true, defaultLocked: true },
];
const SCALE_LOCK_PAIR: LockPair = ["x", "y"];
const SCALE_MIN_NORMALIZED = 0.01;

function formatBytes(bytes: number) {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Image file could not be read."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Image file could not be read.")));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imageElement = new window.Image();

    imageElement.addEventListener("load", () => resolve(imageElement));
    imageElement.addEventListener("error", () => reject(new Error("Image dimensions could not be read.")));
    imageElement.src = src;
  });
}

function getImageFileFromDataTransfer(dataTransfer: DataTransfer) {
  const files = Array.from(dataTransfer.files);
  const fileFromFiles = files.find((file) => file.type.startsWith("image/"));

  if (fileFromFiles) {
    return fileFromFiles;
  }

  return Array.from(dataTransfer.items)
    .find((item) => item.type.startsWith("image/"))
    ?.getAsFile() ?? null;
}

function hasImageDragData(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.items).some((item) => item.kind === "file" && item.type.startsWith("image/"));
}

function clampPanOffset(value: number, imageSize: number, viewportSize: number) {
  const maxOffset = Math.max(0, (imageSize - viewportSize) / 2);

  return Math.min(maxOffset, Math.max(-maxOffset, value));
}

function mergeChangedPointValue(
  currentValue: Point2Value,
  nextValue: Point2Value,
  options?: PointInputChangeOptions
): Point2Value {
  const changedAxes = options?.changedAxes?.length
    ? new Set(options.changedAxes)
    : new Set(["x", "y"]);

  return {
    x: changedAxes.has("x") ? nextValue.x : currentValue.x,
    y: changedAxes.has("y") ? nextValue.y : currentValue.y,
  };
}

function isScalePairLocked(lockedPairs: LockPair[]) {
  return lockedPairs.some(([firstAxis, secondAxis]) =>
    firstAxis === SCALE_LOCK_PAIR[0] && secondAxis === SCALE_LOCK_PAIR[1]
  );
}

function preserveNormalizedScaleRatio(
  nextScale: Point2Value,
  options?: PointInputChangeOptions
): Point2Value {
  if (!options?.sourceAxis) {
    return nextScale;
  }

  if (options.sourceAxis === "x" || options.sourceAxis === "y") {
    const scale = nextScale[options.sourceAxis];

    return { x: scale, y: scale };
  }

  return nextScale;
}

function clampScaleValue(value: number) {
  return Math.max(SCALE_MIN_NORMALIZED, value);
}

function formatDegreeValue(value: number) {
  const roundedValue = Number(value.toFixed(1));

  return Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : `${roundedValue}`;
}

function formatScaleValue(value: number) {
  const roundedValue = Number(value.toFixed(2));

  return Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : `${roundedValue}`;
}

export function ImageWidget() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scaleLockedPairs, setScaleLockedPairs] = useState<LockPair[]>([SCALE_LOCK_PAIR]);
  const [zoom, setZoom] = useState(1);
  const image = useWorkspaceStore((state) => state.image);
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const clearImage = useWorkspaceStore((state) => state.clearImage);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const selectedLayerId = useWorkspaceStore((state) => state.selectedLayerId);
  const setImage = useWorkspaceStore((state) => state.setImage);
  const setImagePlacement = useWorkspaceStore((state) => state.setImagePlacement);
  const hasImage = Boolean(image.src);

  const loadImageFile = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const assetId = createImageAssetId();
    const src = URL.createObjectURL(file);

    await putImageAsset(assetId, file);
    const imageElement = await getImageDimensions(src);
    const nextImage: ImageState = {
      assetId,
      byteSize: file.size,
      fileName: file.name || "Pasted image",
      height: imageElement.naturalHeight,
      loadedAt: Date.now(),
      mimeType: file.type,
      pixels: null,
      placement: image.placement,
      src,
      width: imageElement.naturalWidth,
    };

    setImage(nextImage);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void loadImageFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const file = getImageFileFromDataTransfer(event.clipboardData);

    if (!file) {
      return;
    }

    event.preventDefault();
    void loadImageFile(file);
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!hasImageDragData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragActive(false);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasImageDragData(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    const file = getImageFileFromDataTransfer(event.dataTransfer);

    if (!file) {
      return;
    }

    event.preventDefault();
    setIsDragActive(false);
    void loadImageFile(file);
  };

  useEffect(() => {
    const handleDocumentPaste = (event: globalThis.ClipboardEvent) => {
      if (!event.clipboardData) {
        return;
      }

      const file = getImageFileFromDataTransfer(event.clipboardData);

      if (!file) {
        return;
      }

      event.preventDefault();
      void loadImageFile(file);
    };

    document.addEventListener("paste", handleDocumentPaste);

    return () => {
      document.removeEventListener("paste", handleDocumentPaste);
    };
  });

  const imageInfo = hasImage
    ? `${image.fileName || "Image"} · ${image.width} x ${image.height} · ${formatBytes(image.byteSize)}`
    : "";
  const fitScale =
    image.width > 0 && image.height > 0
      ? Math.min(DIALOG_PREVIEW_WIDTH / image.width, DIALOG_PREVIEW_HEIGHT / image.height)
      : 1;
  const previewImageWidth = image.width * fitScale * zoom;
  const previewImageHeight = image.height * fitScale * zoom;

  const clampPan = (nextPan: { x: number; y: number }) => ({
    x: clampPanOffset(nextPan.x, previewImageWidth, DIALOG_PREVIEW_WIDTH),
    y: clampPanOffset(nextPan.y, previewImageHeight, DIALOG_PREVIEW_HEIGHT),
  });
  const canEditPlacement = Boolean(hasImage && image.placement && selectedLayerId);

  const getLatestImagePlacement = () => {
    const state = useWorkspaceStore.getState();
    const layerId = selectedLayerId || state.selectedLayerId;
    const layer = state.effectLayers.find(
      (effectLayer) => effectLayer.id === layerId && effectLayer.type === "image"
    );

    if (!layer || layer.type !== "image" || !layer.params.placement) {
      return null;
    }

    return {
      layerId,
      placement: layer.params.placement,
    };
  };

  const updatePlacementPosition = (position: Point2Value, options?: PointInputChangeOptions) => {
    const latestImagePlacement = getLatestImagePlacement();

    if (!latestImagePlacement) {
      return;
    }

    const currentPosition = positionFromPlacement(latestImagePlacement.placement);
    const nextPosition = mergeChangedPointValue(currentPosition, position, options);

    setImagePlacement(
      latestImagePlacement.layerId,
      placementFromPosition(latestImagePlacement.placement, nextPosition),
      options
    );
  };

  const updatePlacementScale = (scale: Point2Value, options?: PointInputChangeOptions) => {
    const latestImagePlacement = getLatestImagePlacement();

    if (!latestImagePlacement) {
      return;
    }

    const currentScale = scaleFromPlacement(latestImagePlacement.placement);
    const mergedScale = mergeChangedPointValue(currentScale, scale, options);
    const nextScale = isScalePairLocked(scaleLockedPairs)
      ? preserveNormalizedScaleRatio(mergedScale, options)
      : mergedScale;
    const clampedScale = {
      x: clampScaleValue(nextScale.x),
      y: clampScaleValue(nextScale.y),
    };

    setImagePlacement(
      latestImagePlacement.layerId,
      placementFromScale(latestImagePlacement.placement, clampedScale),
      options
    );
  };

  const updatePlacementRotation = (
    rotation: number,
    options?: { history?: "checkpoint" | "skip" }
  ) => {
    const latestImagePlacement = getLatestImagePlacement();

    if (!latestImagePlacement) {
      return;
    }

    setImagePlacement(
      latestImagePlacement.layerId,
      placementFromRotation(latestImagePlacement.placement, rotation),
      options
    );
  };

  useEffect(() => {
    setPan((currentPan) => clampPan(currentPan));
  }, [previewImageHeight, previewImageWidth]);

  return (
    <Widget
      title="Image"
      contentClassName="flex flex-col gap-3"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        type="file"
      />

      <div
        className={cn(
          "relative flex aspect-video min-h-32 items-center justify-center overflow-hidden rounded-md border border-dashed",
          hasImage ? "transparent-checker" : "bg-background hover:bg-muted/40",
          isDragActive && "bg-muted/60"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {hasImage && image.src ? (
          <>
            <button
              aria-label="Preview image"
              className="absolute inset-0 cursor-zoom-in"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setIsDialogOpen(true);
              }}
              type="button"
            >
              <img
                alt={image.fileName || "Image layer"}
                className="size-full object-contain"
                src={image.src}
              />
            </button>
            <Button
              aria-label="Remove image"
              className={cn(
                TRANSPARENT_PLACEHOLDER_ACTION_CLASS,
                "absolute top-2 right-2 hover:text-destructive"
              )}
              onClick={(event) => {
                event.stopPropagation();
                clearImage();
              }}
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <Trash2 />
            </Button>
          </>
        ) : (
          <button
            aria-label="Load image"
            className="flex size-full flex-col items-center justify-center gap-1 px-3 text-center text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <ImagePlus aria-hidden="true" />
            <span className="text-xs text-foreground">Drop an Image or Click to load</span>
            <span className="text-[0.6875rem]">Supported: PNG, JPG, WebP, GIF, SVG</span>
          </button>
        )}
      </div>

      {canEditPlacement && image.placement ? (
        <div className="widget-point-groups">
          <Point2Input
            fields={{
              x: { label: "X", min: -180, max: 180, step: 1 },
              y: {
                label: "Y",
                min: -IMAGE_PLACEMENT_ELEVATION_LIMIT,
                max: IMAGE_PLACEMENT_ELEVATION_LIMIT,
                step: 1,
              },
            }}
            formatValue={formatDegreeValue}
            label="Position"
            layout="vertical"
            onBlur={() => commitHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onFocus={() => beginHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onInteractionEnd={() => commitHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onInteractionStart={() => beginHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onValueChange={updatePlacementPosition}
            value={positionFromPlacement(image.placement)}
          />
          <Point2Input
            fields={{
              x: { label: "X" },
              y: { label: "Y" },
            }}
            formatValue={formatScaleValue}
            label="Scale"
            layout="vertical"
            lockedPairs={scaleLockedPairs}
            locks={SCALE_LOCKS}
            min={SCALE_MIN_NORMALIZED}
            onBlur={() => commitHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onFocus={() => beginHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onInteractionEnd={() => commitHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onInteractionStart={() => beginHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onLockedPairsChange={setScaleLockedPairs}
            onValueChange={updatePlacementScale}
            step={0.1}
            value={scaleFromPlacement(image.placement)}
          />
          <RotationField
            ariaLabel="Image rotation"
            className="widget-point-group-wide"
            inputAriaLabel="Image rotation"
            label="Rotation"
            layout="stacked"
            onBlur={() => commitHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onFocus={() => beginHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onInteractionEnd={() => commitHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onInteractionStart={() => beginHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE)}
            onValueChange={updatePlacementRotation}
            sizeMode="fluid"
            value={rotationFromPlacement(image.placement)}
          />
        </div>
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-auto max-w-none gap-3 p-4 pt-12 sm:max-w-none">
          <DialogTitle className="sr-only">Image preview</DialogTitle>
          <p className="absolute top-4 left-4 max-w-[calc(100%-4rem)] truncate text-xs text-muted-foreground">
            {imageInfo}
          </p>
          <div
            className={cn(
              "transparent-checker relative flex max-h-[70vh] min-h-64 touch-none items-center justify-center overflow-hidden rounded-md border",
              isPanning ? "cursor-grabbing" : "cursor-grab"
            )}
            onPointerCancel={() => {
              panDragRef.current = null;
              setIsPanning(false);
            }}
            onPointerDown={(event) => {
              if (!image.src) {
                return;
              }

              event.currentTarget.setPointerCapture(event.pointerId);
              panDragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                x: pan.x,
                y: pan.y,
              };
              setIsPanning(true);
            }}
            onPointerMove={(event) => {
              const drag = panDragRef.current;

              if (!drag || drag.pointerId !== event.pointerId) {
                return;
              }

              setPan(
                clampPan({
                  x: drag.x + event.clientX - drag.startX,
                  y: drag.y + event.clientY - drag.startY,
                })
              );
            }}
            onPointerUp={(event) => {
              if (panDragRef.current?.pointerId === event.pointerId) {
                panDragRef.current = null;
                setIsPanning(false);
              }
            }}
            style={{
              height: DIALOG_PREVIEW_HEIGHT,
              width: DIALOG_PREVIEW_WIDTH,
            }}
          >
            <div
              className="absolute top-2 right-2 z-10 flex items-center gap-2"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Button
                aria-label="Zoom out"
                className={TRANSPARENT_PLACEHOLDER_ACTION_CLASS}
                disabled={zoom <= 0.5}
                onClick={(event) => {
                  event.stopPropagation();
                  setZoom((currentZoom) => Math.max(0.5, currentZoom - 0.25));
                }}
                size="icon-sm"
                type="button"
                variant="secondary"
              >
                <ZoomOut />
              </Button>
              <Button
                aria-label="Zoom in"
                className={TRANSPARENT_PLACEHOLDER_ACTION_CLASS}
                disabled={zoom >= 4}
                onClick={(event) => {
                  event.stopPropagation();
                  setZoom((currentZoom) => Math.min(4, currentZoom + 0.25));
                }}
                size="icon-sm"
                type="button"
                variant="secondary"
              >
                <ZoomIn />
              </Button>
            </div>
            {image.src ? (
              <img
                alt={image.fileName || "Image layer"}
                className="pointer-events-none max-h-none max-w-none object-contain select-none"
                src={image.src}
                style={{
                  height: `${previewImageHeight}px`,
                  transform: `translate(${pan.x}px, ${pan.y}px)`,
                  width: `${previewImageWidth}px`,
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Widget>
  );
}
