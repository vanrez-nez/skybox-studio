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
import { Widget } from "@/components/widgets/Widget";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/app";
import type { ImageState } from "@/store/modules/layers";

const DIALOG_PREVIEW_HEIGHT = 400;
const DIALOG_PREVIEW_WIDTH = 600;
const TRANSPARENT_PLACEHOLDER_ACTION_CLASS =
  "bg-secondary text-secondary-foreground shadow-sm hover:bg-card!";

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
  const [zoom, setZoom] = useState(1);
  const image = useWorkspaceStore((state) => state.image);
  const clearImage = useWorkspaceStore((state) => state.clearImage);
  const setImage = useWorkspaceStore((state) => state.setImage);
  const hasImage = Boolean(image.src);

  const loadImageFile = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const src = await readFileAsDataUrl(file);
    const imageElement = await getImageDimensions(src);
    const nextImage: ImageState = {
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
