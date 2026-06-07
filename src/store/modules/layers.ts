import type { StateCreator } from "zustand";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";

import type { EffectLayerModifier } from "@/effects/effect-layer-interfaces";
import type { SkyboxStarfieldClipParams } from "@/runtime";
import {
  cloneFieldGradientState,
  cloneGradientState,
  cloneImageState,
  cloneSpotState,
  cloneStarfieldState,
  type EffectLayer,
  type EffectLayerBlendMode,
  type EffectLayerType,
  getEffectLayerAddon,
} from "@/effects/effect-layer";
import type { HistoryParticipant, WorkspaceStore } from "@/store/app";
import {
  createDefaultFieldGradientState,
  createFieldGradientLayerActions,
  type FieldGradientAnchor,
  type FieldGradientMode,
  type FieldGradientState,
} from "@/store/modules/layer-field-gradient";
import {
  createDefaultGradientState,
  createGradientLayerActions,
  type GradientMode,
  type GradientState,
} from "@/store/modules/layer-gradient";
import {
  cloneImageStateForHistory,
  createDefaultImageState,
  createImageLayerActions,
  createRuntimeImageLookup,
  IMAGE_PLACEMENT_TRANSACTION_SCOPE,
  rehydrateImageRuntimeData,
  restoreImageLayerRuntimeData,
  type ImagePlacement,
  type ImageState,
} from "@/store/modules/layer-image";
import {
  createDefaultSpotState,
  createSpotLayerActions,
  type SpotColorMode,
  type SpotLightParameterKey,
  type SpotState,
} from "@/store/modules/layer-spot";
import {
  createDefaultStarfieldState,
  createStarfieldLayerActions,
  type StarfieldFieldAnchor,
  type StarfieldFieldMode,
  type StarfieldClipParameterKey,
  type StarfieldColor,
  type StarfieldNebulaColorKey,
  type StarfieldNebulaParameterKey,
  type StarfieldQuality,
  type StarfieldStarsParameterKey,
  type StarfieldState,
} from "@/store/modules/layer-starfield";
import {
  cloneEffectLayer,
  getHistoryPatch,
  selectedLayerStatePatch,
  type EffectLayerBlendModePreview,
  type GradientStop,
  type HistoryUpdateOptions,
} from "@/store/modules/layer-utils";
import {
  applyLayerOperationToState,
  type LayerOperation,
} from "@/store/modules/layer-operations";

export { IMAGE_PLACEMENT_TRANSACTION_SCOPE };
export type {
  EffectLayerBlendModePreview,
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
  fieldGradient: FieldGradientState;
  gradient: GradientState;
  image: ImageState;
  spot: SpotState;
  starfield: StarfieldState;
  selectedLayerId: string;
};

export type AddEffectLayerOptions = {
  centerDirection?: [number, number, number];
};

export type LayersSlice = {
  effectLayers: EffectLayer[];
  fieldGradient: FieldGradientState;
  gradient: GradientState;
  image: ImageState;
  spot: SpotState;
  starfield: StarfieldState;
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
  addFieldGradientAnchor: (anchor: Omit<FieldGradientAnchor, "id">) => void;
  clearPreviewEffectLayerBlendMode: () => void;
  addGradientStop: (stop: Omit<GradientStop, "id" | "midpoint"> & { midpoint?: number }) => void;
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
  clearImage: () => void;
  setEffectLayerBlendMode: (id: string, blendMode: EffectLayerBlendMode) => void;
  setEffectLayerLocked: (id: string, locked: boolean) => void;
  setPreviewEffectLayerBlendMode: (layerId: string, blendMode: EffectLayerBlendMode) => void;
  setEffectLayerOpacity: (id: string, opacity: number, options?: HistoryUpdateOptions) => void;
  setFieldGradientAmplitude: (amplitude: number, options?: HistoryUpdateOptions) => void;
  setFieldGradientFrequency: (frequency: number, options?: HistoryUpdateOptions) => void;
  setFieldGradientMode: (mode: FieldGradientMode) => void;
  setFieldGradientPower: (power: number, options?: HistoryUpdateOptions) => void;
  setGradientMode: (mode: GradientMode) => void;
  setGradientRotation: (rotation: number, options?: HistoryUpdateOptions) => void;
  setImage: (image: ImageState) => void;
  setImageAssetSource: (id: string, src: string | null) => void;
  setImagePlacement: (
    id: string,
    placement: ImagePlacement | null,
    options?: HistoryUpdateOptions
  ) => void;
  addSpotStop: (stop: Omit<GradientStop, "id" | "midpoint"> & { midpoint?: number }) => void;
  removeSpotStop: (id: string) => void;
  selectSpotStop: (id: string) => void;
  setSpotColorMode: (mode: SpotColorMode) => void;
  setSpotLightColor: (color: string, options?: HistoryUpdateOptions) => void;
  setSpotBrightness: (brightness: number, options?: HistoryUpdateOptions) => void;
  setSpotGlow: (glow: number, options?: HistoryUpdateOptions) => void;
  setSpotHalo: (halo: number, options?: HistoryUpdateOptions) => void;
  setSpotLightParameter: (
    parameter: SpotLightParameterKey,
    value: number,
    options?: HistoryUpdateOptions
  ) => void;
  setSpotPosition: (centerDirection: [number, number, number], options?: HistoryUpdateOptions) => void;
  setSpotRadiusScale: (radiusScale: number, options?: HistoryUpdateOptions) => void;
  addStarfieldFieldAnchor: (anchor: Omit<StarfieldFieldAnchor, "id">) => void;
  randomizeStarfieldField: () => void;
  removeStarfieldFieldAnchor: (id: string) => void;
  resetStarfieldField: () => void;
  selectStarfieldFieldAnchor: (id: string) => void;
  setStarfieldClipParameter: (
    parameter: StarfieldClipParameterKey,
    value: number,
    options?: HistoryUpdateOptions
  ) => void;
  setStarfieldClip: (
    clip: SkyboxStarfieldClipParams,
    options?: HistoryUpdateOptions
  ) => void;
  setStarfieldNebulaColor: (
    parameter: StarfieldNebulaColorKey,
    color: StarfieldColor,
    options?: HistoryUpdateOptions
  ) => void;
  setStarfieldFieldAmplitude: (amplitude: number, options?: HistoryUpdateOptions) => void;
  setStarfieldFieldFrequency: (frequency: number, options?: HistoryUpdateOptions) => void;
  setStarfieldFieldMode: (mode: StarfieldFieldMode) => void;
  setStarfieldFieldPower: (power: number, options?: HistoryUpdateOptions) => void;
  setStarfieldNebulaParameter: (
    parameter: StarfieldNebulaParameterKey,
    value: number,
    options?: HistoryUpdateOptions
  ) => void;
  setStarfieldQuality: (quality: StarfieldQuality) => void;
  setStarfieldStarsParameter: (
    parameter: StarfieldStarsParameterKey,
    value: number,
    options?: HistoryUpdateOptions
  ) => void;
  toggleEffectLayerEnabled: (id: string) => void;
  updateStarfieldFieldAnchor: (
    id: string,
    update: Partial<Omit<StarfieldFieldAnchor, "id">>,
    options?: HistoryUpdateOptions
  ) => void;
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
  updateSpotStop: (
    id: string,
    update: Partial<Omit<GradientStop, "id">>,
    options?: HistoryUpdateOptions
  ) => void;
};

const initialGradient = createDefaultGradientState();
const initialFieldGradient = createDefaultFieldGradientState();
const initialImage = createDefaultImageState();
const initialSpot = createDefaultSpotState();
const initialStarfield = createDefaultStarfieldState();
const initialEffectLayers: EffectLayer[] = [];

function cloneEffectLayerForHistory(layer: EffectLayer): EffectLayer {
  if (layer.type !== "image") {
    return cloneEffectLayer(layer);
  }

  return {
    ...layer,
    params: cloneImageStateForHistory(layer.params),
  };
}

function captureLayersHistorySnapshot(state: LayersSlice): LayersHistorySnapshot {
  return {
    effectLayers: state.effectLayers.map(cloneEffectLayerForHistory),
    fieldGradient: cloneFieldGradientState(state.fieldGradient),
    gradient: cloneGradientState(state.gradient),
    image: cloneImageStateForHistory(state.image),
    spot: cloneSpotState(state.spot),
    starfield: cloneStarfieldState(state.starfield),
    selectedLayerId: state.selectedLayerId,
  };
}

function restoreLayersHistorySnapshot(snapshot: LayersHistorySnapshot, currentState: LayersSlice) {
  const runtimeLookup = createRuntimeImageLookup(currentState);
  const effectLayers = snapshot.effectLayers
    .map(cloneEffectLayerForHistory)
    .map((layer) => restoreImageLayerRuntimeData(layer, runtimeLookup));
  const selectedLayer = effectLayers.find((layer) => layer.id === snapshot.selectedLayerId);
  const image =
    selectedLayer?.type === "image"
      ? cloneImageState(selectedLayer.params)
      : rehydrateImageRuntimeData(
          cloneImageStateForHistory(snapshot.image),
          snapshot.image.assetId ? runtimeLookup.byAssetId.get(snapshot.image.assetId) : undefined
        );

  return {
    effectLayers,
    fieldGradient: cloneFieldGradientState(snapshot.fieldGradient),
    gradient: cloneGradientState(snapshot.gradient),
    image,
    spot: cloneSpotState(snapshot.spot ?? createDefaultSpotState()),
    starfield: cloneStarfieldState(snapshot.starfield ?? createDefaultStarfieldState()),
    selectedLayerId: snapshot.selectedLayerId,
  };
}

function createEffectLayer(
  type: EffectLayerType,
  index: number,
  options: AddEffectLayerOptions = {}
): EffectLayer {
  const id = `layer-${type}-${Date.now()}-${index}`;

  if (type === "gradient") {
    return {
      blendMode: "normal",
      enabled: true,
      id,
      locked: false,
      name: getEffectLayerAddon(type).getDefaultName(index),
      opacity: 100,
      params: createDefaultGradientState(),
      type,
    };
  }

  if (type === "field-gradient") {
    return {
      blendMode: "normal",
      enabled: true,
      id,
      locked: false,
      name: getEffectLayerAddon(type).getDefaultName(index),
      opacity: 100,
      params: createDefaultFieldGradientState(),
      type,
    };
  }

  if (type === "spot") {
    return {
      blendMode: "normal",
      enabled: true,
      id,
      locked: false,
      name: getEffectLayerAddon(type).getDefaultName(index),
      opacity: 100,
      params: createDefaultSpotState(options.centerDirection),
      type,
    };
  }

  if (type === "starfield") {
    return {
      blendMode: "screen",
      enabled: true,
      id,
      locked: false,
      name: getEffectLayerAddon(type).getDefaultName(index),
      opacity: 100,
      params: createDefaultStarfieldState(),
      type,
    };
  }

  return {
    blendMode: "normal",
    enabled: true,
    id,
    locked: false,
    name: getEffectLayerAddon(type).getDefaultName(index),
    opacity: 100,
    params: createDefaultImageState(),
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
  fieldGradient: initialFieldGradient,
  gradient: initialGradient,
  image: initialImage,
  spot: initialSpot,
  starfield: initialStarfield,
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

      const nextLayer = cloneEffectLayer({
        ...layer,
        params: updater(layer.params),
      } as EffectLayer);

      return {
        effectLayers: state.effectLayers.map((effectLayer) =>
          effectLayer.id === layerId ? nextLayer : effectLayer
        ),
        ...(state.selectedLayerId === layerId ? selectedLayerStatePatch(nextLayer) : {}),
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

      const nextLayer = cloneEffectLayer({
        ...layer,
        params: updater(layer.params),
      } as EffectLayer);

      return {
        effectLayers: state.effectLayers.map((effectLayer) =>
          effectLayer.id === layer.id ? nextLayer : effectLayer
        ),
        ...selectedLayerStatePatch(nextLayer),
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
        ...selectedLayerStatePatch(nextLayer),
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

      const nextLayers = state.effectLayers.filter((layer) => layer.id !== id);
      const selectedLayer =
        state.selectedLayerId === id
          ? nextLayers[Math.max(0, deleteIndex - 1)] ?? nextLayers[0]
          : nextLayers.find((layer) => layer.id === state.selectedLayerId) ?? nextLayers[0];

      if (!selectedLayer) {
        return {
          effectLayers: nextLayers,
          ...getHistoryPatch(state),
          previewEffectLayerBlendMode: null,
          selectedLayerId: "",
        };
      }

      return {
        effectLayers: nextLayers,
        ...getHistoryPatch(state),
        previewEffectLayerBlendMode: null,
        selectedLayerId: selectedLayer.id,
        ...selectedLayerStatePatch(selectedLayer),
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
          previewEffectLayerBlendMode: null,
          selectedLayerId: "",
        };
      }

      return {
        effectLayers: nextLayers,
        ...getHistoryPatch(state),
        previewEffectLayerBlendMode: null,
        selectedLayerId: selectedLayer.id,
        ...selectedLayerStatePatch(selectedLayer),
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
        ...selectedLayerStatePatch(selectedLayer),
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
  ...createFieldGradientLayerActions(set),
  ...createGradientLayerActions(set),
  ...createImageLayerActions(set),
  ...createSpotLayerActions(set),
  ...createStarfieldLayerActions(set),
});
