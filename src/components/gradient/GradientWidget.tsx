import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Trash2 } from "lucide-react";

import { FloatingColorPicker } from "@/components/gradient/FloatingColorPicker";
import { RotationKnob } from "@/components/gradient/RotationKnob";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SliderInput } from "@/components/ui/slider-input";
import { Widget } from "@/components/widgets/Widget";
import { gradientLayerAdapter } from "@/effects/effect-layer";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/app";
import {
  type GradientMode,
  type GradientStop,
} from "@/store/modules/layers";

export const gradientEffectLayerAdapter = gradientLayerAdapter;

function sortStops(stops: GradientStop[]) {
  return [...stops].sort((firstStop, secondStop) => firstStop.location - secondStop.location);
}

function gradientStopToCss(stop: GradientStop) {
  const [red, green, blue] = hexToRgb(stop.color);

  return `rgb(${red} ${green} ${blue} / ${clampPercent(stop.opacity)}%) ${stop.location}%`;
}

function getGradientBackground(stops: GradientStop[]) {
  return `linear-gradient(90deg, ${sortStops(stops).map(gradientStopToCss).join(", ")})`;
}

function parseNumericInput(value: string) {
  const parsedValue = Number.parseFloat(value.replace("%", "").trim());

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function hexToRgb(color: string): [number, number, number] {
  const hexColor = color.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(hexColor)) {
    return [255, 255, 255];
  }

  return [0, 2, 4].map((offset) =>
    Number.parseInt(hexColor.slice(offset, offset + 2), 16)
  ) as [number, number, number];
}

function rgbToHex(color: [number, number, number]) {
  return `#${color.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function mix(firstValue: number, secondValue: number, amount: number) {
  return firstValue + (secondValue - firstValue) * amount;
}

function sampleStopColor(stops: GradientStop[], location: number) {
  const sortedStops = sortStops(stops);
  const firstStop = sortedStops[0];
  const lastStop = sortedStops[sortedStops.length - 1];

  if (!firstStop) {
    return "#ffffff";
  }

  if (location <= firstStop.location) {
    return firstStop.color;
  }

  if (lastStop && location >= lastStop.location) {
    return lastStop.color;
  }

  for (let stopIndex = 0; stopIndex < sortedStops.length - 1; stopIndex += 1) {
    const currentStop = sortedStops[stopIndex];
    const nextStop = sortedStops[stopIndex + 1];

    if (location < currentStop.location || location > nextStop.location) {
      continue;
    }

    const span = nextStop.location - currentStop.location;
    const localT = span <= 0 ? 0 : (location - currentStop.location) / span;
    const currentColor = hexToRgb(currentStop.color);
    const nextColor = hexToRgb(nextStop.color);

    return rgbToHex([
      mix(currentColor[0], nextColor[0], localT),
      mix(currentColor[1], nextColor[1], localT),
      mix(currentColor[2], nextColor[2], localT),
    ]);
  }

  return lastStop?.color ?? firstStop.color;
}

export function GradientWidget() {
  const gradientTrackRef = useRef<HTMLDivElement>(null);
  const activeStopDragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const stopDragListenersRef = useRef<{
    end: (event: globalThis.PointerEvent) => void;
    move: (event: globalThis.PointerEvent) => void;
  } | null>(null);
  const [focusedStopField, setFocusedStopField] = useState<"location" | "opacity" | null>(null);
  const gradient = useWorkspaceStore((state) => state.gradient);
  const addGradientStop = useWorkspaceStore((state) => state.addGradientStop);
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const removeGradientStop = useWorkspaceStore((state) => state.removeGradientStop);
  const selectGradientStop = useWorkspaceStore((state) => state.selectGradientStop);
  const setGradientMode = useWorkspaceStore((state) => state.setGradientMode);
  const setGradientRotation = useWorkspaceStore((state) => state.setGradientRotation);
  const updateGradientStop = useWorkspaceStore((state) => state.updateGradientStop);
  const selectedStop =
    gradient.stops.find((stop) => stop.id === gradient.selectedStopId) ?? gradient.stops[0];
  const gradientTrackBackground = getGradientBackground(gradient.stops);
  const canRemoveStop = gradient.stops.length > 2;
  const getLocationFromPointer = (clientX: number) => {
    const track = gradientTrackRef.current;

    if (!track) {
      return null;
    }

    const rect = track.getBoundingClientRect();
    const rawLocation = ((clientX - rect.left) / rect.width) * 100;

    return Math.round(clampPercent(rawLocation));
  };

  const updateStopFromPointer = (id: string, clientX: number) => {
    const nextLocation = getLocationFromPointer(clientX);

    if (nextLocation === null) {
      return;
    }

    updateGradientStop(id, { location: nextLocation }, { history: "skip" });
  };

  const handleGradientTrackDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    const location = getLocationFromPointer(event.clientX);

    if (
      location === null ||
      (target instanceof Element && target.closest('button[aria-label^="Gradient stop"]'))
    ) {
      return;
    }

    addGradientStop({
      color: sampleStopColor(gradient.stops, location),
      location,
      opacity: selectedStop?.opacity ?? 100,
    });
  };

  const clearStopDragListeners = () => {
    const listeners = stopDragListenersRef.current;

    if (!listeners) {
      return;
    }

    document.removeEventListener("pointermove", listeners.move);
    document.removeEventListener("pointerup", listeners.end);
    document.removeEventListener("pointercancel", listeners.end);
    stopDragListenersRef.current = null;
  };

  const handleStopPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    clearStopDragListeners();
    activeStopDragRef.current = { id, pointerId: event.pointerId };
    selectGradientStop(id);
    beginHistoryTransaction();
    updateStopFromPointer(id, event.clientX);

    const move = (nativeEvent: globalThis.PointerEvent) => {
      const activeDrag = activeStopDragRef.current;

      if (!activeDrag || activeDrag.pointerId !== nativeEvent.pointerId) {
        return;
      }

      nativeEvent.preventDefault();
      updateStopFromPointer(activeDrag.id, nativeEvent.clientX);
    };

    const end = (nativeEvent: globalThis.PointerEvent) => {
      const activeDrag = activeStopDragRef.current;

      if (!activeDrag || activeDrag.pointerId !== nativeEvent.pointerId) {
        return;
      }

      activeStopDragRef.current = null;
      clearStopDragListeners();
      commitHistoryTransaction();
    };

    stopDragListenersRef.current = { end, move };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  };

  const handleStopKeyDown = (event: KeyboardEvent<HTMLButtonElement>, stop: GradientStop) => {
    const keyLocationChange: Record<string, number> = {
      ArrowDown: -1,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: 1,
    };

    if (event.key === "Home") {
      event.preventDefault();
      selectGradientStop(stop.id);
      updateGradientStop(stop.id, { location: 0 });
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectGradientStop(stop.id);
      updateGradientStop(stop.id, { location: 100 });
      return;
    }

    const change = keyLocationChange[event.key];

    if (change === undefined) {
      return;
    }

    event.preventDefault();
    selectGradientStop(stop.id);
    updateGradientStop(stop.id, { location: stop.location + change });
  };

  const updateSelectedStopPercent = (
    field: "location" | "opacity",
    value: number,
    options?: { history?: "checkpoint" | "skip" }
  ) => {
    updateGradientStop(selectedStop.id, { [field]: value }, options);
  };

  useEffect(
    () => () => {
      clearStopDragListeners();
    },
    []
  );

  return (
    <Widget title="Gradient" contentClassName="space-y-5">
      <div className="widget-inline-fields">
        <div className="widget-field widget-field-mode">
          <span className="text-xs">Mode</span>
          <Select onValueChange={(value) => setGradientMode(value as GradientMode)} value={gradient.mode}>
            <SelectTrigger aria-label="Gradient mode" className="h-8 w-full bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-xs" value="linear">
                Linear
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="widget-field widget-field-rotation">
          <span className="text-xs">Rotation</span>
          <RotationKnob
            onChange={(rotation) => setGradientRotation(rotation, { history: "skip" })}
            onChangeEnd={commitHistoryTransaction}
            onChangeStart={beginHistoryTransaction}
            value={gradient.rotation}
          />
          <div className="relative w-12 overflow-visible">
            <Input
              aria-label="Gradient rotation"
              className="h-8 w-full overflow-visible bg-background pr-2 text-xs"
              inputMode="numeric"
              onBlur={commitHistoryTransaction}
              onChange={(event) =>
                setGradientRotation(parseNumericInput(event.target.value), { history: "skip" })
              }
              onFocus={beginHistoryTransaction}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              type="text"
              value={gradient.rotation}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-[8px] top-[8px] size-1.25 rounded-full border border-muted-foreground"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="h-10 px-3">
            <div
              ref={gradientTrackRef}
              className="relative h-full"
              onDoubleClick={handleGradientTrackDoubleClick}
            >
              <div
                className="transparent-checker absolute top-3 right-0 left-0 h-3 overflow-hidden rounded-full border"
              >
                <div className="h-full" style={{ background: gradientTrackBackground }} />
              </div>
              {sortStops(gradient.stops).map((stop) => {
                const isSelected = stop.id === selectedStop.id;

                return (
                  <button
                    aria-label={`Gradient stop ${Math.round(stop.location)}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={Math.round(stop.location)}
                    className={cn(
                      "gradient-stop-handle absolute top-2.5 size-4 -translate-x-1/2 touch-none rounded-full",
                      isSelected && "gradient-stop-handle-selected"
                    )}
                    key={stop.id}
                    onClick={() => selectGradientStop(stop.id)}
                    onKeyDown={(event) => handleStopKeyDown(event, stop)}
                    onPointerDown={(event) => handleStopPointerDown(event, stop.id)}
                    role="slider"
                    style={{ backgroundColor: stop.color, left: `${stop.location}%` }}
                    type="button"
                  />
                );
              })}
            </div>
          </div>
          <Button
            aria-label="Remove selected gradient stop"
            disabled={!canRemoveStop}
            onClick={() => removeGradientStop(selectedStop.id)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="widget-inline-fields">
        <div className="widget-field widget-field-color">
          <span className="text-xs">Color</span>
          <FloatingColorPicker
            onChange={(color) => updateGradientStop(selectedStop.id, { color }, { history: "skip" })}
            onChangeEnd={commitHistoryTransaction}
            onChangeStart={beginHistoryTransaction}
            value={selectedStop.color}
          />
        </div>
        <div className="widget-field widget-field-number">
          <span className="text-xs">Location</span>
          <SliderInput
            ariaLabel="Gradient stop location"
            onBlur={() => {
              setFocusedStopField(null);
              commitHistoryTransaction();
            }}
            onFocus={() => {
              setFocusedStopField("location");
              beginHistoryTransaction();
            }}
            onInteractionEnd={commitHistoryTransaction}
            onInteractionStart={beginHistoryTransaction}
            onPanelOpen={() => setFocusedStopField("location")}
            onValueChange={(value, options) =>
              updateSelectedStopPercent("location", value, options)
            }
            sliderAriaLabel="Gradient stop location slider"
            value={selectedStop.location}
          />
        </div>
        <div className="widget-field widget-field-number">
          <span className="text-xs">Opacity</span>
          <SliderInput
            ariaLabel="Gradient stop opacity"
            onBlur={() => {
              setFocusedStopField(null);
              commitHistoryTransaction();
            }}
            onFocus={() => {
              setFocusedStopField("opacity");
              beginHistoryTransaction();
            }}
            onInteractionEnd={commitHistoryTransaction}
            onInteractionStart={beginHistoryTransaction}
            onPanelOpen={() => setFocusedStopField("opacity")}
            onValueChange={(value, options) =>
              updateSelectedStopPercent("opacity", value, options)
            }
            sliderAriaLabel="Gradient stop opacity slider"
            value={selectedStop.opacity}
          />
        </div>
      </div>
    </Widget>
  );
}
