import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WidgetVariant = "default" | "floating";

export type WidgetPosition = {
  x: number;
  y: number;
};

type WidgetProps = Omit<ComponentPropsWithoutRef<"section">, "title"> & {
  collapsed?: boolean;
  contentClassName?: string;
  defaultCollapsed?: boolean;
  floatingPosition?: WidgetPosition;
  onCollapsedChange?: (collapsed: boolean) => void;
  onFloatingDismiss?: () => void;
  title: ReactNode;
  variant?: WidgetVariant;
  viewportPadding?: number;
};

const DEFAULT_FLOATING_POSITION: WidgetPosition = { x: 12, y: 12 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function Widget({
  children,
  className,
  collapsed,
  contentClassName,
  defaultCollapsed = false,
  floatingPosition = DEFAULT_FLOATING_POSITION,
  onCollapsedChange,
  onFloatingDismiss,
  title,
  variant = "default",
  viewportPadding = 12,
  style,
  ...props
}: WidgetProps) {
  const widgetRef = useRef<HTMLElement>(null);
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [resolvedPosition, setResolvedPosition] = useState(floatingPosition);
  const isFloating = variant === "floating";
  const isCollapsed = isFloating ? false : collapsed ?? internalCollapsed;

  const setCollapsed = (nextCollapsed: boolean) => {
    if (collapsed === undefined) {
      setInternalCollapsed(nextCollapsed);
    }

    onCollapsedChange?.(nextCollapsed);
  };

  const updateFloatingPosition = useCallback(() => {
    if (!isFloating || !widgetRef.current) {
      return;
    }

    const rect = widgetRef.current.getBoundingClientRect();
    const maxX = Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding);
    const maxY = Math.max(viewportPadding, window.innerHeight - rect.height - viewportPadding);
    const nextPosition = {
      x: clamp(floatingPosition.x, viewportPadding, maxX),
      y: clamp(floatingPosition.y, viewportPadding, maxY),
    };

    setResolvedPosition((currentPosition) =>
      currentPosition.x === nextPosition.x && currentPosition.y === nextPosition.y
        ? currentPosition
        : nextPosition
    );
  }, [floatingPosition.x, floatingPosition.y, isFloating, viewportPadding]);

  useLayoutEffect(() => {
    if (!isFloating || !widgetRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateFloatingPosition);

    resizeObserver.observe(widgetRef.current);
    window.addEventListener("resize", updateFloatingPosition);
    updateFloatingPosition();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFloatingPosition);
    };
  }, [isFloating, updateFloatingPosition]);

  useEffect(() => {
    if (!isFloating || !onFloatingDismiss) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        widgetRef.current &&
        !widgetRef.current.contains(event.target)
      ) {
        onFloatingDismiss();
      }
    };

    const outsideClickListener = window.setTimeout(() => {
      document.addEventListener("click", handleDocumentClick);
    }, 0);

    return () => {
      window.clearTimeout(outsideClickListener);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [isFloating, onFloatingDismiss]);

  const widgetElement = (
    <section
      ref={widgetRef}
      className={cn(
        "overflow-hidden border bg-card text-card-foreground",
        isFloating ? "fixed z-50 rounded-md shadow-2xl" : "w-full rounded-md shadow-none",
        className
      )}
      style={
        isFloating
          ? {
              ...style,
              left: resolvedPosition.x,
              top: resolvedPosition.y,
            }
          : style
      }
      {...props}
    >
      <header
        className={cn("flex items-center gap-2 border-b px-2", isFloating ? "h-7" : "h-9")}
      >
        <div
          className={cn(
            "min-w-0 flex-1 truncate font-medium",
            isFloating ? "text-xs" : "text-sm"
          )}
        >
          {title}
        </div>
        {!isFloating ? (
          <Button
            aria-label={isCollapsed ? "Expand widget" : "Collapse widget"}
            onClick={() => setCollapsed(!isCollapsed)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            {isCollapsed ? <ChevronRight /> : <ChevronDown />}
          </Button>
        ) : null}
      </header>
      {!isCollapsed ? (
        <div className={cn("min-h-16 p-2", contentClassName)}>{children}</div>
      ) : null}
    </section>
  );

  if (isFloating && typeof document !== "undefined") {
    return createPortal(widgetElement, document.body);
  }

  return widgetElement;
}
