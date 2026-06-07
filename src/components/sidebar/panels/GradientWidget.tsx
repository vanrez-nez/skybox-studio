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
import { RotationField } from "@/components/ui/composables/rotation-field";
import { SliderInput } from "@/components/ui/composables/slider-input";
import { Widget } from "./Widget";
import {
  createDefaultGradientState,
  type GradientState,
} from "@/effects/layers/gradient/state";
import * as gradientOps from "@/effects/layers/gradient/operations";
import type { GradientStop } from "@/effects/layers/primitives";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/app";
import { useSelectedLayerParams } from "@/store/use-selected-layer";

function sortStops(stops: GradientStop[]) {
  return [...stops].sort((firstStop, secondStop) => firstStop.location - secondStop.location);
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

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function clampMidpoint(value: number) {
  return Math.min(99, Math.max(1, value));
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

export function GradientWidget() {
  const gradientTrackRef = useRef<HTMLDivElement>(null);
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
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const updateSelectedLayerParams = useWorkspaceStore((state) => state.updateSelectedLayerParams);
  const gradient = useSelectedLayerParams<GradientState>("gradient") ?? createDefaultGradientState();
  const addGradientStop = (stop: Omit<GradientStop, "id" | "midpoint"> & { midpoint?: number }) =>
    updateSelectedLayerParams((params) => gradientOps.addGradientStop(params as GradientState, stop));
  const removeGradientStop = (id: string) =>
    updateSelectedLayerParams((params) => gradientOps.removeGradientStop(params as GradientState, id));
  const selectGradientStop = (id: string) =>
    updateSelectedLayerParams(
      (params) => gradientOps.selectGradientStop(params as GradientState, id),
      { history: "skip" }
    );
  const setGradientRotation = (rotation: number) =>
    updateSelectedLayerParams((params) =>
      gradientOps.setGradientRotation(params as GradientState, rotation)
    );
  const updateGradientStop = (
    id: string,
    update: Partial<Omit<GradientStop, "id">>,
    options?: { history?: "checkpoint" | "skip" }
  ) =>
    updateSelectedLayerParams(
      (params) => gradientOps.updateGradientStop(params as GradientState, id, update),
      options
    );
  const selectedStop =
    gradient.stops.find((stop) => stop.id === gradient.selectedStopId) ?? gradient.stops[0];
  const gradientTrackBackground = getGradientBackground(gradient.stops);
  const canRemoveStop = gradient.stops.length > 2;
  const sortedStops = sortStops(gradient.stops);
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

    updateGradientStop(currentStop.id, { midpoint }, { history: "skip" });
  };

  const handleGradientTrackDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    const location = getLocationFromPointer(event.clientX);

    if (
      location === null ||
      (target instanceof Element &&
        target.closest('button[aria-label^="Gradient stop"], button[aria-label^="Gradient midpoint"]'))
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

      const latestState = useWorkspaceStore.getState();
      const latestLayer = latestState.effectLayers.find(
        (layer) => layer.id === latestState.selectedLayerId
      );
      const latestStops =
        latestLayer?.type === "gradient"
          ? sortStops((latestLayer.params as GradientState).stops)
          : [];
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
      updateGradientStop(currentStop.id, { midpoint: 1 });
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      updateGradientStop(currentStop.id, { midpoint: 99 });
      return;
    }

    const change = keyMidpointChange[event.key];

    if (change === undefined) {
      return;
    }

    event.preventDefault();
    updateGradientStop(currentStop.id, { midpoint: currentStop.midpoint + change });
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
      clearMidpointDragListeners();
    },
    []
  );

  return (
    <Widget title="Gradient" contentClassName="space-y-5">
      <div className="widget-inline-fields">
        <RotationField
          ariaLabel="Gradient rotation"
          inputAriaLabel="Gradient rotation"
          label="Rotation"
          onBlur={() => commitHistoryTransaction()}
          onFocus={() => beginHistoryTransaction()}
          onInteractionEnd={commitHistoryTransaction}
          onInteractionStart={beginHistoryTransaction}
          onValueChange={setGradientRotation}
          value={gradient.rotation}
        />
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
                className="transparent-checker-sm absolute top-3 right-0 left-0 h-3 overflow-hidden rounded-full border"
              >
                <div className="h-full" style={{ background: gradientTrackBackground }} />
              </div>
              {sortedStops.slice(0, -1).map((stop, stopIndex) => {
                const nextStop = sortedStops[stopIndex + 1];
                const midpointLocation = getSegmentMidpointLocation(stop, nextStop);

                return (
                  <button
                    aria-label={`Gradient midpoint ${Math.round(stop.location)}% to ${Math.round(nextStop.location)}%`}
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
            sizeMode="fluid"
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
            sizeMode="fluid"
            sliderAriaLabel="Gradient stop opacity slider"
            value={selectedStop.opacity}
          />
        </div>
      </div>
    </Widget>
  );
}
