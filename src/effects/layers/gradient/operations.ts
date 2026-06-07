import { clampMidpoint, clampPercent, type GradientStop } from "@/effects/layers/primitives";
import type { GradientState } from "@/effects/layers/gradient/state";

type NewStopInput = Omit<GradientStop, "id" | "midpoint"> & { midpoint?: number };

export function addGradientStop(params: GradientState, stop: NewStopInput): GradientState {
  const nextStop = {
    ...stop,
    id: `stop-${Date.now()}`,
    location: clampPercent(stop.location),
    midpoint: clampMidpoint(stop.midpoint ?? 50),
    opacity: clampPercent(stop.opacity),
  };
  const nextStops = [...params.stops, nextStop];
  const sortedStops = [...nextStops].sort(
    (firstStop, secondStop) => firstStop.location - secondStop.location
  );
  const nextStopIndex = sortedStops.findIndex((sortedStop) => sortedStop.id === nextStop.id);
  const previousStopId = nextStopIndex > 0 ? sortedStops[nextStopIndex - 1].id : null;

  return {
    ...params,
    selectedStopId: nextStop.id,
    stops: nextStops.map((currentStop) =>
      currentStop.id === nextStop.id || currentStop.id === previousStopId
        ? { ...currentStop, midpoint: 50 }
        : currentStop
    ),
  };
}

export function removeGradientStop(params: GradientState, id: string): GradientState {
  if (params.stops.length <= 2) {
    return params;
  }

  const sortedStopsBeforeDelete = [...params.stops].sort(
    (firstStop, secondStop) => firstStop.location - secondStop.location
  );
  const deletedStopIndex = sortedStopsBeforeDelete.findIndex((stop) => stop.id === id);
  const previousStopId =
    deletedStopIndex > 0 ? sortedStopsBeforeDelete[deletedStopIndex - 1].id : null;
  const nextStops = params.stops.filter((stop) => stop.id !== id);

  if (nextStops.length === params.stops.length) {
    return params;
  }

  return {
    ...params,
    selectedStopId: params.selectedStopId === id ? nextStops[0].id : params.selectedStopId,
    stops: nextStops.map((stop) =>
      previousStopId && stop.id === previousStopId ? { ...stop, midpoint: 50 } : stop
    ),
  };
}

export function selectGradientStop(params: GradientState, id: string): GradientState {
  if (params.selectedStopId === id) {
    return params;
  }

  return { ...params, selectedStopId: id };
}

export function setGradientRotation(params: GradientState, rotation: number): GradientState {
  if (params.rotation === rotation) {
    return params;
  }

  return { ...params, rotation };
}

export function updateGradientStop(
  params: GradientState,
  id: string,
  update: Partial<Omit<GradientStop, "id">>
): GradientState {
  if (!params.stops.some((stop) => stop.id === id)) {
    return params;
  }

  return {
    ...params,
    stops: params.stops.map((stop) =>
      stop.id === id
        ? {
            ...stop,
            ...update,
            location: update.location === undefined ? stop.location : clampPercent(update.location),
            midpoint: update.midpoint === undefined ? stop.midpoint : clampMidpoint(update.midpoint),
            opacity: update.opacity === undefined ? stop.opacity : clampPercent(update.opacity),
          }
        : stop
    ),
  };
}
