import type { StateCreator } from "zustand";

import {
  cloneEffectLayerParams,
  type EffectLayer,
} from "@/effects/effect-layer";
import type { WorkspaceStore } from "@/store/app";
import type { LayersSlice } from "@/store/modules/layers";

export {
  clampMidpoint,
  clampPercent,
  clampRange,
  clampUnit,
} from "@/effects/layers/primitives";
export type { GradientStop } from "@/effects/layers/primitives";

export type HistoryUpdateOptions = {
  history?: "checkpoint" | "skip";
};

export type EffectLayerBlendModePreview = {
  blendMode: EffectLayer["blendMode"];
  layerId: string;
};

export type LayersSet = Parameters<StateCreator<WorkspaceStore, [], [], LayersSlice>>[0];

export function cloneEffectLayer(layer: EffectLayer): EffectLayer {
  return {
    ...layer,
    params: cloneEffectLayerParams(layer) as never,
  };
}

export function getHistoryPatch(state: WorkspaceStore, options?: HistoryUpdateOptions) {
  if (options?.history === "skip" || state.isHistoryTransactionActive()) {
    return {};
  }

  return state.createHistoryCheckpoint(state);
}
