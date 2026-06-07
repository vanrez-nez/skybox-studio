import {
  createDefaultSpotParams,
  normalizeSpotParams,
  radiusScaleFromSpot,
  spotFromRadiusScale,
  type SkyboxSpotParams,
  type VectorTuple,
} from "@/runtime";
import type { LayersSlice } from "@/store/modules/layers";
import {
  clampMidpoint,
  clampPercent,
  clampRange,
  clampUnit,
  getHistoryPatch,
  syncSelectedSpotLayer,
  type GradientStop,
  type LayersSet,
} from "@/store/modules/layer-utils";

export type SpotColorMode = "gradient" | "light";
export type SpotLightParameterKey =
  | "brightness"
  | "coreRadius"
  | "coreSoftness"
  | "dispersion"
  | "dogSpread"
  | "dogStrength"
  | "dogStretch"
  | "glareSize"
  | "glareStrength"
  | "glowSize"
  | "glowStrength"
  | "haloInnerWidth"
  | "haloOuterWidth"
  | "haloRadius"
  | "haloStrength";

export type SpotState = Omit<SkyboxSpotParams, "colorMode" | "stops"> & {
  colorMode: SpotColorMode;
  selectedStopId: string;
  stops: GradientStop[];
};

const SPOT_LIGHT_PARAMETER_LIMITS: Record<SpotLightParameterKey, { max: number; min: number }> = {
  brightness: { min: 0, max: 4 },
  coreRadius: { min: 0.01, max: 0.7 },
  coreSoftness: { min: 0.4, max: 6 },
  dispersion: { min: 0, max: 1 },
  dogSpread: { min: 0.015, max: 0.18 },
  dogStrength: { min: 0, max: 1.8 },
  dogStretch: { min: 0, max: 0.55 },
  glareSize: { min: 0.03, max: 1.1 },
  glareStrength: { min: 0, max: 1.4 },
  glowSize: { min: 0.05, max: 1.4 },
  glowStrength: { min: 0, max: 1 },
  haloInnerWidth: { min: 0.003, max: 0.09 },
  haloOuterWidth: { min: 0.01, max: 0.24 },
  haloRadius: { min: 0.04, max: 1 },
  haloStrength: { min: 0, max: 1.4 },
};

export function createDefaultSpotState(centerDirection?: VectorTuple): SpotState {
  const defaultSpot = centerDirection
    ? normalizeSpotParams({
        ...createDefaultSpotParams(),
        centerDirection,
      })
    : createDefaultSpotParams();

  return {
    ...defaultSpot,
    selectedStopId: "spot-start",
    stops: defaultSpot.stops.map((stop, index) => ({
      ...stop,
      id: index === 0 ? "spot-start" : "spot-end",
      midpoint: stop.midpoint ?? 50,
    })),
  };
}

type SpotLayerActions = Pick<
  LayersSlice,
  | "addSpotStop"
  | "removeSpotStop"
  | "selectSpotStop"
  | "setSpotBrightness"
  | "setSpotColorMode"
  | "setSpotGlow"
  | "setSpotHalo"
  | "setSpotLightColor"
  | "setSpotLightParameter"
  | "setSpotPosition"
  | "setSpotRadiusScale"
  | "updateSpotStop"
>;

export function createSpotLayerActions(set: LayersSet): SpotLayerActions {
  return {
    addSpotStop: (stop) =>
      set((state) => {
        const nextStop = {
          ...stop,
          id: `spot-stop-${Date.now()}`,
          location: clampPercent(stop.location),
          midpoint: clampMidpoint(stop.midpoint ?? 50),
          opacity: clampPercent(stop.opacity),
        };
        const nextStops = [...state.spot.stops, nextStop];
        const sortedStops = [...nextStops].sort(
          (firstStop, secondStop) => firstStop.location - secondStop.location
        );
        const nextStopIndex = sortedStops.findIndex((sortedStop) => sortedStop.id === nextStop.id);
        const previousStopId = nextStopIndex > 0 ? sortedStops[nextStopIndex - 1].id : null;

        const spot = {
          ...state.spot,
          selectedStopId: nextStop.id,
          stops: nextStops.map((currentStop) =>
            currentStop.id === nextStop.id || currentStop.id === previousStopId
              ? { ...currentStop, midpoint: 50 }
              : currentStop
          ),
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state),
        };
      }),
    removeSpotStop: (id) =>
      set((state) => {
        if (state.spot.stops.length <= 2) {
          return state;
        }

        const sortedStopsBeforeDelete = [...state.spot.stops].sort(
          (firstStop, secondStop) => firstStop.location - secondStop.location
        );
        const deletedStopIndex = sortedStopsBeforeDelete.findIndex((stop) => stop.id === id);
        const previousStopId =
          deletedStopIndex > 0 ? sortedStopsBeforeDelete[deletedStopIndex - 1].id : null;
        const nextStops = state.spot.stops.filter((stop) => stop.id !== id);

        if (nextStops.length === state.spot.stops.length) {
          return state;
        }

        const spot = {
          ...state.spot,
          selectedStopId:
            state.spot.selectedStopId === id ? nextStops[0].id : state.spot.selectedStopId,
          stops: nextStops.map((stop) =>
            previousStopId && stop.id === previousStopId ? { ...stop, midpoint: 50 } : stop
          ),
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state),
        };
      }),
    selectSpotStop: (id) =>
      set((state) => {
        const spot = {
          ...state.spot,
          selectedStopId: id,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
        };
      }),
    setSpotColorMode: (mode) =>
      set((state) => {
        if (state.spot.colorMode === mode) {
          return state;
        }

        const spot = {
          ...state.spot,
          colorMode: mode,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state),
        };
      }),
    setSpotLightColor: (color, options) =>
      set((state) => {
        if (state.spot.lightColor === color) {
          return state;
        }

        const spot = {
          ...state.spot,
          lightColor: color,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state, options),
        };
      }),
    setSpotBrightness: (brightness, options) =>
      set((state) => {
        const nextBrightness = clampRange(brightness, 0, 10);

        if (state.spot.brightness === nextBrightness) {
          return state;
        }

        const spot = {
          ...state.spot,
          brightness: nextBrightness,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state, options),
        };
      }),
    setSpotGlow: (glow, options) =>
      set((state) => {
        const nextGlow = clampUnit(glow);

        if (state.spot.glow === nextGlow) {
          return state;
        }

        const spot = {
          ...state.spot,
          glow: nextGlow,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state, options),
        };
      }),
    setSpotHalo: (halo, options) =>
      set((state) => {
        const nextHalo = clampUnit(halo);

        if (state.spot.halo === nextHalo) {
          return state;
        }

        const spot = {
          ...state.spot,
          halo: nextHalo,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state, options),
        };
      }),
    setSpotLightParameter: (parameter, value, options) =>
      set((state) => {
        const limits = SPOT_LIGHT_PARAMETER_LIMITS[parameter];
        const nextValue = clampRange(value, limits.min, limits.max);

        if (state.spot[parameter] === nextValue) {
          return state;
        }

        const spot = {
          ...state.spot,
          [parameter]: nextValue,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state, options),
        };
      }),
    setSpotPosition: (centerDirection, options) =>
      set((state) => {
        const spot = {
          ...state.spot,
          centerDirection,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state, options),
        };
      }),
    setSpotRadiusScale: (radiusScale, options) =>
      set((state) => {
        const currentScale = radiusScaleFromSpot(state.spot);
        const nextScale = Math.max(0.01, radiusScale);

        if (currentScale === nextScale) {
          return state;
        }

        const spot = {
          ...state.spot,
          angularRadius: spotFromRadiusScale(state.spot, nextScale).angularRadius,
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state, options),
        };
      }),
    updateSpotStop: (id, update, options) =>
      set((state) => {
        const hasStop = state.spot.stops.some((stop) => stop.id === id);

        if (!hasStop) {
          return state;
        }

        const spot = {
          ...state.spot,
          stops: state.spot.stops.map((stop) =>
            stop.id === id
              ? {
                  ...stop,
                  ...update,
                  location:
                    update.location === undefined ? stop.location : clampPercent(update.location),
                  midpoint:
                    update.midpoint === undefined ? stop.midpoint : clampMidpoint(update.midpoint),
                  opacity:
                    update.opacity === undefined ? stop.opacity : clampPercent(update.opacity),
                }
              : stop
          ),
        };

        return {
          effectLayers: syncSelectedSpotLayer(state, spot),
          spot,
          ...getHistoryPatch(state, options),
        };
      }),
  };
}
