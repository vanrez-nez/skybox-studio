import { getEffectLayerAddon, type EffectLayer } from "@/effects/effect-layer";
import type {
  SkyboxGeometryOptions,
  SkyboxManifestLayer,
  SkyboxManifestV2,
} from "@/runtime/index";
import type { EffectLayerBlendModePreview } from "@/store/modules/layers";

export function layerToManifestLayer(
  layer: EffectLayer,
  previewBlendMode?: EffectLayerBlendModePreview | null
): SkyboxManifestLayer {
  const addon = getEffectLayerAddon(layer.type);
  const blendMode =
    previewBlendMode?.layerId === layer.id ? previewBlendMode.blendMode : layer.blendMode;

  return {
    blendMode,
    enabled: layer.enabled,
    id: layer.id,
    name: layer.name,
    opacity: layer.opacity,
    params: addon.toManifestParams(layer.params as never),
    type: layer.type,
  } as SkyboxManifestLayer;
}

export function createSkyboxManifest(
  effectLayers: EffectLayer[],
  previewBlendMode?: EffectLayerBlendModePreview | null,
  geometry: SkyboxGeometryOptions = { type: "box" }
): SkyboxManifestV2 {
  return {
    composition: {
      mode: "alpha-over",
      order: "bottom-to-top",
    },
    geometry,
    nodes: effectLayers.map((layer) => layerToManifestLayer(layer, previewBlendMode)),
    version: 2,
  };
}
