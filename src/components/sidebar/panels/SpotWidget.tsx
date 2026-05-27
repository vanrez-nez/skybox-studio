import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Trash2 } from "lucide-react";

import { FloatingColorPicker } from "@/components/ui/composables/FloatingColorPicker";
import { Button } from "@/components/ui/primitives/button";
import { FieldGroup } from "@/components/ui/primitives/field-group";
import { NumericDragField } from "@/components/ui/composables/numeric-drag-input";
import { Point2Input, type Point2Value, type PointInputChangeOptions } from "@/components/ui/composables/point-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { Slider } from "@/components/ui/primitives/slider";
import { SliderInput } from "@/components/ui/composables/slider-input";
import { Widget } from "./Widget";
import { cn } from "@/lib/utils";
import {
  IMAGE_PLACEMENT_ELEVATION_LIMIT,
} from "@/runtime/image-placement-transform";
import {
  positionFromSpot,
  radiusScaleFromSpot,
  spotFromPosition,
} from "@/runtime/spot-transform";
import { useWorkspaceStore } from "@/store/app";
import type {
  GradientStop,
  SpotColorMode,
  SpotLightParameterKey,
} from "@/store/modules/layers";

type SpotLightControl = {
  label: string;
  max: number;
  min: number;
  parameterKey: SpotLightParameterKey;
  step: number;
};

type SpotLightSliderProps = SpotLightControl & {
  onInteractionEnd: () => void;
  onInteractionStart: () => void;
  onValueChange: (
    parameterKey: SpotLightParameterKey,
    value: number,
    options?: { history?: "checkpoint" | "skip" }
  ) => void;
  value: number;
};

const SPOT_LIGHT_CONTROLS: Array<{ controls: SpotLightControl[]; label: string }> = [
  {
    label: "Core and glare",
    controls: [
      { parameterKey: "brightness", label: "Brightness", min: 0, max: 4, step: 0.01 },
      { parameterKey: "coreRadius", label: "Core radius", min: 0.01, max: 0.7, step: 0.001 },
      { parameterKey: "coreSoftness", label: "Core softness", min: 0.4, max: 6, step: 0.01 },
      { parameterKey: "glareSize", label: "Glare size", min: 0.03, max: 1.1, step: 0.001 },
      { parameterKey: "glareStrength", label: "Glare strength", min: 0, max: 1.4, step: 0.001 },
    ],
  },
  {
    label: "Glow",
    controls: [
      { parameterKey: "glowSize", label: "Size", min: 0.05, max: 1.4, step: 0.001 },
      { parameterKey: "glowStrength", label: "Strength", min: 0, max: 1, step: 0.001 },
    ],
  },
  {
    label: "Spectral halo",
    controls: [
      { parameterKey: "haloRadius", label: "Radius", min: 0.04, max: 1, step: 0.001 },
      { parameterKey: "haloInnerWidth", label: "Inner width", min: 0.003, max: 0.09, step: 0.001 },
      { parameterKey: "haloOuterWidth", label: "Outer width", min: 0.01, max: 0.24, step: 0.001 },
      { parameterKey: "haloStrength", label: "Strength", min: 0, max: 1.4, step: 0.001 },
      { parameterKey: "dispersion", label: "Dispersion", min: 0, max: 1, step: 0.001 },
    ],
  },
  {
    label: "Sun dogs",
    controls: [
      { parameterKey: "dogStrength", label: "Strength", min: 0, max: 1.8, step: 0.001 },
      { parameterKey: "dogSpread", label: "Spread", min: 0.015, max: 0.18, step: 0.001 },
      { parameterKey: "dogStretch", label: "Tail", min: 0, max: 0.55, step: 0.001 },
    ],
  },
];

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function clampMidpoint(value: number) {
  return Math.min(99, Math.max(1, value));
}

function sortStops(stops: GradientStop[]) {
  return [...stops].sort((firstStop, secondStop) => firstStop.location - secondStop.location);
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

function remapMidpoint(localT: number, midpoint: number) {
  if (localT <= midpoint) {
    return localT / Math.max(midpoint * 2, 0.00001);
  }

  return 0.5 + (localT - midpoint) / Math.max((1 - midpoint) * 2, 0.00001);
}

function gradientStopToCss(stop: GradientStop) {
  const [red, green, blue] = hexToRgb(stop.color);

  return `rgb(${red} ${green} ${blue} / ${clampPercent(stop.opacity)}%) ${stop.location}%`;
}

function getSegmentMidpointLocation(currentStop: GradientStop, nextStop: GradientStop) {
  const span = nextStop.location - currentStop.location;

  return currentStop.location + span * (clampMidpoint(currentStop.midpoint) / 100);
}

function getGradientBackground(stops: GradientStop[]) {
  const sortedStops = sortStops(stops);
  const entries = sortedStops.flatMap((stop, stopIndex) => {
    const nextStop = sortedStops[stopIndex + 1];

    return nextStop
      ? [gradientStopToCss(stop), `${getSegmentMidpointLocation(stop, nextStop)}%`]
      : [gradientStopToCss(stop)];
  });

  return `linear-gradient(90deg, ${entries.join(", ")})`;
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
    const midpointT = remapMidpoint(localT, clampMidpoint(currentStop.midpoint) / 100);
    const currentColor = hexToRgb(currentStop.color);
    const nextColor = hexToRgb(nextStop.color);

    return rgbToHex([
      mix(currentColor[0], nextColor[0], midpointT),
      mix(currentColor[1], nextColor[1], midpointT),
      mix(currentColor[2], nextColor[2], midpointT),
    ]);
  }

  return lastStop?.color ?? firstStop.color;
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

function formatPositionValue(value: number) {
  const roundedValue = Number(value.toFixed(1));

  return Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : `${roundedValue}`;
}

function formatUnitValue(value: number) {
  const roundedValue = Number(value.toFixed(2));

  return Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : `${roundedValue}`;
}

function SpotLightSlider({
  label,
  max,
  min,
  onInteractionEnd,
  onInteractionStart,
  onValueChange,
  parameterKey,
  step,
  value,
}: SpotLightSliderProps) {
  const isAdjustingRef = useRef(false);

  const beginAdjustment = () => {
    if (isAdjustingRef.current) {
      return;
    }

    isAdjustingRef.current = true;
    onInteractionStart();
  };

  const endAdjustment = () => {
    if (!isAdjustingRef.current) {
      return;
    }

    isAdjustingRef.current = false;
    onInteractionEnd();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground/70">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatUnitValue(value)}</span>
      </div>
      <Slider
        aria-label={`Spot ${label.toLowerCase()}`}
        max={max}
        min={min}
        onBlur={endAdjustment}
        onKeyDown={beginAdjustment}
        onPointerCancel={endAdjustment}
        onPointerDown={beginAdjustment}
        onValueChange={(nextValue) =>
          onValueChange(parameterKey, nextValue[0] ?? value, {
            history: isAdjustingRef.current ? "skip" : "checkpoint",
          })
        }
        onValueCommit={endAdjustment}
        step={step}
        value={[value]}
      />
    </div>
  );
}

export function SpotWidget() {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeMidpointDragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const activeStopDragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const midpointDragListenersRef = useRef<{
    end: (event: globalThis.PointerEvent) => void;
    move: (event: globalThis.PointerEvent) => void;
  } | null>(null);
  const stopDragListenersRef = useRef<{
    end: (event: globalThis.PointerEvent) => void;
    move: (event: globalThis.PointerEvent) => void;
  } | null>(null);
  const [focusedStopField, setFocusedStopField] = useState<"location" | "opacity" | null>(null);
  const spot = useWorkspaceStore((state) => state.spot);
  const addSpotStop = useWorkspaceStore((state) => state.addSpotStop);
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const removeSpotStop = useWorkspaceStore((state) => state.removeSpotStop);
  const selectSpotStop = useWorkspaceStore((state) => state.selectSpotStop);
  const setSpotColorMode = useWorkspaceStore((state) => state.setSpotColorMode);
  const setSpotLightColor = useWorkspaceStore((state) => state.setSpotLightColor);
  const setSpotLightParameter = useWorkspaceStore((state) => state.setSpotLightParameter);
  const setSpotPosition = useWorkspaceStore((state) => state.setSpotPosition);
  const setSpotRadiusScale = useWorkspaceStore((state) => state.setSpotRadiusScale);
  const updateSpotStop = useWorkspaceStore((state) => state.updateSpotStop);
  const selectedStop =
    spot.stops.find((stop) => stop.id === spot.selectedStopId) ?? spot.stops[0];
  const sortedStops = sortStops(spot.stops);
  const canRemoveStop = spot.stops.length > 2;
  const gradientTrackBackground = getGradientBackground(spot.stops);

  const getLocationFromPointer = (clientX: number) => {
    const track = trackRef.current;

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

    updateSpotStop(id, { location: nextLocation }, { history: "skip" });
  };

  const getMidpointFromPointer = (currentStop: GradientStop, nextStop: GradientStop, clientX: number) => {
    const location = getLocationFromPointer(clientX);
    const span = nextStop.location - currentStop.location;

    if (location === null || span <= 0) {
      return null;
    }

    return clampMidpoint(Math.round(((location - currentStop.location) / span) * 100));
  };

  const updateMidpointFromPointer = (
    currentStop: GradientStop,
    nextStop: GradientStop,
    clientX: number
  ) => {
    const midpoint = getMidpointFromPointer(currentStop, nextStop, clientX);

    if (midpoint === null) {
      return;
    }

    updateSpotStop(currentStop.id, { midpoint }, { history: "skip" });
  };

  const handleTrackDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    const location = getLocationFromPointer(event.clientX);

    if (
      location === null ||
      (target instanceof Element &&
        target.closest('button[aria-label^="Spot stop"], button[aria-label^="Spot midpoint"]'))
    ) {
      return;
    }

    addSpotStop({
      color: sampleStopColor(spot.stops, location),
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

  const clearMidpointDragListeners = () => {
    const listeners = midpointDragListenersRef.current;

    if (!listeners) {
      return;
    }

    document.removeEventListener("pointermove", listeners.move);
    document.removeEventListener("pointerup", listeners.end);
    document.removeEventListener("pointercancel", listeners.end);
    midpointDragListenersRef.current = null;
  };

  const handleStopPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    clearStopDragListeners();
    activeStopDragRef.current = { id, pointerId: event.pointerId };
    selectSpotStop(id);
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

  const handleMidpointPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    currentStop: GradientStop,
    nextStop: GradientStop
  ) => {
    event.preventDefault();
    clearMidpointDragListeners();
    activeMidpointDragRef.current = { id: currentStop.id, pointerId: event.pointerId };
    beginHistoryTransaction();
    updateMidpointFromPointer(currentStop, nextStop, event.clientX);

    const move = (nativeEvent: globalThis.PointerEvent) => {
      const activeDrag = activeMidpointDragRef.current;

      if (!activeDrag || activeDrag.pointerId !== nativeEvent.pointerId) {
        return;
      }

      const latestStops = sortStops(useWorkspaceStore.getState().spot.stops);
      const latestCurrentStop = latestStops.find((stop) => stop.id === activeDrag.id);
      const latestCurrentIndex = latestCurrentStop ? latestStops.indexOf(latestCurrentStop) : -1;
      const latestNextStop = latestCurrentIndex >= 0 ? latestStops[latestCurrentIndex + 1] : undefined;

      if (!latestCurrentStop || !latestNextStop) {
        return;
      }

      nativeEvent.preventDefault();
      updateMidpointFromPointer(latestCurrentStop, latestNextStop, nativeEvent.clientX);
    };

    const end = (nativeEvent: globalThis.PointerEvent) => {
      const activeDrag = activeMidpointDragRef.current;

      if (!activeDrag || activeDrag.pointerId !== nativeEvent.pointerId) {
        return;
      }

      activeMidpointDragRef.current = null;
      clearMidpointDragListeners();
      commitHistoryTransaction();
    };

    midpointDragListenersRef.current = { end, move };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  };

  const handleMidpointKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentStop: GradientStop
  ) => {
    const keyMidpointChange: Record<string, number> = {
      ArrowDown: -1,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: 1,
    };

    if (event.key === "Home") {
      event.preventDefault();
      updateSpotStop(currentStop.id, { midpoint: 1 });
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      updateSpotStop(currentStop.id, { midpoint: 99 });
      return;
    }

    const change = keyMidpointChange[event.key];

    if (change === undefined) {
      return;
    }

    event.preventDefault();
    updateSpotStop(currentStop.id, { midpoint: currentStop.midpoint + change });
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
      selectSpotStop(stop.id);
      updateSpotStop(stop.id, { location: 0 });
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectSpotStop(stop.id);
      updateSpotStop(stop.id, { location: 100 });
      return;
    }

    const change = keyLocationChange[event.key];

    if (change === undefined) {
      return;
    }

    event.preventDefault();
    selectSpotStop(stop.id);
    updateSpotStop(stop.id, { location: stop.location + change });
  };

  const updateSelectedStopPercent = (
    field: "location" | "opacity",
    value: number,
    options?: { history?: "checkpoint" | "skip" }
  ) => {
    updateSpotStop(selectedStop.id, { [field]: value }, options);
  };

  const updatePosition = (position: Point2Value, options?: PointInputChangeOptions) => {
    const latestSpot = useWorkspaceStore.getState().spot;
    const currentPosition = positionFromSpot(latestSpot);
    const nextPosition = mergeChangedPointValue(currentPosition, position, options);

    setSpotPosition(spotFromPosition(latestSpot, nextPosition).centerDirection, options);
  };

  useEffect(
    () => () => {
      clearStopDragListeners();
      clearMidpointDragListeners();
    },
    []
  );

  return (
    <Widget title="Spot" contentClassName="space-y-5">
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
          formatValue={formatPositionValue}
          label="Position"
          layout="vertical"
          onBlur={commitHistoryTransaction}
          onFocus={beginHistoryTransaction}
          onInteractionEnd={commitHistoryTransaction}
          onInteractionStart={beginHistoryTransaction}
          onValueChange={updatePosition}
          value={positionFromSpot(spot)}
        />
        <NumericDragField
          ariaLabel="Spot radius"
          fieldLabel="R"
          formatValue={formatUnitValue}
          label="Radius"
          min={0.01}
          onBlur={commitHistoryTransaction}
          onFocus={beginHistoryTransaction}
          onInteractionEnd={commitHistoryTransaction}
          onInteractionStart={beginHistoryTransaction}
          onValueChange={setSpotRadiusScale}
          step={0.1}
          value={radiusScaleFromSpot(spot)}
        />
      </div>

      <div className="widget-inline-fields">
        <div className="widget-field widget-field-mode">
          <span className="text-xs">Mode</span>
          <Select onValueChange={(value) => setSpotColorMode(value as SpotColorMode)} value={spot.colorMode}>
            <SelectTrigger
              aria-label="Spot color mode"
              className="w-full bg-background text-xs"
              size="xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-xs" value="gradient">
                Gradient
              </SelectItem>
              <SelectItem className="text-xs" value="light">
                Light
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {spot.colorMode === "gradient" ? (
        <>
          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="h-10 px-3">
                <div
                  ref={trackRef}
                  className="relative h-full"
                  onDoubleClick={handleTrackDoubleClick}
                >
                  <div className="transparent-checker-sm absolute top-3 right-0 left-0 h-3 overflow-hidden rounded-full border">
                    <div className="h-full" style={{ background: gradientTrackBackground }} />
                  </div>
                  {sortedStops.slice(0, -1).map((stop, stopIndex) => {
                    const nextStop = sortedStops[stopIndex + 1];
                    const midpointLocation = getSegmentMidpointLocation(stop, nextStop);

                    return (
                      <button
                        aria-label={`Spot midpoint ${Math.round(stop.location)}% to ${Math.round(nextStop.location)}%`}
                        aria-valuemax={99}
                        aria-valuemin={1}
                        aria-valuenow={Math.round(clampMidpoint(stop.midpoint))}
                        className="gradient-midpoint-handle absolute top-0 size-2 -translate-x-1/2 touch-none rotate-45"
                        key={`${stop.id}-${nextStop.id}`}
                        onKeyDown={(event) => handleMidpointKeyDown(event, stop)}
                        onPointerDown={(event) => handleMidpointPointerDown(event, stop, nextStop)}
                        role="slider"
                        style={{ left: `${midpointLocation}%` }}
                        type="button"
                      />
                    );
                  })}
                  {sortedStops.map((stop) => {
                    const isSelected = stop.id === selectedStop.id;

                    return (
                      <button
                        aria-label={`Spot stop ${Math.round(stop.location)}%`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={Math.round(stop.location)}
                        className={cn(
                          "gradient-stop-handle absolute top-2.5 size-4 -translate-x-1/2 touch-none rounded-full",
                          isSelected && "gradient-stop-handle-selected"
                        )}
                        key={stop.id}
                        onClick={() => selectSpotStop(stop.id)}
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
                aria-label="Remove selected spot stop"
                disabled={!canRemoveStop}
                onClick={() => removeSpotStop(selectedStop.id)}
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
                onChange={(color) => updateSpotStop(selectedStop.id, { color }, { history: "skip" })}
                onChangeEnd={commitHistoryTransaction}
                onChangeStart={beginHistoryTransaction}
                value={selectedStop.color}
              />
            </div>
            <div className="widget-field widget-field-number">
              <span className="text-xs">Location</span>
              <SliderInput
                ariaLabel="Spot stop location"
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
                sizeMode="fluid"
                sliderAriaLabel="Spot stop location slider"
                value={selectedStop.location}
              />
            </div>
            <div className="widget-field widget-field-number">
              <span className="text-xs">Opacity</span>
              <SliderInput
                ariaLabel="Spot stop opacity"
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
                sizeMode="fluid"
                sliderAriaLabel="Spot stop opacity slider"
                value={selectedStop.opacity}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="widget-inline-fields">
            <div className="widget-field widget-field-color">
              <span className="text-xs">Color</span>
              <FloatingColorPicker
                onChange={(color) => setSpotLightColor(color, { history: "skip" })}
                onChangeEnd={commitHistoryTransaction}
                onChangeStart={beginHistoryTransaction}
                value={spot.lightColor}
              />
            </div>
          </div>
          <div className="grid gap-1">
            {SPOT_LIGHT_CONTROLS.map((group) => (
              <FieldGroup
                collapsible
                contentClassName="grid gap-2"
                indent
                key={group.label}
                label={group.label}
              >
                {group.controls.map((control) => (
                  <SpotLightSlider
                    key={control.parameterKey}
                    label={control.label}
                    max={control.max}
                    min={control.min}
                    onInteractionEnd={commitHistoryTransaction}
                    onInteractionStart={beginHistoryTransaction}
                    onValueChange={setSpotLightParameter}
                    parameterKey={control.parameterKey}
                    step={control.step}
                    value={spot[control.parameterKey]}
                  />
                ))}
              </FieldGroup>
            ))}
          </div>
        </>
      )}
    </Widget>
  );
}
