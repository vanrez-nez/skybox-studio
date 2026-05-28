import {
  createSkyboxManifest,
  layerToManifestLayer,
} from "@/effects/skybox-manifest";
import { getEffectLayerAddon, type EffectLayer } from "@/effects/effect-layer";
import type { SkyGeometryType } from "@/store/modules/scene";
import type { EffectLayerBlendModePreview } from "@/store/modules/layers";
import { Skybox } from "@/runtime/index";

type EditorSkyboxSyncState = {
  effectLayers: EffectLayer[];
  previewBlendMode: EffectLayerBlendModePreview | null;
  skyGeometryType: SkyGeometryType;
};

type EditorSkyboxSyncOptions = {
  onRender: () => void;
  onSkyGeometryChange: (skyGeometryType: SkyGeometryType) => void;
  skybox: Skybox;
};

function getEffectiveBlendMode(
  layer: EffectLayer,
  previewBlendMode: EffectLayerBlendModePreview | null
) {
  return previewBlendMode?.layerId === layer.id ? previewBlendMode.blendMode : layer.blendMode;
}

function getLayerTopologyKey(layer: EffectLayer) {
  return getEffectLayerAddon(layer.type).runtime.getTopologyKey(layer as never);
}

function getTopologyKey(state: EditorSkyboxSyncState) {
  return JSON.stringify({
    geometry: state.skyGeometryType,
    layers: state.effectLayers.map(getLayerTopologyKey),
  });
}

function getPreviewLayerIds(
  previousPreviewBlendMode: EffectLayerBlendModePreview | null,
  nextPreviewBlendMode: EffectLayerBlendModePreview | null
) {
  return new Set(
    [previousPreviewBlendMode?.layerId, nextPreviewBlendMode?.layerId].filter(
      (layerId): layerId is string => Boolean(layerId)
    )
  );
}

export class EditorSkyboxSync {
  #options: EditorSkyboxSyncOptions;
  #previousState: EditorSkyboxSyncState | null = null;
  #previousTopologyKey = "";

  constructor(options: EditorSkyboxSyncOptions) {
    this.#options = options;
  }

  prime(nextState: EditorSkyboxSyncState) {
    this.#previousState = nextState;
    this.#previousTopologyKey = getTopologyKey(nextState);
  }

  sync(nextState: EditorSkyboxSyncState) {
    const nextTopologyKey = getTopologyKey(nextState);
    const shouldRebuild =
      !this.#previousState || this.#previousTopologyKey !== nextTopologyKey;

    if (shouldRebuild) {
      this.#options.onSkyGeometryChange(nextState.skyGeometryType);
      this.#options.skybox.setManifest(
        createSkyboxManifest(
          nextState.effectLayers,
          nextState.previewBlendMode,
          { type: nextState.skyGeometryType }
        )
      );
      this.#previousState = nextState;
      this.#previousTopologyKey = nextTopologyKey;
      this.#options.onRender();
      return;
    }

    const previousState = this.#previousState;

    if (!previousState) {
      return;
    }

    const previousLayersById = new Map(
      previousState.effectLayers.map((layer) => [layer.id, layer])
    );
    const previewLayerIds = getPreviewLayerIds(
      previousState.previewBlendMode,
      nextState.previewBlendMode
    );
    let changed = false;

    nextState.effectLayers.forEach((layer) => {
      const previousLayer = previousLayersById.get(layer.id);

      if (!previousLayer) {
        return;
      }

      const previousBlendMode = getEffectiveBlendMode(
        previousLayer,
        previousState.previewBlendMode
      );
      const nextBlendMode = getEffectiveBlendMode(layer, nextState.previewBlendMode);
      const compositionChanged =
        previousLayer.opacity !== layer.opacity ||
        previousBlendMode !== nextBlendMode ||
        previewLayerIds.has(layer.id);

      if (compositionChanged) {
        this.#options.skybox.updateLayerComposition(layer.id, {
          blendMode: nextBlendMode,
          opacity: layer.opacity,
        });
        changed = true;
      }

      if (previousLayer.params === layer.params) {
        return;
      }

      const manifestLayer = layerToManifestLayer(layer, nextState.previewBlendMode);

      getEffectLayerAddon(layer.type).runtime.updateLayerParams(
        this.#options.skybox,
        layer as never,
        manifestLayer as never
      );
      changed = true;
    });

    this.#previousState = nextState;
    this.#previousTopologyKey = nextTopologyKey;

    if (changed) {
      this.#options.onRender();
    }
  }
}
