import type { LayersSlice } from "@/store/modules/layers";
import {
  clampMidpoint,
  clampPercent,
  getHistoryPatch,
  syncSelectedGradientLayer,
  type GradientStop,
  type LayersSet,
} from "@/store/modules/layer-utils";

export type GradientMode = "linear";

export type GradientState = {
  mode: GradientMode;
  rotation: number;
  selectedStopId: string;
  stops: GradientStop[];
};

const defaultGradientStops: GradientStop[] = [
  { id: "start", color: "#00ff00", location: 0, midpoint: 50, opacity: 100 },
  { id: "end", color: "#00ff00", location: 100, midpoint: 50, opacity: 100 },
];

export function createDefaultGradientState(): GradientState {
  return {
    mode: "linear",
    rotation: 0,
    selectedStopId: "start",
    stops: defaultGradientStops.map((stop) => ({ ...stop })),
  };
}

type GradientLayerActions = Pick<
  LayersSlice,
  | "addGradientStop"
  | "removeGradientStop"
  | "selectGradientStop"
  | "setGradientMode"
  | "setGradientRotation"
  | "updateGradientStop"
>;

export function createGradientLayerActions(set: LayersSet): GradientLayerActions {
  return {
    addGradientStop: (stop) =>
      set((state) => {
        const nextStop = {
          ...stop,
          id: `stop-${Date.now()}`,
          location: clampPercent(stop.location),
          midpoint: clampMidpoint(stop.midpoint ?? 50),
          opacity: clampPercent(stop.opacity),
        };
        const nextStops = [...state.gradient.stops, nextStop];
        const sortedStops = [...nextStops].sort(
          (firstStop, secondStop) => firstStop.location - secondStop.location
        );
        const nextStopIndex = sortedStops.findIndex((sortedStop) => sortedStop.id === nextStop.id);
        const previousStopId = nextStopIndex > 0 ? sortedStops[nextStopIndex - 1].id : null;

        const gradient = {
          ...state.gradient,
          selectedStopId: nextStop.id,
          stops: nextStops.map((currentStop) =>
            currentStop.id === nextStop.id || currentStop.id === previousStopId
              ? { ...currentStop, midpoint: 50 }
              : currentStop
          ),
        };

        return {
          effectLayers: syncSelectedGradientLayer(state, gradient),
          gradient,
          ...getHistoryPatch(state),
        };
      }),
    removeGradientStop: (id) =>
      set((state) => {
        if (state.gradient.stops.length <= 2) {
          return state;
        }

        const sortedStopsBeforeDelete = [...state.gradient.stops].sort(
          (firstStop, secondStop) => firstStop.location - secondStop.location
        );
        const deletedStopIndex = sortedStopsBeforeDelete.findIndex((stop) => stop.id === id);
        const previousStopId =
          deletedStopIndex > 0 ? sortedStopsBeforeDelete[deletedStopIndex - 1].id : null;
        const nextStops = state.gradient.stops.filter((stop) => stop.id !== id);

        if (nextStops.length === state.gradient.stops.length) {
          return state;
        }

        const gradient = {
          ...state.gradient,
          selectedStopId:
            state.gradient.selectedStopId === id ? nextStops[0].id : state.gradient.selectedStopId,
          stops: nextStops.map((stop) =>
            previousStopId && stop.id === previousStopId ? { ...stop, midpoint: 50 } : stop
          ),
        };

        return {
          effectLayers: syncSelectedGradientLayer(state, gradient),
          gradient,
          ...getHistoryPatch(state),
        };
      }),
    selectGradientStop: (id) =>
      set((state) => {
        const gradient = {
          ...state.gradient,
          selectedStopId: id,
        };

        return {
          effectLayers: syncSelectedGradientLayer(state, gradient),
          gradient,
        };
      }),
    setGradientMode: (mode) =>
      set((state) => {
        if (state.gradient.mode === mode) {
          return state;
        }

        const gradient = {
          ...state.gradient,
          mode,
        };

        return {
          effectLayers: syncSelectedGradientLayer(state, gradient),
          gradient,
          ...getHistoryPatch(state),
        };
      }),
    setGradientRotation: (rotation, options) =>
      set((state) => {
        if (state.gradient.rotation === rotation) {
          return state;
        }

        const gradient = {
          ...state.gradient,
          rotation,
        };

        return {
          effectLayers: syncSelectedGradientLayer(state, gradient),
          gradient,
          ...getHistoryPatch(state, options),
        };
      }),
    updateGradientStop: (id, update, options) =>
      set((state) => {
        const hasStop = state.gradient.stops.some((stop) => stop.id === id);

        if (!hasStop) {
          return state;
        }

        const gradient = {
          ...state.gradient,
          stops: state.gradient.stops.map((stop) =>
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
          effectLayers: syncSelectedGradientLayer(state, gradient),
          gradient,
          ...getHistoryPatch(state, options),
        };
      }),
  };
}
