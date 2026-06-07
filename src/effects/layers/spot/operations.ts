import {
  radiusScaleFromSpot,
  spotFromRadiusScale,
  type VectorTuple,
} from "@/runtime";
import {
  clampMidpoint,
  clampPercent,
  clampRange,
  type GradientStop,
} from "@/effects/layers/primitives";
import {
  SPOT_LIGHT_PARAMETER_LIMITS,
  type SpotColorMode,
  type SpotLightParameterKey,
  type SpotState,
} from "@/effects/layers/spot/state";

type NewStopInput = Omit<GradientStop, "id" | "midpoint"> & { midpoint?: number };

export function addSpotStop(params: SpotState, stop: NewStopInput): SpotState {
  const nextStop = {
    ...stop,
    id: `spot-stop-${Date.now()}`,
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

export function removeSpotStop(params: SpotState, id: string): SpotState {
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

export function selectSpotStop(params: SpotState, id: string): SpotState {
  if (params.selectedStopId === id) {
    return params;
  }

  return { ...params, selectedStopId: id };
}

export function updateSpotStop(
  params: SpotState,
  id: string,
  update: Partial<Omit<GradientStop, "id">>
): SpotState {
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

export function setSpotColorMode(params: SpotState, mode: SpotColorMode): SpotState {
  if (params.colorMode === mode) {
    return params;
  }

  return { ...params, colorMode: mode };
}

export function setSpotLightColor(params: SpotState, color: string): SpotState {
  if (params.lightColor === color) {
    return params;
  }

  return { ...params, lightColor: color };
}

export function setSpotLightParameter(
  params: SpotState,
  parameter: SpotLightParameterKey,
  value: number
): SpotState {
  const limits = SPOT_LIGHT_PARAMETER_LIMITS[parameter];
  const nextValue = clampRange(value, limits.min, limits.max);

  if (params[parameter] === nextValue) {
    return params;
  }

  return { ...params, [parameter]: nextValue };
}

export function setSpotPosition(params: SpotState, centerDirection: VectorTuple): SpotState {
  return { ...params, centerDirection };
}

export function setSpotRadiusScale(params: SpotState, radiusScale: number): SpotState {
  const currentScale = radiusScaleFromSpot(params);
  const nextScale = Math.max(0.01, radiusScale);

  if (currentScale === nextScale) {
    return params;
  }

  return {
    ...params,
    angularRadius: spotFromRadiusScale(params, nextScale).angularRadius,
  };
}
