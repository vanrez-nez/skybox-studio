import type { EffectLayer } from "@/effects/effect-layer";
import type { SkyboxManifestLayer, SkyboxManifestV1 } from "@/runtime";

function layerToManifestLayer(layer: EffectLayer): SkyboxManifestLayer {
  return layer.type === "gradient"
    ? {
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

export function createSkyboxManifest(effectLayers: EffectLayer[]): SkyboxManifestV1 {
  return {
    composition: {
      mode: "alpha-over",
      order: "bottom-to-top",
    },
    layers: effectLayers.map(layerToManifestLayer),
    version: 1,
  };
}

