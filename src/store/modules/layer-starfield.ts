import {
  DEFAULT_STARFIELD_PARAMS,
  normalizeStarfieldParams,
  type SkyboxStarfieldClipParams,
  type SkyboxStarfieldNebulaParams,
  type SkyboxStarfieldParams,
  type SkyboxStarfieldQuality,
  type SkyboxStarfieldStarsParams,
} from "@/runtime";
import type { WorkspaceStore } from "@/store/app";
import {
  createDefaultFieldGradientState,
  createRandomFieldAnchors,
  type FieldGradientAnchor,
  type FieldGradientMode,
  type FieldGradientState,
} from "@/store/modules/layer-field-gradient";
import type { LayersSlice } from "@/store/modules/layers";
import {
  clampRange,
  clampUnit,
  getHistoryPatch,
  syncSelectedStarfieldLayer,
  type HistoryUpdateOptions,
  type LayersSet,
} from "@/store/modules/layer-utils";

export type StarfieldState = Omit<SkyboxStarfieldParams, "nebulaField"> & {
  nebulaField: FieldGradientState;
};
export type StarfieldColor = [number, number, number];
export type StarfieldQuality = SkyboxStarfieldQuality;
export type StarfieldStarsParameterKey = keyof SkyboxStarfieldStarsParams;
export type StarfieldNebulaParameterKey = {
  [K in keyof SkyboxStarfieldNebulaParams]: SkyboxStarfieldNebulaParams[K] extends number ? K : never;
}[keyof SkyboxStarfieldNebulaParams];
export type StarfieldNebulaColorKey = {
  [K in keyof SkyboxStarfieldNebulaParams]: SkyboxStarfieldNebulaParams[K] extends StarfieldColor ? K : never;
}[keyof SkyboxStarfieldNebulaParams];
export type StarfieldClipParameterKey = keyof SkyboxStarfieldClipParams;

function cloneFieldState(field: FieldGradientState): FieldGradientState {
  return {
    ...field,
    anchors: field.anchors.map((anchor) => ({ ...anchor })),
  };
}

function createFieldStateFromRuntime(raw: unknown): FieldGradientState {
  const normalizedRuntime = normalizeStarfieldParams({
    ...DEFAULT_STARFIELD_PARAMS,
    nebulaField: raw as never,
  }).nebulaField;
  const anchors = normalizedRuntime.anchors.map((anchor, index) => ({
    ...anchor,
    id: (raw as any)?.anchors?.[index]?.id ?? `starfield-field-${index}`,
  }));

  return {
    ...normalizedRuntime,
    anchors,
    selectedAnchorId:
      (raw as any)?.selectedAnchorId && anchors.some((anchor) => anchor.id === (raw as any).selectedAnchorId)
        ? (raw as any).selectedAnchorId
        : anchors[0]?.id ?? "starfield-field-0",
  };
}

export function cloneStarfieldState(starfield: StarfieldState): StarfieldState {
  const normalized = normalizeStarfieldParams(starfield);
  const nebulaField = createFieldStateFromRuntime(starfield.nebulaField);

  return {
    ...normalized,
    nebulaField,
  };
}

export function createDefaultStarfieldState(): StarfieldState {
  const normalized = normalizeStarfieldParams(DEFAULT_STARFIELD_PARAMS);
  const defaultField = createFieldStateFromRuntime(normalized.nebulaField);

  return {
    ...normalized,
    nebulaField: defaultField.anchors.length ? defaultField : createDefaultFieldGradientState(),
  };
}

function manifestCompatibleStarfield(starfield: StarfieldState): SkyboxStarfieldParams {
  return {
    clip: starfield.clip,
    nebula: starfield.nebula,
    nebulaField: {
      amplitude: starfield.nebulaField.amplitude,
      anchors: starfield.nebulaField.anchors.map((anchor) => ({
        color: anchor.color,
        x: anchor.x,
        y: anchor.y,
      })),
      frequency: starfield.nebulaField.frequency,
      mode: starfield.nebulaField.mode,
      power: starfield.nebulaField.power,
    },
    quality: starfield.quality,
    stars: starfield.stars,
  };
}

function withNormalizedStarfield(
  state: WorkspaceStore,
  starfield: StarfieldState,
  options?: HistoryUpdateOptions
) {
  const nextStarfield = cloneStarfieldState(starfield);

  return {
    effectLayers: syncSelectedStarfieldLayer(state, nextStarfield),
    starfield: nextStarfield,
    ...getHistoryPatch(state, options),
  };
}

type StarfieldLayerActions = Pick<
  LayersSlice,
  | "addStarfieldFieldAnchor"
  | "randomizeStarfieldField"
  | "removeStarfieldFieldAnchor"
  | "resetStarfieldField"
  | "selectStarfieldFieldAnchor"
  | "setStarfieldClip"
  | "setStarfieldClipParameter"
  | "setStarfieldFieldAmplitude"
  | "setStarfieldFieldFrequency"
  | "setStarfieldFieldMode"
  | "setStarfieldFieldPower"
  | "setStarfieldNebulaColor"
  | "setStarfieldNebulaParameter"
  | "setStarfieldQuality"
  | "setStarfieldStarsParameter"
  | "updateStarfieldFieldAnchor"
>;

export function createStarfieldLayerActions(set: LayersSet): StarfieldLayerActions {
  return {
    addStarfieldFieldAnchor: (anchor) =>
      set((state) => {
        if (state.starfield.nebulaField.anchors.length >= 8) {
          return state;
        }

        const nextAnchor = {
          ...anchor,
          id: `starfield-field-${Date.now()}`,
          x: clampUnit(anchor.x),
          y: clampUnit(anchor.y),
        };

        return withNormalizedStarfield(state, {
          ...state.starfield,
          nebulaField: {
            ...state.starfield.nebulaField,
            anchors: [...state.starfield.nebulaField.anchors, nextAnchor],
            selectedAnchorId: nextAnchor.id,
          },
        });
      }),
    randomizeStarfieldField: () =>
      set((state) => {
        const nextAnchors = createRandomFieldAnchors(state.starfield.nebulaField.anchors.length);

        return withNormalizedStarfield(state, {
          ...state.starfield,
          nebulaField: {
            ...state.starfield.nebulaField,
            anchors: nextAnchors.map((anchor) => ({
              ...anchor,
              id: anchor.id.replace("field-", "starfield-field-"),
            })),
            selectedAnchorId: nextAnchors[0]?.id.replace("field-", "starfield-field-") ?? "",
          },
        });
      }),
    removeStarfieldFieldAnchor: (id) =>
      set((state) => {
        if (state.starfield.nebulaField.anchors.length <= 1) {
          return state;
        }

        const nextAnchors = state.starfield.nebulaField.anchors.filter((anchor) => anchor.id !== id);

        if (nextAnchors.length === state.starfield.nebulaField.anchors.length) {
          return state;
        }

        return withNormalizedStarfield(state, {
          ...state.starfield,
          nebulaField: {
            ...state.starfield.nebulaField,
            anchors: nextAnchors,
            selectedAnchorId:
              state.starfield.nebulaField.selectedAnchorId === id
                ? nextAnchors[0].id
                : state.starfield.nebulaField.selectedAnchorId,
          },
        });
      }),
    resetStarfieldField: () =>
      set((state) =>
        withNormalizedStarfield(state, {
          ...state.starfield,
          nebulaField: createDefaultStarfieldState().nebulaField,
        })
      ),
    selectStarfieldFieldAnchor: (id) =>
      set((state) => {
        const starfield = {
          ...state.starfield,
          nebulaField: {
            ...state.starfield.nebulaField,
            selectedAnchorId: id,
          },
        };

        return {
          effectLayers: syncSelectedStarfieldLayer(state, starfield),
          starfield,
        };
      }),
    setStarfieldClip: (clip, options) =>
      set((state) =>
        withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            clip,
          },
          options
        )
      ),
    setStarfieldClipParameter: (parameter, value, options) =>
      set((state) =>
        withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            clip: {
              ...state.starfield.clip,
              [parameter]: value,
            },
          },
          options
        )
      ),
    setStarfieldFieldAmplitude: (amplitude, options) =>
      set((state) =>
        withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            nebulaField: {
              ...state.starfield.nebulaField,
              amplitude: clampRange(amplitude, 0, 0.6),
            },
          },
          options
        )
      ),
    setStarfieldFieldFrequency: (frequency, options) =>
      set((state) =>
        withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            nebulaField: {
              ...state.starfield.nebulaField,
              frequency: clampRange(frequency, 0.3, 4),
            },
          },
          options
        )
      ),
    setStarfieldFieldMode: (mode) =>
      set((state) =>
        withNormalizedStarfield(state, {
          ...state.starfield,
          nebulaField: {
            ...state.starfield.nebulaField,
            mode,
          },
        })
      ),
    setStarfieldFieldPower: (power, options) =>
      set((state) =>
        withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            nebulaField: {
              ...state.starfield.nebulaField,
              power: clampRange(power, 0.4, 6),
            },
          },
          options
        )
      ),
    setStarfieldNebulaColor: (parameter, color, options) =>
      set((state) =>
        withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            nebula: {
              ...state.starfield.nebula,
              [parameter]: color,
            },
          },
          options
        )
      ),
    setStarfieldNebulaParameter: (parameter, value, options) =>
      set((state) =>
        withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            nebula: {
              ...state.starfield.nebula,
              [parameter]: value,
            },
          },
          options
        )
      ),
    setStarfieldQuality: (quality) =>
      set((state) =>
        withNormalizedStarfield(state, {
          ...state.starfield,
          quality,
        })
      ),
    setStarfieldStarsParameter: (parameter, value, options) =>
      set((state) =>
        withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            stars: {
              ...state.starfield.stars,
              [parameter]: value,
            },
          },
          options
        )
      ),
    updateStarfieldFieldAnchor: (id, update, options) =>
      set((state) => {
        const hasAnchor = state.starfield.nebulaField.anchors.some((anchor) => anchor.id === id);

        if (!hasAnchor) {
          return state;
        }

        return withNormalizedStarfield(
          state,
          {
            ...state.starfield,
            nebulaField: {
              ...state.starfield.nebulaField,
              anchors: state.starfield.nebulaField.anchors.map((anchor) =>
                anchor.id === id
                  ? {
                      ...anchor,
                      ...update,
                      x: update.x === undefined ? anchor.x : clampUnit(update.x),
                      y: update.y === undefined ? anchor.y : clampUnit(update.y),
                    }
                  : anchor
              ),
            },
          },
          options
        );
      }),
  };
}

export function starfieldStateToManifestParams(starfield: StarfieldState): SkyboxStarfieldParams {
  return normalizeStarfieldParams(manifestCompatibleStarfield(cloneStarfieldState(starfield)));
}

export function cloneStarfieldFieldState(field: FieldGradientState): FieldGradientState {
  return cloneFieldState(field);
}

export type {
  FieldGradientAnchor as StarfieldFieldAnchor,
  FieldGradientMode as StarfieldFieldMode,
};
