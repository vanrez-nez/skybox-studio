import type { StateCreator } from "zustand";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";

import type { EffectLayerModifier } from "@/effects/effect-layer-interfaces";
import {
  getEffectLayerAddon,
  type EffectLayer,
  type EffectLayerBlendMode,
  type EffectLayerType,
} from "@/effects/effect-layer";
import {
  cloneImageStateForHistory,
  createRuntimeImageLookup,
  restoreImageLayerRuntimeData,
} from "@/effects/layers/image/history";
import {
  IMAGE_PLACEMENT_TRANSACTION_SCOPE,
  type ImagePlacement,
  type ImageState,
} from "@/effects/layers/image/state";
import type { CloudsState } from "@/effects/layers/clouds/state";
import type {
  FieldGradientAnchor,
  FieldGradientMode,
  FieldGradientState,
} from "@/effects/layers/field-gradient/state";
import type { GradientMode, GradientState } from "@/effects/layers/gradient/state";
import type { GradientStop } from "@/effects/layers/primitives";
import type {
  SpotColorMode,
  SpotLightParameterKey,
  SpotState,
} from "@/effects/layers/spot/state";
import type {
  StarfieldClipParameterKey,
  StarfieldColor,
  StarfieldFieldAnchor,
  StarfieldFieldMode,
  StarfieldNebulaColorKey,
  StarfieldNebulaParameterKey,
  StarfieldQuality,
  StarfieldStarsParameterKey,
  StarfieldState,
} from "@/effects/layers/starfield/state";
import type { HistoryParticipant, WorkspaceStore } from "@/store/app";
import {
  cloneEffectLayer,
  getHistoryPatch,
  type EffectLayerBlendModePreview,
  type HistoryUpdateOptions,
} from "@/store/modules/layer-utils";
import {
  applyLayerOperationToState,
  type LayerOperation,
} from "@/store/modules/layer-operations";

export { IMAGE_PLACEMENT_TRANSACTION_SCOPE };
export type {
  EffectLayerBlendModePreview,
  CloudsState,
  FieldGradientAnchor,
  FieldGradientMode,
  FieldGradientState,
  EffectLayerModifier,
  GradientMode,
  GradientState,
  GradientStop,
  HistoryUpdateOptions,
  ImagePlacement,
  ImageState,
  SpotColorMode,
  SpotLightParameterKey,
  SpotState,
  StarfieldClipParameterKey,
  StarfieldColor,
  StarfieldFieldAnchor,
  StarfieldFieldMode,
  StarfieldNebulaColorKey,
  StarfieldNebulaParameterKey,
  StarfieldQuality,
  StarfieldStarsParameterKey,
  StarfieldState,
};

export type LayersHistorySnapshot = {
  effectLayers: EffectLayer[];
  selectedLayerId: string;
};

export type AddEffectLayerOptions = {
  centerDirection?: [number, number, number];
};

export type LayersSlice = {
  effectLayers: EffectLayer[];
  previewEffectLayerBlendMode: EffectLayerBlendModePreview | null;
  selectedLayerId: string;
  addEffectLayer: (type: EffectLayerType, options?: AddEffectLayerOptions) => void;
  dispatchLayerOperation: (operation: LayerOperation, options?: HistoryUpdateOptions) => void;
  updateLayerParams: (
    layerId: string,
    updater: (params: EffectLayer["params"]) => EffectLayer["params"],
    options?: HistoryUpdateOptions
  ) => void;
  updateSelectedLayerParams: (
    updater: (params: EffectLayer["params"]) => EffectLayer["params"],
    options?: HistoryUpdateOptions
  ) => void;
  applyEffectLayerModifier: (
    id: string,
    modifier: EffectLayerModifier,
    options?: HistoryUpdateOptions
  ) => void;
  clearPreviewEffectLayerBlendMode: () => void;
  deleteEffectLayer: (id: string) => void;
  deleteSelectedEffectLayer: () => void;
  reorderEffectLayer: (sourceId: string, targetId: string, closestEdgeOfTarget: Edge | null) => void;
  renameEffectLayer: (id: string, name: string) => void;
  selectEffectLayer: (id: string) => void;
  setEffectLayerBlendMode: (id: string, blendMode: EffectLayerBlendMode) => void;
  setEffectLayerLocked: (id: string, locked: boolean) => void;
  setPreviewEffectLayerBlendMode: (layerId: string, blendMode: EffectLayerBlendMode) => void;
  setEffectLayerOpacity: (id: string, opacity: number, options?: HistoryUpdateOptions) => void;
  toggleEffectLayerEnabled: (id: string) => void;
};

const initialEffectLayers: EffectLayer[] = [];

function removeLayerAndDetachCloudLights(
  layers: EffectLayer[],
  layerId: string,
): EffectLayer[] {
  const target = layers.find((layer) => layer.id === layerId);
  const direction =
    target?.type === "spot"
      ? ([...(target.params as SpotState).centerDirection] as [number, number, number])
      : target?.type === "image"
        ? ((target.params as ImageState).placement?.centerDirection ?? null)
        : null;

  return layers
    .filter((layer) => layer.id !== layerId)
    .map((layer) => {
      if (layer.type !== "clouds") {
        return layer;
      }

      const params = layer.params as CloudsState;
      let changed = false;
      const detach = (light: CloudsState["sun"]): CloudsState["sun"] => {
        if (light.directionLayerId !== layerId) {
          return light;
        }

        changed = true;
        return {
          ...light,
          direction: direction ? [...direction] : light.direction,
          directionLayerId: null,
        };
      };
      const sun = detach(params.sun);
      const moon = detach(params.moon);

      return changed
        ? cloneEffectLayer({ ...layer, params: { ...params, sun, moon } })
        : layer;
    });
}

function cloneEffectLayerForHistory(layer: EffectLayer): EffectLayer {
  if (layer.type !== "image") {
    return cloneEffectLayer(layer);
  }

  return {
    ...layer,
    params: cloneImageStateForHistory(layer.params as ImageState),
  };
}

function captureLayersHistorySnapshot(state: LayersSlice): LayersHistorySnapshot {
  return {
    effectLayers: state.effectLayers.map(cloneEffectLayerForHistory),
    selectedLayerId: state.selectedLayerId,
  };
}

function restoreLayersHistorySnapshot(snapshot: LayersHistorySnapshot, currentState: LayersSlice) {
  const runtimeLookup = createRuntimeImageLookup(currentState.effectLayers);
  const effectLayers = snapshot.effectLayers
    .map(cloneEffectLayerForHistory)
    .map((layer) => restoreImageLayerRuntimeData(layer, runtimeLookup));

  return {
    effectLayers,
    selectedLayerId: snapshot.selectedLayerId,
  };
}

function createEffectLayer(
  type: EffectLayerType,
  index: number,
  options: AddEffectLayerOptions = {}
): EffectLayer {
  const addon = getEffectLayerAddon(type);

  return {
    blendMode: addon.defaultBlendMode,
    enabled: true,
    id: `layer-${type}-${Date.now()}-${index}`,
    locked: false,
    name: addon.getDefaultName(index),
    opacity: 100,
    params: addon.createDefaultParams({ centerDirection: options.centerDirection }),
    type,
  };
}

export const layersHistoryParticipant: HistoryParticipant<WorkspaceStore> = {
  capture: (state) => captureLayersHistorySnapshot(state),
  id: "layers",
  restore: (snapshot, currentState) =>
    restoreLayersHistorySnapshot(snapshot as LayersHistorySnapshot, currentState),
};

export const createLayersSlice: StateCreator<WorkspaceStore, [], [], LayersSlice> = (set) => ({
  effectLayers: initialEffectLayers,
  previewEffectLayerBlendMode: null,
  selectedLayerId: "",
  dispatchLayerOperation: (operation, options) =>
    set((state) => applyLayerOperationToState(state, operation, options) ?? state),
  updateLayerParams: (layerId, updater, options) =>
    set((state) => {
      const layer = state.effectLayers.find((effectLayer) => effectLayer.id === layerId);

      if (!layer) {
        return state;
      }

      const nextParams = updater(layer.params);

      if (nextParams === layer.params) {
        return state;
      }

      const nextLayer = cloneEffectLayer({ ...layer, params: nextParams });

      return {
        effectLayers: state.effectLayers.map((effectLayer) =>
          effectLayer.id === layerId ? nextLayer : effectLayer
        ),
        ...getHistoryPatch(state, options),
      };
    }),
  updateSelectedLayerParams: (updater, options) =>
    set((state) => {
      if (!state.selectedLayerId) {
        return state;
      }

      const layer = state.effectLayers.find(
        (effectLayer) => effectLayer.id === state.selectedLayerId
      );

      if (!layer) {
        return state;
      }

      const nextParams = updater(layer.params);

      if (nextParams === layer.params) {
        return state;
      }

      const nextLayer = cloneEffectLayer({ ...layer, params: nextParams });

      return {
        effectLayers: state.effectLayers.map((effectLayer) =>
          effectLayer.id === layer.id ? nextLayer : effectLayer
        ),
        ...getHistoryPatch(state, options),
      };
    }),
  addEffectLayer: (type, options) =>
    set((state) => {
      const layerTypeCount = state.effectLayers.filter((layer) => layer.type === type).length + 1;
      const nextLayer = createEffectLayer(type, layerTypeCount, options);

      return {
        effectLayers: [nextLayer, ...state.effectLayers],
        selectedLayerId: nextLayer.id,
        ...getHistoryPatch(state),
        previewEffectLayerBlendMode: null,
      };
    }),
  applyEffectLayerModifier: (id, modifier, options) =>
    set((state) =>
      applyLayerOperationToState(
        state,
        { layerId: id, modifier, type: "layer.apply-modifier" },
        options
      ) ?? state
    ),
  clearPreviewEffectLayerBlendMode: () => set({ previewEffectLayerBlendMode: null }),
  deleteEffectLayer: (id) =>
    set((state) => {
      const deleteIndex = state.effectLayers.findIndex((layer) => layer.id === id);

      if (deleteIndex === -1) {
        return state;
      }

      const nextLayers = removeLayerAndDetachCloudLights(state.effectLayers, id);
      const selectedLayer =
        state.selectedLayerId === id
          ? nextLayers[Math.max(0, deleteIndex - 1)] ?? nextLayers[0]
          : nextLayers.find((layer) => layer.id === state.selectedLayerId) ?? nextLayers[0];

      return {
        effectLayers: nextLayers,
        ...getHistoryPatch(state),
        previewEffectLayerBlendMode: null,
        selectedLayerId: selectedLayer?.id ?? "",
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

      const nextLayers = removeLayerAndDetachCloudLights(
        state.effectLayers,
        state.selectedLayerId,
      );
      const selectedLayer = nextLayers[Math.max(0, deleteIndex - 1)] ?? nextLayers[0];

      return {
        effectLayers: nextLayers,
        ...getHistoryPatch(state),
        previewEffectLayerBlendMode: null,
        selectedLayerId: selectedLayer?.id ?? "",
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
        previewEffectLayerBlendMode: null,
      };
    }),
  renameEffectLayer: (id, name) =>
    set((state) =>
      applyLayerOperationToState(
        state,
        { layerId: id, type: "layer.update-common", update: { name } }
      ) ?? state
    ),
  selectEffectLayer: (id) =>
    set((state) => {
      const selectedLayer = state.effectLayers.find((layer) => layer.id === id);

      if (!selectedLayer) {
        return state;
      }

      return {
        previewEffectLayerBlendMode: null,
        selectedLayerId: id,
      };
    }),
  setEffectLayerBlendMode: (id, blendMode) =>
    set((state) => ({
      ...(applyLayerOperationToState(
        state,
        { layerId: id, type: "layer.update-common", update: { blendMode } }
      ) ?? state),
      previewEffectLayerBlendMode: null,
    })),
  setEffectLayerLocked: (id, locked) =>
    set((state) =>
      applyLayerOperationToState(
        state,
        { layerId: id, type: "layer.update-common", update: { locked } }
      ) ?? state
    ),
  setPreviewEffectLayerBlendMode: (layerId, blendMode) =>
    set((state) => {
      const layer = state.effectLayers.find((effectLayer) => effectLayer.id === layerId);

      if (!layer) {
        return {
          previewEffectLayerBlendMode: null,
        };
      }

      if (
        state.previewEffectLayerBlendMode?.layerId === layerId &&
        state.previewEffectLayerBlendMode.blendMode === blendMode
      ) {
        return state;
      }

      return {
        previewEffectLayerBlendMode: { blendMode, layerId },
      };
    }),
  setEffectLayerOpacity: (id, opacity, options) =>
    set((state) =>
      applyLayerOperationToState(
        state,
        { layerId: id, type: "layer.update-common", update: { opacity } },
        options
      ) ?? state
    ),
  toggleEffectLayerEnabled: (id) =>
    set((state) => {
      const layer = state.effectLayers.find((effectLayer) => effectLayer.id === id);

      if (!layer) {
        return state;
      }

      return (
        applyLayerOperationToState(
          state,
          { layerId: id, type: "layer.update-common", update: { enabled: !layer.enabled } }
        ) ?? state
      );
    }),
});
