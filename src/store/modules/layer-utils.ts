import type { StateCreator } from "zustand";

import {
  cloneFieldGradientState,
  cloneGradientState,
  cloneImageState,
  cloneSpotState,
  type EffectLayer,
} from "@/effects/effect-layer";
import type { WorkspaceStore } from "@/store/app";
import type {
  FieldGradientState,
  GradientState,
  ImageState,
  LayersSlice,
  SpotState,
} from "@/store/modules/layers";

export type GradientStop = {
  color: string;
  id: string;
  location: number;
  midpoint: number;
  opacity: number;
};

export type HistoryUpdateOptions = {
  history?: "checkpoint" | "skip";
};

export type EffectLayerBlendModePreview = {
  blendMode: EffectLayer["blendMode"];
  layerId: string;
};

export type LayersSet = Parameters<StateCreator<WorkspaceStore, [], [], LayersSlice>>[0];

export function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function clampMidpoint(value: number) {
  return Math.min(99, Math.max(1, value));
}

export function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function cloneEffectLayer(layer: EffectLayer): EffectLayer {
  if (layer.type === "gradient") {
    return {
      ...layer,
      params: cloneGradientState(layer.params),
    };
  }

  if (layer.type === "field-gradient") {
    return {
      ...layer,
      params: cloneFieldGradientState(layer.params),
    };
  }

  if (layer.type === "spot") {
    return {
      ...layer,
      params: cloneSpotState(layer.params),
    };
  }

  return {
    ...layer,
    params: cloneImageState(layer.params),
  };
}

export function selectedLayerStatePatch(layer: EffectLayer) {
  if (layer.type === "gradient") {
    return { gradient: cloneGradientState(layer.params) };
  }

  if (layer.type === "field-gradient") {
    return { fieldGradient: cloneFieldGradientState(layer.params) };
  }

  if (layer.type === "spot") {
    return { spot: cloneSpotState(layer.params) };
  }

  return { image: cloneImageState(layer.params) };
}

export function getHistoryPatch(state: WorkspaceStore, options?: HistoryUpdateOptions) {
  if (options?.history === "skip" || state.isHistoryTransactionActive()) {
    return {};
  }

  return state.createHistoryCheckpoint(state);
}

export function syncSelectedGradientLayer(state: LayersSlice, gradient: GradientState) {
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

export function syncSelectedFieldGradientLayer(
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

export function syncSelectedImageLayer(state: LayersSlice, image: ImageState) {
  const selectedLayer = state.effectLayers.find((layer) => layer.id === state.selectedLayerId);

  if (selectedLayer?.type !== "image") {
    return state.effectLayers;
  }

  return state.effectLayers.map((layer) =>
    layer.id === selectedLayer.id && layer.type === "image"
      ? { ...layer, params: cloneImageState(image) }
      : layer
  );
}

export function syncSelectedSpotLayer(state: LayersSlice, spot: SpotState) {
  const selectedLayer = state.effectLayers.find((layer) => layer.id === state.selectedLayerId);

  if (selectedLayer?.type !== "spot") {
    return state.effectLayers;
  }

  return state.effectLayers.map((layer) =>
    layer.id === selectedLayer.id && layer.type === "spot"
      ? { ...layer, params: cloneSpotState(spot) }
      : layer
  );
}
