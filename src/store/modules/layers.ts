import type { StateCreator } from "zustand";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";

import {
  cloneFieldGradientState,
  cloneGradientState,
  type EffectLayer,
  type EffectLayerType,
  fieldGradientLayerAdapter,
  gradientLayerAdapter,
} from "@/effects/effect-layer";
import type { HistoryParticipant, WorkspaceStore } from "@/store/app";

export type GradientMode = "linear";
export type FieldGradientMode = "inverse-distance" | "gaussian";

export type GradientStop = {
  color: string;
  id: string;
  location: number;
  opacity: number;
};

export type GradientState = {
  mode: GradientMode;
  rotation: number;
  selectedStopId: string;
  stops: GradientStop[];
};

export type FieldGradientAnchor = {
  color: string;
  id: string;
  x: number;
  y: number;
};

export type FieldGradientState = {
  amplitude: number;
  anchors: FieldGradientAnchor[];
  frequency: number;
  mode: FieldGradientMode;
  power: number;
  selectedAnchorId: string;
};

export type LayersHistorySnapshot = {
  effectLayers: EffectLayer[];
  fieldGradient: FieldGradientState;
  gradient: GradientState;
  selectedLayerId: string;
};

type HistoryUpdateOptions = {
  history?: "checkpoint" | "skip";
};

export type LayersSlice = {
  effectLayers: EffectLayer[];
  fieldGradient: FieldGradientState;
  gradient: GradientState;
  selectedLayerId: string;
  addEffectLayer: (type: EffectLayerType) => void;
  addFieldGradientAnchor: (anchor: Omit<FieldGradientAnchor, "id">) => void;
  addGradientStop: (stop: Omit<GradientStop, "id">) => void;
  deleteEffectLayer: (id: string) => void;
  deleteSelectedEffectLayer: () => void;
  randomizeFieldGradient: () => void;
  removeFieldGradientAnchor: (id: string) => void;
  removeGradientStop: (id: string) => void;
  reorderEffectLayer: (sourceId: string, targetId: string, closestEdgeOfTarget: Edge | null) => void;
  renameEffectLayer: (id: string, name: string) => void;
  resetFieldGradient: () => void;
  selectEffectLayer: (id: string) => void;
  selectFieldGradientAnchor: (id: string) => void;
  selectGradientStop: (id: string) => void;
  setEffectLayerOpacity: (id: string, opacity: number, options?: HistoryUpdateOptions) => void;
  setFieldGradientAmplitude: (amplitude: number, options?: HistoryUpdateOptions) => void;
  setFieldGradientFrequency: (frequency: number, options?: HistoryUpdateOptions) => void;
  setFieldGradientMode: (mode: FieldGradientMode) => void;
  setFieldGradientPower: (power: number, options?: HistoryUpdateOptions) => void;
  setGradientMode: (mode: GradientMode) => void;
  setGradientRotation: (rotation: number, options?: HistoryUpdateOptions) => void;
  toggleEffectLayerEnabled: (id: string) => void;
  updateFieldGradientAnchor: (
    id: string,
    update: Partial<Omit<FieldGradientAnchor, "id">>,
    options?: HistoryUpdateOptions
  ) => void;
  updateGradientStop: (
    id: string,
    update: Partial<Omit<GradientStop, "id">>,
    options?: HistoryUpdateOptions
  ) => void;
};

const defaultGradientStops: GradientStop[] = [
  { id: "start", color: "#ff6a00", location: 0, opacity: 100 },
  { id: "middle", color: "#ffd000", location: 50, opacity: 100 },
  { id: "end", color: "#ff8a00", location: 100, opacity: 100 },
];

const defaultFieldGradientAnchors: FieldGradientAnchor[] = [
  { id: "cyan", color: "#35c4e0", x: 0.12, y: 0.2 },
  { id: "blue", color: "#2f80d1", x: 0.07, y: 0.52 },
  { id: "yellow", color: "#f5cc42", x: 0.6, y: 0.44 },
  { id: "orange", color: "#f08a28", x: 0.88, y: 0.78 },
];

const FIELD_GRADIENT_MAX_ANCHORS = 8;
const INITIAL_GRADIENT_LAYER_ID = "layer-gradient";
const INITIAL_FIELD_GRADIENT_LAYER_ID = "layer-field-gradient";

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function wrapUnit(value: number) {
  return ((value % 1) + 1) % 1;
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomHexColor() {
  return `#${Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  ).join("")}`;
}

function createRandomFieldAnchors(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    color: randomHexColor(),
    id: `field-${Date.now()}-${index}`,
    x: Math.random(),
    y: 0.12 + Math.random() * 0.76,
  }));
}

export function createDefaultGradientState(): GradientState {
  return {
    mode: "linear",
    rotation: 0,
    selectedStopId: "middle",
    stops: defaultGradientStops.map((stop) => ({ ...stop })),
  };
}

export function createDefaultFieldGradientState(): FieldGradientState {
  return {
    amplitude: 0.12,
    anchors: defaultFieldGradientAnchors.map((anchor) => ({ ...anchor })),
    frequency: 1.2,
    mode: "inverse-distance",
    power: 2.2,
    selectedAnchorId: "yellow",
  };
}

const initialGradient = createDefaultGradientState();
const initialFieldGradient = createDefaultFieldGradientState();
const initialEffectLayers: EffectLayer[] = [
  {
    enabled: true,
    id: INITIAL_GRADIENT_LAYER_ID,
    name: "Gradient",
    opacity: 100,
    params: cloneGradientState(initialGradient),
    type: "gradient",
  },
  {
    enabled: true,
    id: INITIAL_FIELD_GRADIENT_LAYER_ID,
    name: "Field Gradient",
    opacity: 100,
    params: cloneFieldGradientState(initialFieldGradient),
    type: "field-gradient",
  },
];

function cloneEffectLayer(layer: EffectLayer): EffectLayer {
  return layer.type === "gradient"
    ? {
        ...layer,
        params: cloneGradientState(layer.params),
      }
    : {
        ...layer,
        params: cloneFieldGradientState(layer.params),
      };
}

function captureLayersHistorySnapshot(state: LayersSlice): LayersHistorySnapshot {
  return {
    effectLayers: state.effectLayers.map(cloneEffectLayer),
    fieldGradient: cloneFieldGradientState(state.fieldGradient),
    gradient: cloneGradientState(state.gradient),
    selectedLayerId: state.selectedLayerId,
  };
}

function restoreLayersHistorySnapshot(snapshot: LayersHistorySnapshot) {
  return {
    effectLayers: snapshot.effectLayers.map(cloneEffectLayer),
    fieldGradient: cloneFieldGradientState(snapshot.fieldGradient),
    gradient: cloneGradientState(snapshot.gradient),
    selectedLayerId: snapshot.selectedLayerId,
  };
}

function getHistoryPatch(state: WorkspaceStore, options?: HistoryUpdateOptions) {
  return options?.history === "skip" ? {} : state.createHistoryCheckpoint(state);
}

function syncSelectedGradientLayer(state: LayersSlice, gradient: GradientState) {
  const selectedLayer = state.effectLayers.find((layer) => layer.id === state.selectedLayerId);

  if (selectedLayer?.type !== "gradient") {
    return state.effectLayers;
  }

  return state.effectLayers.map((layer) =>
    layer.id === selectedLayer.id && layer.type === "gradient"
      ? { ...layer, params: cloneGradientState(gradient) }
      : layer
  );
}

function syncSelectedFieldGradientLayer(
  state: LayersSlice,
  fieldGradient: FieldGradientState
) {
  const selectedLayer = state.effectLayers.find((layer) => layer.id === state.selectedLayerId);

  if (selectedLayer?.type !== "field-gradient") {
    return state.effectLayers;
  }

  return state.effectLayers.map((layer) =>
    layer.id === selectedLayer.id && layer.type === "field-gradient"
      ? { ...layer, params: cloneFieldGradientState(fieldGradient) }
      : layer
  );
}

function createEffectLayer(type: EffectLayerType, index: number): EffectLayer {
  const id = `layer-${type}-${Date.now()}-${index}`;

  return type === "gradient"
    ? {
        enabled: true,
        id,
        name: gradientLayerAdapter.getDefaultName(index),
        opacity: 100,
        params: createDefaultGradientState(),
        type,
      }
    : {
        enabled: true,
        id,
        name: fieldGradientLayerAdapter.getDefaultName(index),
        opacity: 100,
        params: createDefaultFieldGradientState(),
        type,
      };
}

export const layersHistoryParticipant: HistoryParticipant<WorkspaceStore> = {
  capture: (state) => captureLayersHistorySnapshot(state),
  id: "layers",
  restore: (snapshot) => restoreLayersHistorySnapshot(snapshot as LayersHistorySnapshot),
};

export const createLayersSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  LayersSlice
> = (set) => ({
  effectLayers: initialEffectLayers,
  fieldGradient: initialFieldGradient,
  gradient: initialGradient,
  selectedLayerId: INITIAL_GRADIENT_LAYER_ID,
  addEffectLayer: (type) =>
    set((state) => {
      const layerTypeCount = state.effectLayers.filter((layer) => layer.type === type).length + 1;
      const nextLayer = createEffectLayer(type, layerTypeCount);

      return {
        effectLayers: [...state.effectLayers, nextLayer],
        selectedLayerId: nextLayer.id,
        ...getHistoryPatch(state),
        ...(nextLayer.type === "gradient"
          ? { gradient: cloneGradientState(nextLayer.params) }
          : { fieldGradient: cloneFieldGradientState(nextLayer.params) }),
      };
    }),
  addFieldGradientAnchor: (anchor) =>
    set((state) => {
      if (state.fieldGradient.anchors.length >= FIELD_GRADIENT_MAX_ANCHORS) {
        return state;
      }

      const nextAnchor = {
        ...anchor,
        id: `field-${Date.now()}`,
        x: wrapUnit(anchor.x),
        y: wrapUnit(anchor.y),
      };

      const fieldGradient = {
        ...state.fieldGradient,
        anchors: [...state.fieldGradient.anchors, nextAnchor],
        selectedAnchorId: nextAnchor.id,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
        ...getHistoryPatch(state),
      };
    }),
  addGradientStop: (stop) =>
    set((state) => {
      const nextStop = {
        ...stop,
        id: `stop-${Date.now()}`,
        location: clampPercent(stop.location),
        opacity: clampPercent(stop.opacity),
      };

      const gradient = {
        ...state.gradient,
        selectedStopId: nextStop.id,
        stops: [...state.gradient.stops, nextStop],
      };

      return {
        effectLayers: syncSelectedGradientLayer(state, gradient),
        gradient,
        ...getHistoryPatch(state),
      };
    }),
  deleteEffectLayer: (id) =>
    set((state) => {
      const deleteIndex = state.effectLayers.findIndex((layer) => layer.id === id);

      if (deleteIndex === -1) {
        return state;
      }

      const nextLayers = state.effectLayers.filter((layer) => layer.id !== id);
      const selectedLayer =
        state.selectedLayerId === id
          ? nextLayers[Math.max(0, deleteIndex - 1)] ?? nextLayers[0]
          : nextLayers.find((layer) => layer.id === state.selectedLayerId) ?? nextLayers[0];

      if (!selectedLayer) {
        return {
          effectLayers: nextLayers,
          ...getHistoryPatch(state),
          selectedLayerId: "",
        };
      }

      return {
        effectLayers: nextLayers,
        ...getHistoryPatch(state),
        selectedLayerId: selectedLayer.id,
        ...(selectedLayer.type === "gradient"
          ? { gradient: cloneGradientState(selectedLayer.params) }
          : { fieldGradient: cloneFieldGradientState(selectedLayer.params) }),
      };
    }),
  deleteSelectedEffectLayer: () =>
    set((state) => {
      if (!state.selectedLayerId) {
        return state;
      }

      const deleteIndex = state.effectLayers.findIndex((layer) => layer.id === state.selectedLayerId);

      if (deleteIndex === -1) {
        return state;
      }

      const nextLayers = state.effectLayers.filter((layer) => layer.id !== state.selectedLayerId);
      const selectedLayer = nextLayers[Math.max(0, deleteIndex - 1)] ?? nextLayers[0];

      if (!selectedLayer) {
        return {
          effectLayers: nextLayers,
          ...getHistoryPatch(state),
          selectedLayerId: "",
        };
      }

      return {
        effectLayers: nextLayers,
        ...getHistoryPatch(state),
        selectedLayerId: selectedLayer.id,
        ...(selectedLayer.type === "gradient"
          ? { gradient: cloneGradientState(selectedLayer.params) }
          : { fieldGradient: cloneFieldGradientState(selectedLayer.params) }),
      };
    }),
  randomizeFieldGradient: () =>
    set((state) => {
      const nextAnchors = createRandomFieldAnchors(state.fieldGradient.anchors.length);
      const fieldGradient = {
        ...state.fieldGradient,
        anchors: nextAnchors,
        selectedAnchorId: nextAnchors[0].id,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
        ...getHistoryPatch(state),
      };
    }),
  removeFieldGradientAnchor: (id) =>
    set((state) => {
      if (state.fieldGradient.anchors.length <= 1) {
        return state;
      }

      const nextAnchors = state.fieldGradient.anchors.filter((anchor) => anchor.id !== id);

      if (nextAnchors.length === state.fieldGradient.anchors.length) {
        return state;
      }

      const fieldGradient = {
        ...state.fieldGradient,
        anchors: nextAnchors,
        selectedAnchorId:
          state.fieldGradient.selectedAnchorId === id
            ? nextAnchors[0].id
            : state.fieldGradient.selectedAnchorId,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
        ...getHistoryPatch(state),
      };
    }),
  removeGradientStop: (id) =>
    set((state) => {
      if (state.gradient.stops.length <= 2) {
        return state;
      }

      const nextStops = state.gradient.stops.filter((stop) => stop.id !== id);

      if (nextStops.length === state.gradient.stops.length) {
        return state;
      }

      const gradient = {
        ...state.gradient,
        selectedStopId:
          state.gradient.selectedStopId === id ? nextStops[0].id : state.gradient.selectedStopId,
        stops: nextStops,
      };

      return {
        effectLayers: syncSelectedGradientLayer(state, gradient),
        gradient,
        ...getHistoryPatch(state),
      };
    }),
  reorderEffectLayer: (sourceId, targetId, closestEdgeOfTarget) =>
    set((state) => {
      const startIndex = state.effectLayers.findIndex((layer) => layer.id === sourceId);
      const indexOfTarget = state.effectLayers.findIndex((layer) => layer.id === targetId);

      if (startIndex === -1 || indexOfTarget === -1 || startIndex === indexOfTarget) {
        return state;
      }

      return {
        effectLayers: reorderWithEdge({
          axis: "vertical",
          closestEdgeOfTarget,
          indexOfTarget,
          list: state.effectLayers,
          startIndex,
        }),
        ...getHistoryPatch(state),
      };
    }),
  renameEffectLayer: (id, name) =>
    set((state) => {
      const trimmedName = name.trim();
      const layer = state.effectLayers.find((effectLayer) => effectLayer.id === id);

      if (!layer || !trimmedName || layer.name === trimmedName) {
        return state;
      }

      return {
        effectLayers: state.effectLayers.map((layer) =>
          layer.id === id ? { ...layer, name: trimmedName } : layer
        ),
        ...getHistoryPatch(state),
      };
    }),
  resetFieldGradient: () =>
    set((state) => {
      const fieldGradient = createDefaultFieldGradientState();

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
        ...getHistoryPatch(state),
      };
    }),
  selectEffectLayer: (id) =>
    set((state) => {
      const selectedLayer = state.effectLayers.find((layer) => layer.id === id);

      if (!selectedLayer) {
        return state;
      }

      return {
        selectedLayerId: id,
        ...(selectedLayer.type === "gradient"
          ? { gradient: cloneGradientState(selectedLayer.params) }
          : { fieldGradient: cloneFieldGradientState(selectedLayer.params) }),
      };
    }),
  selectFieldGradientAnchor: (id) =>
    set((state) => {
      const fieldGradient = {
        ...state.fieldGradient,
        selectedAnchorId: id,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
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
  setEffectLayerOpacity: (id, opacity, options) =>
    set((state) => {
      const nextOpacity = clampPercent(opacity);
      const layer = state.effectLayers.find((effectLayer) => effectLayer.id === id);

      if (!layer || layer.opacity === nextOpacity) {
        return state;
      }

      return {
        effectLayers: state.effectLayers.map((effectLayer) =>
          effectLayer.id === id ? { ...effectLayer, opacity: nextOpacity } : effectLayer
        ),
        ...getHistoryPatch(state, options),
      };
    }),
  setFieldGradientAmplitude: (amplitude, options) =>
    set((state) => {
      const nextAmplitude = clampRange(amplitude, 0, 0.6);

      if (state.fieldGradient.amplitude === nextAmplitude) {
        return state;
      }

      const fieldGradient = {
        ...state.fieldGradient,
        amplitude: nextAmplitude,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
        ...getHistoryPatch(state, options),
      };
    }),
  setFieldGradientFrequency: (frequency, options) =>
    set((state) => {
      const nextFrequency = clampRange(frequency, 0.3, 4);

      if (state.fieldGradient.frequency === nextFrequency) {
        return state;
      }

      const fieldGradient = {
        ...state.fieldGradient,
        frequency: nextFrequency,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
        ...getHistoryPatch(state, options),
      };
    }),
  setFieldGradientMode: (mode) =>
    set((state) => {
      if (state.fieldGradient.mode === mode) {
        return state;
      }

      const fieldGradient = {
        ...state.fieldGradient,
        mode,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
        ...getHistoryPatch(state),
      };
    }),
  setFieldGradientPower: (power, options) =>
    set((state) => {
      const nextPower = clampRange(power, 0.4, 6);

      if (state.fieldGradient.power === nextPower) {
        return state;
      }

      const fieldGradient = {
        ...state.fieldGradient,
        power: nextPower,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
        ...getHistoryPatch(state, options),
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
  toggleEffectLayerEnabled: (id) =>
    set((state) => {
      if (!state.effectLayers.some((layer) => layer.id === id)) {
        return state;
      }

      return {
        effectLayers: state.effectLayers.map((layer) =>
          layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
        ),
        ...getHistoryPatch(state),
      };
    }),
  updateFieldGradientAnchor: (id, update, options) =>
    set((state) => {
      const hasAnchor = state.fieldGradient.anchors.some((anchor) => anchor.id === id);

      if (!hasAnchor) {
        return state;
      }

      const fieldGradient = {
        ...state.fieldGradient,
        anchors: state.fieldGradient.anchors.map((anchor) =>
          anchor.id === id
            ? {
                ...anchor,
                ...update,
                x: update.x === undefined ? anchor.x : wrapUnit(update.x),
                y: update.y === undefined ? anchor.y : wrapUnit(update.y),
              }
            : anchor
        ),
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
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
                opacity: update.opacity === undefined ? stop.opacity : clampPercent(update.opacity),
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
});
