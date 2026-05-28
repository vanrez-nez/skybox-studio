import {
  applyEffectLayerModifier as applyEffectLayerModifierToLayer,
  type EffectLayerModifier,
} from "@/effects/effect-layer-interfaces";
import type { EffectLayer, EffectLayerBlendMode } from "@/effects/effect-layer";
import type { WorkspaceStore } from "@/store/app";
import type { LayersSlice } from "@/store/modules/layers";
import {
  clampPercent,
  cloneEffectLayer,
  getHistoryPatch,
  selectedLayerStatePatch,
  type HistoryUpdateOptions,
} from "@/store/modules/layer-utils";

export type LayerCommonUpdate = Partial<{
  blendMode: EffectLayerBlendMode;
  enabled: boolean;
  locked: boolean;
  name: string;
  opacity: number;
}>;

export type LayerOperation =
  | {
      layerId: string;
      modifier: EffectLayerModifier;
      type: "layer.apply-modifier";
    }
  | {
      layerId: string;
      type: "layer.update-common";
      update: LayerCommonUpdate;
    };

function normalizeCommonUpdate(layer: EffectLayer, update: LayerCommonUpdate) {
  const normalizedUpdate: LayerCommonUpdate = {};

  if (update.blendMode !== undefined && update.blendMode !== layer.blendMode) {
    normalizedUpdate.blendMode = update.blendMode;
  }

  if (update.enabled !== undefined && update.enabled !== layer.enabled) {
    normalizedUpdate.enabled = update.enabled;
  }

  if (update.locked !== undefined && update.locked !== layer.locked) {
    normalizedUpdate.locked = update.locked;
  }

  if (update.name !== undefined) {
    const trimmedName = update.name.trim();

    if (trimmedName && trimmedName !== layer.name) {
      normalizedUpdate.name = trimmedName;
    }
  }

  if (update.opacity !== undefined) {
    const nextOpacity = clampPercent(update.opacity);

    if (nextOpacity !== layer.opacity) {
      normalizedUpdate.opacity = nextOpacity;
    }
  }

  return normalizedUpdate;
}

function applyCommonUpdate(layer: EffectLayer, update: LayerCommonUpdate) {
  const normalizedUpdate = normalizeCommonUpdate(layer, update);

  if (Object.keys(normalizedUpdate).length === 0) {
    return null;
  }

  return {
    ...layer,
    ...normalizedUpdate,
  } as EffectLayer;
}

export function applyLayerOperationToState(
  state: WorkspaceStore,
  operation: LayerOperation,
  options?: HistoryUpdateOptions
): Partial<LayersSlice> | null {
  const layer = state.effectLayers.find((effectLayer) => effectLayer.id === operation.layerId);

  if (!layer) {
    return null;
  }

  const nextLayer =
    operation.type === "layer.apply-modifier"
      ? applyEffectLayerModifierToLayer(layer, operation.modifier)
      : applyCommonUpdate(layer, operation.update);

  if (!nextLayer) {
    return null;
  }

  const normalizedNextLayer = cloneEffectLayer(nextLayer);

  return {
    effectLayers: state.effectLayers.map((effectLayer) =>
      effectLayer.id === operation.layerId ? normalizedNextLayer : effectLayer
    ),
    ...(state.selectedLayerId === operation.layerId
      ? selectedLayerStatePatch(normalizedNextLayer)
      : {}),
    ...getHistoryPatch(state, options),
  };
}
