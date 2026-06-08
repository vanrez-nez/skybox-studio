import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/primitives/button";
import { cn } from "@/lib/utils";

export const IMAGE_PREVIEW_ACTION_CLASS =
  "bg-secondary text-secondary-foreground shadow-sm hover:bg-card!";

const DEFAULT_MIN_ZOOM = 0.5;
const DEFAULT_MAX_ZOOM = 4;
const DEFAULT_ZOOM_STEP = 0.25;

export type ImagePreviewStatus = "idle" | "loading" | "ready";

type ImagePreviewProps = {
  alt?: string;
  className?: string;
  contentClassName?: string;
  controls?: boolean;
  emptyState?: ReactNode;
  maxZoom?: number;
  minZoom?: number;
  naturalHeight?: number;
  naturalWidth?: number;
  overlay?: ReactNode;
  src: string | null;
  status?: ImagePreviewStatus;
  zoomStep?: number;
};

function clampPanOffset(value: number, imageSize: number, viewportSize: number) {
  const maxOffset = Math.max(0, (imageSize - viewportSize) / 2);

  return Math.min(maxOffset, Math.max(-maxOffset, value));
}

export function ImagePreview({
  alt = "Preview",
  className,
  contentClassName,
  controls = true,
  emptyState,
  maxZoom = DEFAULT_MAX_ZOOM,
  minZoom = DEFAULT_MIN_ZOOM,
  naturalHeight = 0,
  naturalWidth = 0,
  overlay,
  src,
  status = "idle",
  zoomStep = DEFAULT_ZOOM_STEP,
}: ImagePreviewProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;

    if (!surface || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const { height, width } = entry.contentRect;

      setViewport({ height, width });
    });

    observer.observe(surface);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Reset zoom/pan whenever the source image changes.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [src]);

  const fitScale =
    naturalWidth > 0 && naturalHeight > 0 && viewport.width > 0 && viewport.height > 0
      ? Math.min(viewport.width / naturalWidth, viewport.height / naturalHeight)
      : 1;
  const imageWidth = naturalWidth * fitScale * zoom;
  const imageHeight = naturalHeight * fitScale * zoom;

  const clampPan = (nextPan: { x: number; y: number }) => ({
    x: clampPanOffset(nextPan.x, imageWidth, viewport.width),
    y: clampPanOffset(nextPan.y, imageHeight, viewport.height),
  });

  useEffect(() => {
    setPan((currentPan) => clampPan(currentPan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageHeight, imageWidth, viewport.height, viewport.width]);

  const canZoom = controls && Boolean(src) && naturalWidth > 0 && naturalHeight > 0;
  const canPan = Boolean(src) && naturalWidth > 0 && naturalHeight > 0;

  return (
    <div
      className={cn(
        "transparent-checker relative flex touch-none items-center justify-center overflow-hidden rounded-md border",
        canPan ? (isPanning ? "cursor-grabbing" : "cursor-grab") : undefined,
        className
      )}
      onPointerCancel={() => {
        panDragRef.current = null;
        setIsPanning(false);
      }}
      onPointerDown={(event) => {
        if (!canPan) {
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
      ref={surfaceRef}
    >
      {canZoom || overlay ? (
        <div
          className="absolute top-2 right-2 z-10 flex items-center gap-2"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {overlay}
          {canZoom ? (
            <>
              <Button
                aria-label="Zoom out"
                className={IMAGE_PREVIEW_ACTION_CLASS}
                disabled={zoom <= minZoom}
                onClick={(event) => {
                  event.stopPropagation();
                  setZoom((currentZoom) => Math.max(minZoom, currentZoom - zoomStep));
                }}
                size="icon-sm"
                type="button"
                variant="secondary"
              >
                <ZoomOut />
              </Button>
              <Button
                aria-label="Zoom in"
                className={IMAGE_PREVIEW_ACTION_CLASS}
                disabled={zoom >= maxZoom}
                onClick={(event) => {
                  event.stopPropagation();
                  setZoom((currentZoom) => Math.min(maxZoom, currentZoom + zoomStep));
                }}
                size="icon-sm"
                type="button"
                variant="secondary"
              >
                <ZoomIn />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {status === "loading" ? (
        <Loader2 className="animate-spin text-muted-foreground" />
      ) : src ? (
        <img
          alt={alt}
          className={cn(
            // Absolutely positioned + centered so the (zoomed) image never contributes to layout —
            // otherwise the first zoom would resize the auto-sized dialog before overflow clips it.
            "pointer-events-none absolute top-1/2 left-1/2 max-h-none max-w-none object-contain select-none",
            contentClassName
          )}
          src={src}
          style={
            imageWidth > 0 && imageHeight > 0
              ? {
                  height: `${imageHeight}px`,
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                  width: `${imageWidth}px`,
                }
              : { transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)` }
          }
        />
      ) : (
        emptyState ?? null
      )}
    </div>
  );
}
