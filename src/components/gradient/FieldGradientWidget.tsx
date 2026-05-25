import { type MouseEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { Dices, RotateCcw, Trash2 } from "lucide-react";

import { FloatingColorPicker } from "@/components/gradient/FloatingColorPicker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Widget } from "@/components/widgets/Widget";
import { fieldGradientLayerAdapter } from "@/effects/effect-layer";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/app";
import {
  type FieldGradientAnchor,
  type FieldGradientMode,
  type FieldGradientState,
} from "@/store/modules/layers";

export const fieldGradientEffectLayerAdapter = fieldGradientLayerAdapter;

type Rgb = [number, number, number];

type PreparedFieldAnchor = {
  color: Rgb;
  x: number;
  y: number;
};

type FieldSliderProps = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onChangeEnd?: () => void;
  onChangeStart?: () => void;
  step: number;
  value: number;
};

const PREVIEW_PIXEL_RATIO_LIMIT = 1;
const TWO_PI = Math.PI * 2;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function wrapUnit(value: number) {
  return ((value % 1) + 1) % 1;
}

function parseHexColor(color: string): Rgb {
  const hexColor = color.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(hexColor)) {
    return [1, 1, 1];
  }

  return [0, 2, 4].map((offset) =>
    Number.parseInt(hexColor.slice(offset, offset + 2), 16) / 255
  ) as Rgb;
}

function formatFieldValue(value: number) {
  return value.toFixed(value < 1 ? 2 : 1);
}

function sampleWarpedPoint(x: number, y: number, amplitude: number, frequency: number) {
  if (amplitude <= 0) {
    return { x: wrapUnit(x), y: wrapUnit(y) };
  }

  const safeFrequency = Math.max(0.0001, frequency);
  const scale = amplitude * 0.16;
  const nextX =
    Math.sin((y * safeFrequency + 0.23) * TWO_PI) *
    Math.cos((x * safeFrequency + 0.41) * TWO_PI);
  const nextY =
    Math.cos((x * safeFrequency + 0.17) * TWO_PI) *
    Math.sin((y * safeFrequency + 0.37) * TWO_PI);

  return {
    x: wrapUnit(x + nextX * scale),
    y: wrapUnit(y + nextY * scale),
  };
}

function wrappedAxisDistance(firstValue: number, secondValue: number) {
  const distance = Math.abs(firstValue - secondValue);

  return Math.min(distance, 1 - distance);
}

function sampleFieldColor(
  fieldGradient: FieldGradientState,
  anchors: PreparedFieldAnchor[],
  x: number,
  y: number
): Rgb {
  const point = sampleWarpedPoint(
    x,
    y,
    fieldGradient.amplitude,
    fieldGradient.frequency
  );
  let red = 0;
  let green = 0;
  let blue = 0;
  let weightSum = 0;

  anchors.forEach((anchor) => {
    const distance = Math.hypot(
      wrappedAxisDistance(point.x, anchor.x),
      wrappedAxisDistance(point.y, anchor.y)
    );
    const weight =
      fieldGradient.mode === "inverse-distance"
        ? 1 / (distance + 0.0005) ** fieldGradient.power
        : Math.exp(-(distance * distance) / (2 * (0.46 / fieldGradient.power) ** 2));
    const color = anchor.color;

    red += color[0] * weight;
    green += color[1] * weight;
    blue += color[2] * weight;
    weightSum += weight;
  });

  if (weightSum <= 0) {
    return [0, 0, 0];
  }

  return [red / weightSum, green / weightSum, blue / weightSum];
}

function drawFieldPreview(
  canvas: HTMLCanvasElement,
  fieldGradient: FieldGradientState,
  width: number,
  height: number
) {
  const context = canvas.getContext("2d");

  if (!context || width <= 0 || height <= 0) {
    return;
  }

  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }

  const imageData = context.createImageData(width, height);
  const anchors = fieldGradient.anchors.map((anchor) => ({
    color: parseHexColor(anchor.color),
    x: anchor.x,
    y: anchor.y,
  }));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = sampleFieldColor(
        fieldGradient,
        anchors,
        (x + 0.5) / width,
        (y + 0.5) / height
      );
      const imageIndex = (y * width + x) * 4;

      imageData.data[imageIndex] = Math.round(clamp(red) * 255);
      imageData.data[imageIndex + 1] = Math.round(clamp(green) * 255);
      imageData.data[imageIndex + 2] = Math.round(clamp(blue) * 255);
      imageData.data[imageIndex + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
}

function FieldSlider({
  label,
  max,
  min,
  onChange,
  onChangeEnd,
  onChangeStart,
  step,
  value,
}: FieldSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatFieldValue(value)}</span>
      </div>
      <Slider
        aria-label={label}
        max={max}
        min={min}
        onKeyDown={onChangeStart}
        onPointerDown={onChangeStart}
        onValueChange={(nextValue) => onChange(nextValue[0] ?? value)}
        onValueCommit={onChangeEnd}
        step={step}
        value={[value]}
      />
    </div>
  );
}

function getAnchorPositionFromPointer(
  event: Pick<globalThis.PointerEvent | PointerEvent | MouseEvent, "clientX" | "clientY">,
  preview: HTMLDivElement
) {
  const rect = preview.getBoundingClientRect();

  return {
    x: wrapUnit((event.clientX - rect.left) / rect.width),
    y: wrapUnit((event.clientY - rect.top) / rect.height),
  };
}

export function FieldGradientWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const activeAnchorRef = useRef<{ id: string; pointerId: number } | null>(null);
  const dragListenersRef = useRef<{
    end: (event: globalThis.PointerEvent) => void;
    move: (event: globalThis.PointerEvent) => void;
  } | null>(null);
  const [previewSize, setPreviewSize] = useState({ height: 0, width: 0 });
  const addFieldGradientAnchor = useWorkspaceStore((state) => state.addFieldGradientAnchor);
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const fieldGradient = useWorkspaceStore((state) => state.fieldGradient);
  const randomizeFieldGradient = useWorkspaceStore((state) => state.randomizeFieldGradient);
  const removeFieldGradientAnchor = useWorkspaceStore((state) => state.removeFieldGradientAnchor);
  const resetFieldGradient = useWorkspaceStore((state) => state.resetFieldGradient);
  const selectFieldGradientAnchor = useWorkspaceStore((state) => state.selectFieldGradientAnchor);
  const setFieldGradientAmplitude = useWorkspaceStore((state) => state.setFieldGradientAmplitude);
  const setFieldGradientFrequency = useWorkspaceStore((state) => state.setFieldGradientFrequency);
  const setFieldGradientMode = useWorkspaceStore((state) => state.setFieldGradientMode);
  const setFieldGradientPower = useWorkspaceStore((state) => state.setFieldGradientPower);
  const updateFieldGradientAnchor = useWorkspaceStore((state) => state.updateFieldGradientAnchor);
  const selectedAnchor =
    fieldGradient.anchors.find((anchor) => anchor.id === fieldGradient.selectedAnchorId) ??
    fieldGradient.anchors[0] ?? { color: "#ffffff", id: "field-fallback", x: 0.5, y: 0.5 };
  const canRemoveAnchor = fieldGradient.anchors.length > 1;

  const clearDragListeners = () => {
    const listeners = dragListenersRef.current;

    if (!listeners) {
      return;
    }

    document.removeEventListener("pointermove", listeners.move);
    document.removeEventListener("pointerup", listeners.end);
    document.removeEventListener("pointercancel", listeners.end);
    dragListenersRef.current = null;
  };

  const updateAnchorFromPointer = (
    id: string,
    event: Pick<globalThis.PointerEvent | PointerEvent | MouseEvent, "clientX" | "clientY">
  ) => {
    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    updateFieldGradientAnchor(id, getAnchorPositionFromPointer(event, preview), {
      history: "skip",
    });
  };

  const handlePreviewDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const preview = previewRef.current;
    const target = event.target;

    if (
      !preview ||
      (target instanceof Element && target.closest('button[aria-label^="Field anchor"]'))
    ) {
      return;
    }

    addFieldGradientAnchor({
      ...getAnchorPositionFromPointer(event, preview),
      color: selectedAnchor?.color ?? "#ffffff",
    });
  };

  const handleAnchorPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    anchor: FieldGradientAnchor
  ) => {
    event.preventDefault();
    clearDragListeners();
    activeAnchorRef.current = { id: anchor.id, pointerId: event.pointerId };
    selectFieldGradientAnchor(anchor.id);
    beginHistoryTransaction();

    const move = (nativeEvent: globalThis.PointerEvent) => {
      const activeAnchor = activeAnchorRef.current;

      if (!activeAnchor || activeAnchor.pointerId !== nativeEvent.pointerId) {
        return;
      }

      nativeEvent.preventDefault();
      updateAnchorFromPointer(activeAnchor.id, nativeEvent);
    };

    const end = (nativeEvent: globalThis.PointerEvent) => {
      const activeAnchor = activeAnchorRef.current;

      if (!activeAnchor || activeAnchor.pointerId !== nativeEvent.pointerId) {
        return;
      }

      activeAnchorRef.current = null;
      clearDragListeners();
      commitHistoryTransaction();
    };

    dragListenersRef.current = { end, move };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  };

  useEffect(() => {
    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, PREVIEW_PIXEL_RATIO_LIMIT);
      const nextWidth = Math.max(1, Math.round(entry.contentRect.width * pixelRatio));
      const nextHeight = Math.max(1, Math.round(entry.contentRect.height * pixelRatio));

      setPreviewSize((currentSize) =>
        currentSize.width === nextWidth && currentSize.height === nextHeight
          ? currentSize
          : { height: nextHeight, width: nextWidth }
      );
    });

    resizeObserver.observe(preview);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || previewSize.width <= 0 || previewSize.height <= 0) {
      return;
    }

    drawFieldPreview(canvas, fieldGradient, previewSize.width, previewSize.height);
  }, [fieldGradient, previewSize.height, previewSize.width]);

  useEffect(
    () => () => {
      clearDragListeners();
    },
    []
  );

  return (
    <Widget title="Field Gradient" contentClassName="space-y-4">
      <div
        ref={previewRef}
        className="relative aspect-[5/3] w-full overflow-hidden rounded-md border bg-background"
        onDoubleClick={handlePreviewDoubleClick}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        {fieldGradient.anchors.map((anchor) => {
          const isSelected = anchor.id === fieldGradient.selectedAnchorId;

          return (
            <button
              aria-label={`Field anchor ${anchor.id}`}
              className={cn(
                "gradient-stop-handle absolute size-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full",
                isSelected && "gradient-stop-handle-selected"
              )}
              key={anchor.id}
              onClick={() => selectFieldGradientAnchor(anchor.id)}
              onDoubleClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => handleAnchorPointerDown(event, anchor)}
              style={{
                backgroundColor: anchor.color,
                left: `${anchor.x * 100}%`,
                top: `${anchor.y * 100}%`,
              }}
              type="button"
            />
          );
        })}
      </div>

      <div className="widget-inline-fields">
        <div className="widget-field widget-field-color">
          <span className="text-xs">Color</span>
          <FloatingColorPicker
            onChange={(color) =>
              updateFieldGradientAnchor(selectedAnchor.id, { color }, { history: "skip" })
            }
            onChangeEnd={commitHistoryTransaction}
            onChangeStart={beginHistoryTransaction}
            value={selectedAnchor.color}
          />
        </div>
        <Button
          aria-label="Remove selected field anchor"
          disabled={!canRemoveAnchor}
          onClick={() => removeFieldGradientAnchor(selectedAnchor.id)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>

      <div className="widget-inline-fields">
        <div className="widget-field widget-field-mode">
          <span className="text-xs">Mode</span>
          <Select
            onValueChange={(value) => setFieldGradientMode(value as FieldGradientMode)}
            value={fieldGradient.mode}
          >
            <SelectTrigger aria-label="Field gradient mode" className="h-8 w-full bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-xs" value="inverse-distance">
                Inverse Dist
              </SelectItem>
              <SelectItem className="text-xs" value="gaussian">
                Gaussian
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FieldSlider
        label="Power p"
        max={6}
        min={0.4}
        onChange={(value) => setFieldGradientPower(value, { history: "skip" })}
        onChangeEnd={commitHistoryTransaction}
        onChangeStart={beginHistoryTransaction}
        step={0.05}
        value={fieldGradient.power}
      />
      <FieldSlider
        label="Amplitude"
        max={0.6}
        min={0}
        onChange={(value) => setFieldGradientAmplitude(value, { history: "skip" })}
        onChangeEnd={commitHistoryTransaction}
        onChangeStart={beginHistoryTransaction}
        step={0.005}
        value={fieldGradient.amplitude}
      />
      <FieldSlider
        label="Freq"
        max={4}
        min={0.3}
        onChange={(value) => setFieldGradientFrequency(value, { history: "skip" })}
        onChangeEnd={commitHistoryTransaction}
        onChangeStart={beginHistoryTransaction}
        step={0.05}
        value={fieldGradient.frequency}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={resetFieldGradient} size="sm" type="button" variant="outline">
          <RotateCcw />
          Reset
        </Button>
        <Button onClick={randomizeFieldGradient} size="sm" type="button" variant="outline">
          <Dices />
          Randomize
        </Button>
      </div>
    </Widget>
  );
}
