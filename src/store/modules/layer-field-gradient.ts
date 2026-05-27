import type { LayersSlice } from "@/store/modules/layers";
import {
  clampRange,
  clampUnit,
  getHistoryPatch,
  syncSelectedFieldGradientLayer,
  type LayersSet,
} from "@/store/modules/layer-utils";

export type FieldGradientMode = "inverse-distance" | "gaussian";

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

const defaultFieldGradientAnchors: FieldGradientAnchor[] = [
  { id: "red", color: "#ff0000", x: 0.5, y: 0.5 },
];

const FIELD_GRADIENT_MAX_ANCHORS = 8;

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

export function createDefaultFieldGradientState(): FieldGradientState {
  return {
    amplitude: 0.12,
    anchors: defaultFieldGradientAnchors.map((anchor) => ({ ...anchor })),
    frequency: 1.2,
    mode: "inverse-distance",
    power: 2.2,
    selectedAnchorId: "red",
  };
}

type FieldGradientLayerActions = Pick<
  LayersSlice,
  | "addFieldGradientAnchor"
  | "randomizeFieldGradient"
  | "removeFieldGradientAnchor"
  | "resetFieldGradient"
  | "selectFieldGradientAnchor"
  | "setFieldGradientAmplitude"
  | "setFieldGradientFrequency"
  | "setFieldGradientMode"
  | "setFieldGradientPower"
  | "updateFieldGradientAnchor"
>;

export function createFieldGradientLayerActions(set: LayersSet): FieldGradientLayerActions {
  return {
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
          ...getHistoryPatch(state),
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
    resetFieldGradient: () =>
      set((state) => {
        const fieldGradient = createDefaultFieldGradientState();

        return {
          effectLayers: syncSelectedFieldGradientLayer(state, fieldGradient),
          fieldGradient,
          ...getHistoryPatch(state),
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
                  x: update.x === undefined ? anchor.x : clampUnit(update.x),
                  y: update.y === undefined ? anchor.y : clampUnit(update.y),
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
  };
}
