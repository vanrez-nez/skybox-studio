import type { EffectLayer } from "@/effects/effect-layer";
import type {
  SkyboxGeometryOptions,
  SkyboxManifestLayer,
  SkyboxManifestV2,
} from "@/runtime/index";
import type { EffectLayerBlendModePreview } from "@/store/modules/layers";

function layerToManifestLayer(
  layer: EffectLayer,
  previewBlendMode?: EffectLayerBlendModePreview | null
): SkyboxManifestLayer {
  const blendMode =
    previewBlendMode?.layerId === layer.id ? previewBlendMode.blendMode : layer.blendMode;

  return layer.type === "gradient"
    ? {
        blendMode,
        enabled: layer.enabled,
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        params: {
          mode: layer.params.mode,
          rotation: layer.params.rotation,
          stops: layer.params.stops.map((stop) => ({
            color: stop.color,
            location: stop.location,
            opacity: stop.opacity,
          })),
        },
        type: "gradient",
      }
    : {
        blendMode,
        enabled: layer.enabled,
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        params: {
          amplitude: layer.params.amplitude,
          anchors: layer.params.anchors.map((anchor) => ({
            color: anchor.color,
            x: anchor.x,
            y: anchor.y,
          })),
          frequency: layer.params.frequency,
          mode: layer.params.mode,
          power: layer.params.power,
        },
        type: "field-gradient",
      };
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
