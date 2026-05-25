import { create } from "zustand";
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

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit";
export type MenuCommandId = "file.export" | "file.load";
export type MenuEventId = MenuId | MenuCommandId;
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

type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

type WorkspaceStore = {
  activeView: WorkspaceView;
  effectLayers: EffectLayer[];
  fieldGradient: FieldGradientState;
  gradient: GradientState;
  lastMenuEvent: MenuEvent | null;
  selectedLayerId: string;
  addFieldGradientAnchor: (anchor: Omit<FieldGradientAnchor, "id">) => void;
  addEffectLayer: (type: EffectLayerType) => void;
  addGradientStop: (stop: Omit<GradientStop, "id">) => void;
  deleteEffectLayer: (id: string) => void;
  deleteSelectedEffectLayer: () => void;
  emitMenuEvent: (id: MenuEventId) => void;
  randomizeFieldGradient: () => void;
  reorderEffectLayer: (sourceId: string, targetId: string, closestEdgeOfTarget: Edge | null) => void;
  renameEffectLayer: (id: string, name: string) => void;
  removeFieldGradientAnchor: (id: string) => void;
  removeGradientStop: (id: string) => void;
  resetFieldGradient: () => void;
  selectEffectLayer: (id: string) => void;
  selectFieldGradientAnchor: (id: string) => void;
  selectGradientStop: (id: string) => void;
  setActiveView: (view: WorkspaceView) => void;
  setFieldGradientAmplitude: (amplitude: number) => void;
  setFieldGradientFrequency: (frequency: number) => void;
  setFieldGradientMode: (mode: FieldGradientMode) => void;
  setFieldGradientPower: (power: number) => void;
  setGradientMode: (mode: GradientMode) => void;
  setGradientRotation: (rotation: number) => void;
  toggleEffectLayerEnabled: (id: string) => void;
  updateFieldGradientAnchor: (id: string, update: Partial<Omit<FieldGradientAnchor, "id">>) => void;
  updateGradientStop: (id: string, update: Partial<Omit<GradientStop, "id">>) => void;
};

export const workspaceViews: Array<{ id: WorkspaceView; label: string }> = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
];

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

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
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

function createDefaultGradientState(): GradientState {
  return {
    mode: "linear",
    rotation: 0,
    selectedStopId: "middle",
    stops: defaultGradientStops.map((stop) => ({ ...stop })),
  };
}

function createDefaultFieldGradientState(): FieldGradientState {
  return {
    amplitude: 0.12,
    anchors: defaultFieldGradientAnchors.map((anchor) => ({ ...anchor })),
    frequency: 1.2,
    mode: "inverse-distance",
    power: 2.2,
    selectedAnchorId: "yellow",
  };
}

function syncSelectedGradientLayer(state: WorkspaceStore, gradient: GradientState) {
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

function syncSelectedFieldGradientLayer(state: WorkspaceStore, fieldGradient: FieldGradientState) {
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
        params: createDefaultGradientState(),
        type,
      }
    : {
        enabled: true,
        id,
        name: fieldGradientLayerAdapter.getDefaultName(index),
        params: createDefaultFieldGradientState(),
        type,
      };
}

const initialGradient = createDefaultGradientState();
const initialFieldGradient = createDefaultFieldGradientState();
const initialEffectLayers: EffectLayer[] = [
  {
    enabled: true,
    id: INITIAL_GRADIENT_LAYER_ID,
    name: "Gradient",
    params: cloneGradientState(initialGradient),
    type: "gradient",
  },
  {
    enabled: true,
    id: INITIAL_FIELD_GRADIENT_LAYER_ID,
    name: "Field Gradient",
    params: cloneFieldGradientState(initialFieldGradient),
    type: "field-gradient",
  },
];

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  activeView: "editor",
  effectLayers: initialEffectLayers,
  fieldGradient: initialFieldGradient,
  gradient: initialGradient,
  lastMenuEvent: null,
  selectedLayerId: INITIAL_GRADIENT_LAYER_ID,
  addFieldGradientAnchor: (anchor) =>
    set((state) => {
      if (state.fieldGradient.anchors.length >= FIELD_GRADIENT_MAX_ANCHORS) {
        return state;
      }

      const nextAnchor = {
        ...anchor,
        id: `field-${Date.now()}`,
        x: clampUnit(anchor.x),
        y: clampUnit(anchor.y),
      };

      const fieldGradient = {
        ...state.fieldGradient,
        anchors: [...state.fieldGradient.anchors, nextAnchor],
        selectedAnchorId: nextAnchor.id,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
      };
    }),
  addEffectLayer: (type) =>
    set((state) => {
      const layerTypeCount = state.effectLayers.filter((layer) => layer.type === type).length + 1;
      const nextLayer = createEffectLayer(type, layerTypeCount);

      return {
        effectLayers: [...state.effectLayers, nextLayer],
        selectedLayerId: nextLayer.id,
        ...(nextLayer.type === "gradient"
          ? { gradient: cloneGradientState(nextLayer.params) }
          : { fieldGradient: cloneFieldGradientState(nextLayer.params) }),
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
      };
    }),
  deleteEffectLayer: (id) =>
    set((state) => {
      const nextLayers = state.effectLayers.filter((layer) => layer.id !== id);
      const selectedLayer =
        state.selectedLayerId === id
          ? nextLayers[Math.max(0, state.effectLayers.findIndex((layer) => layer.id === id) - 1)] ??
            nextLayers[0]
          : nextLayers.find((layer) => layer.id === state.selectedLayerId) ?? nextLayers[0];

      if (!selectedLayer) {
        return {
          effectLayers: nextLayers,
          selectedLayerId: "",
        };
      }

      return {
        effectLayers: nextLayers,
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
      const nextLayers = state.effectLayers.filter((layer) => layer.id !== state.selectedLayerId);
      const selectedLayer = nextLayers[Math.max(0, deleteIndex - 1)] ?? nextLayers[0];

      if (!selectedLayer) {
        return {
          effectLayers: nextLayers,
          selectedLayerId: "",
        };
      }

      return {
        effectLayers: nextLayers,
        selectedLayerId: selectedLayer.id,
        ...(selectedLayer.type === "gradient"
          ? { gradient: cloneGradientState(selectedLayer.params) }
          : { fieldGradient: cloneFieldGradientState(selectedLayer.params) }),
      };
    }),
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
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
      };
    }),
  renameEffectLayer: (id, name) =>
    set((state) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return state;
      }

      return {
        effectLayers: state.effectLayers.map((layer) =>
          layer.id === id ? { ...layer, name: trimmedName } : layer
        ),
      };
    }),
  removeFieldGradientAnchor: (id) =>
    set((state) => {
      if (state.fieldGradient.anchors.length <= 1) {
        return state;
      }

      const nextAnchors = state.fieldGradient.anchors.filter((anchor) => anchor.id !== id);

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
      };
    }),
  removeGradientStop: (id) =>
    set((state) => {
      if (state.gradient.stops.length <= 2) {
        return state;
      }

      const nextStops = state.gradient.stops.filter((stop) => stop.id !== id);

      const gradient = {
        ...state.gradient,
        selectedStopId:
          state.gradient.selectedStopId === id ? nextStops[0].id : state.gradient.selectedStopId,
        stops: nextStops,
      };

      return {
        effectLayers: syncSelectedGradientLayer(state, gradient),
        gradient,
      };
    }),
  resetFieldGradient: () =>
    set((state) => {
      const fieldGradient = createDefaultFieldGradientState();

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
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
  setActiveView: (view) => set({ activeView: view }),
  setFieldGradientAmplitude: (amplitude) =>
    set((state) => {
      const fieldGradient = {
        ...state.fieldGradient,
        amplitude: clampRange(amplitude, 0, 0.6),
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
      };
    }),
  setFieldGradientFrequency: (frequency) =>
    set((state) => {
      const fieldGradient = {
        ...state.fieldGradient,
        frequency: clampRange(frequency, 0.3, 4),
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
      };
    }),
  setFieldGradientMode: (mode) =>
    set((state) => {
      const fieldGradient = {
        ...state.fieldGradient,
        mode,
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
      };
    }),
  setFieldGradientPower: (power) =>
    set((state) => {
      const fieldGradient = {
        ...state.fieldGradient,
        power: clampRange(power, 0.4, 6),
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
      };
    }),
  setGradientMode: (mode) =>
    set((state) => {
      const gradient = {
        ...state.gradient,
        mode,
      };

      return {
        effectLayers: syncSelectedGradientLayer(state, gradient),
        gradient,
      };
    }),
  setGradientRotation: (rotation) =>
    set((state) => {
      const gradient = {
        ...state.gradient,
        rotation,
      };

      return {
        effectLayers: syncSelectedGradientLayer(state, gradient),
        gradient,
      };
    }),
  toggleEffectLayerEnabled: (id) =>
    set((state) => ({
      effectLayers: state.effectLayers.map((layer) =>
        layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
      ),
    })),
  updateFieldGradientAnchor: (id, update) =>
    set((state) => {
      const fieldGradient = {
        ...state.fieldGradient,
        anchors: state.fieldGradient.anchors.map((anchor) =>
          anchor.id === id
            ? {
                ...anchor,
                ...update,
                x: update.x === undefined ? anchor.x : clampUnit(update.x),
                y: update.y === undefined ? anchor.y : clampUnit(update.y),
              }
            : anchor
        ),
      };

      return {
        effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
        fieldGradient,
      };
    }),
  updateGradientStop: (id, update) =>
    set((state) => {
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
      };
    }),
}));
