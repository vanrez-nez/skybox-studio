import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export type FloatingPanelPlacement =
  | "top-left"
  | "top-center"
  | "top-right"
  | "left-center"
  | "center"
  | "right-center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type FloatingPanelOrientation = "horizontal" | "vertical";

type FloatingActionPanelProps = ComponentPropsWithoutRef<"div"> & {
  orientation?: FloatingPanelOrientation;
  placement?: FloatingPanelPlacement;
};

const placementClassName: Record<FloatingPanelPlacement, string> = {
  "top-left": "top-3 left-3",
  "top-center": "top-3 left-1/2 -translate-x-1/2",
  "top-right": "top-3 right-3",
  "left-center": "top-1/2 left-3 -translate-y-1/2",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  "right-center": "top-1/2 right-3 -translate-y-1/2",
  "bottom-left": "bottom-3 left-3",
  "bottom-center": "bottom-3 left-1/2 -translate-x-1/2",
  "bottom-right": "right-3 bottom-3",
};

const orientationClassName: Record<FloatingPanelOrientation, string> = {
  horizontal: "flex-row",
  vertical: "flex-col",
};

export function FloatingActionPanel({
  children,
  className,
  orientation = "horizontal",
  placement = "top-left",
  ...props
}: FloatingActionPanelProps) {
  return (
    <div
      className={cn(
        "absolute z-10 flex gap-1 rounded-md border bg-card p-1 shadow-sm",
        placementClassName[placement],
        orientationClassName[orientation],
        className
      )}
      role="toolbar"
      {...props}
    >
      {children}
    </div>
  );
}
