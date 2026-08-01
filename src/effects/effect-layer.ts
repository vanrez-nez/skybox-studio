import type { ComponentType } from "react";

import {
  normalizeBlendMode,
  type EffectLayerBlendMode,
} from "@/effects/blend-modes";
import {
  cloneCloudsState,
  createDefaultCloudsState,
  type CloudsState,
} from "@/effects/layers/clouds/state";
import {
  cloneFieldGradientState,
  createDefaultFieldGradientState,
  type FieldGradientState,
} from "@/effects/layers/field-gradient/state";
import {
  cloneGradientState,
  createDefaultGradientState,
  type GradientState,
} from "@/effects/layers/gradient/state";
import {
  cloneImageState,
  createDefaultImageState,
  type ImageState,
} from "@/effects/layers/image/state";
import {
  cloneMoonState,
  createDefaultMoonState,
  loadMoonState,
  type MoonState,
} from "@/effects/layers/moon/state";
import {
  positionFromMoon,
  setMoonPosition,
} from "@/effects/layers/moon/operations";
import {
  cloneSpotState,
  createDefaultSpotState,
  type SpotState,
} from "@/effects/layers/spot/state";
import {
  cloneStarfieldState,
  createDefaultStarfieldState,
  starfieldStateToManifestParams,
  type StarfieldState,
} from "@/effects/layers/starfield/state";
import {
  computeMoonLightSource,
  type SkyboxFieldGradientParams,
  type SkyboxGradientParams,
  type SkyboxImageParams,
  type SkyboxManifestLayer,
  type Skybox,
  type SkyboxSpotParams,
  type SkyboxStarfieldParams,
} from "@/runtime/index";
import {
  normalizeImagePlacement,
  placementFromPosition,
  placementFromRotation,
  placementFromScale,
  positionFromPlacement,
  rotationFromPlacement,
  scaleFromPlacement,
  type Point2,
} from "@/runtime/image-placement-transform";
import {
  positionFromSpot,
  spotFromPosition,
} from "@/runtime/spot-transform";

export type EffectLayerType = string;
export type { EffectLayerBlendMode };

export type SerializedCloudsEffect = {
  params: CloudsState;
  type: "clouds";
};

export type SerializedGradientEffect = {
  params: GradientState;
  type: "gradient";
};

export type SerializedFieldGradientEffect = {
  params: FieldGradientState;
  type: "field-gradient";
};

export type SerializedImageEffect = {
  params: ImageState;
  type: "image";
};

export type SerializedMoonEffect = {
  params: MoonState;
  type: "moon";
};

export type SerializedSpotEffect = {
  params: SpotState;
  type: "spot";
};

export type SerializedStarfieldEffect = {
  params: StarfieldState;
  type: "starfield";
};

export type SerializedEffectLayer = {
  blendMode?: EffectLayerBlendMode;
  effect:
    | SerializedCloudsEffect
    | SerializedGradientEffect
    | SerializedFieldGradientEffect
    | SerializedImageEffect
    | SerializedMoonEffect
    | SerializedSpotEffect
    | SerializedStarfieldEffect;
  enabled: boolean;
  id: string;
  locked?: boolean;
  name: string;
  opacity?: number;
};

export type EffectLayer<TParams = unknown> = {
  blendMode: EffectLayerBlendMode;
  enabled: boolean;
  id: string;
  locked: boolean;
  name: string;
  opacity: number;
  params: TParams;
  type: string;
};

export type EffectLayerFocusTarget = {
  direction: [number, number, number];
  type: "direction";
};

/**
 * Editor-side view of a layer's light-source capability (the runtime twin is
 * LayerLightSourceDescriptor). Addons that implement getLightSource can be
 * picked as a Clouds light reference; descriptor defaults are filled in so
 * consumers never branch on undefined.
 */
export type EffectLayerLightSource = {
  direction: [number, number, number];
  /** Multiplier over the clouds light's user intensity; 1 = passthrough. */
  intensityScale: number;
  /** Apparent angular radius in radians; 0 = point light. */
  angularRadius: number;
  /** True when the layer draws its own disc (clouds disc is forced off). */
  rendersOwnDisc: boolean;
};

export type Point3 = {
  x: number;
  y: number;
  z: number;
};

export type EffectLayerTransformKind =
  | "2d-position"
  | "3d-position"
  | "rotation"
  | "scale";

export type EffectLayerTransformValueMap = {
  "2d-position": Point2;
  "3d-position": Point3;
  rotation: number;
  scale: Point2;
};

export type EffectLayerTransformCapability<
  TKind extends EffectLayerTransformKind,
  TParams = unknown
> = {
  read: (layer: EffectLayer<TParams>) => EffectLayerTransformValueMap[TKind] | null;
  write: (
    layer: EffectLayer<TParams>,
    value: EffectLayerTransformValueMap[TKind]
  ) => EffectLayer | null;
};

export type EffectLayerTransformCapabilities<TParams = unknown> = Partial<{
  [TKind in EffectLayerTransformKind]: EffectLayerTransformCapability<TKind, TParams>;
}>;

export type EffectLayerDefaultParamsContext = {
  centerDirection?: [number, number, number];
};

export type EffectLayerAddon<TType extends string = string, TParams = unknown> = {
  cloneParams: (params: TParams) => TParams;
  createDefaultParams: (context?: EffectLayerDefaultParamsContext) => TParams;
  defaultBlendMode: EffectLayerBlendMode;
  // UI is attached by the app layer via registerEffectLayerUi so the runtime/
  // store stay React-free. The sidebar/layers list read these from the registry.
  Icon?: ComponentType;
  Panel?: ComponentType;
  displayName: string;
  getDefaultName: (index: number) => string;
  getFocusTarget?: (layer: EffectLayer<TParams>) => EffectLayerFocusTarget | null;
  /**
   * Light-source capability: presence makes this layer type selectable as a
   * Clouds light reference. Null = this particular layer can't provide a
   * light right now (e.g. an unplaced image). Mirrors the runtime adapter's
   * getLightSource so the widget/store never branch on layer type.
   */
  getLightSource?: (layer: EffectLayer<TParams>) => EffectLayerLightSource | null;
  load: (serialized: { params: TParams; type: TType }) => TParams;
  serialize: (params: TParams) => { params: TParams; type: TType };
  // Drop editor-only runtime data (decoded pixels, object URLs) that must never reach storage. Addons
  // whose params are already fully serializable can omit this.
  stripRuntimeParams?: (params: TParams) => TParams;
  toManifestParams: (params: TParams) => Extract<SkyboxManifestLayer, { type: TType }>["params"];
  transformCapabilities?: EffectLayerTransformCapabilities<TParams>;
  runtime: {
    getTopologyKey: (layer: EffectLayer<TParams>) => unknown;
    updateLayerParams: (
      skybox: Skybox,
      layer: EffectLayer<TParams>,
      manifestLayer: Extract<SkyboxManifestLayer, { type: TType }>
    ) => void;
  };
  type: TType;
};

export {
  cloneFieldGradientState,
  cloneGradientState,
  cloneImageState,
  cloneSpotState,
  cloneStarfieldState,
};

function isFiniteDirection(direction: [number, number, number]) {
  return direction.every(Number.isFinite) && direction.some((component) => component !== 0);
}

function manifestGradientParams(params: GradientState): SkyboxGradientParams {
  return {
    mode: params.mode,
    rotation: params.rotation,
    stops: params.stops.map((stop) => ({
      color: stop.color,
      location: stop.location,
      midpoint: stop.midpoint,
      opacity: stop.opacity,
    })),
  };
}

function manifestFieldGradientParams(params: FieldGradientState): SkyboxFieldGradientParams {
  return {
    amplitude: params.amplitude,
    anchors: params.anchors.map((anchor) => ({
      color: anchor.color,
      x: anchor.x,
      y: anchor.y,
    })),
    frequency: params.frequency,
    mode: params.mode,
    power: params.power,
  };
}

function manifestImageParams(params: ImageState): SkyboxImageParams {
  return {
    height: params.height,
    pixels: params.pixels,
    placement: params.placement,
    src: params.src,
    width: params.width,
  };
}

function manifestSpotParams(params: SpotState): SkyboxSpotParams {
  return {
    angularRadius: params.angularRadius,
    baseAngularRadius: params.baseAngularRadius,
    brightness: params.brightness,
    centerDirection: params.centerDirection,
    colorMode: params.colorMode,
    coreRadius: params.coreRadius,
    coreSoftness: params.coreSoftness,
    dispersion: params.dispersion,
    dogSpread: params.dogSpread,
    dogStrength: params.dogStrength,
    dogStretch: params.dogStretch,
    glareSize: params.glareSize,
    glareStrength: params.glareStrength,
    glow: params.glow,
    glowSize: params.glowSize,
    glowStrength: params.glowStrength,
    halo: params.halo,
    haloInnerWidth: params.haloInnerWidth,
    haloOuterWidth: params.haloOuterWidth,
    haloRadius: params.haloRadius,
    haloStrength: params.haloStrength,
    lightColor: params.lightColor,
    stops: params.stops.map((stop) => ({
      color: stop.color,
      location: stop.location,
      midpoint: stop.midpoint,
      opacity: stop.opacity,
    })),
  };
}

function manifestStarfieldParams(params: StarfieldState): SkyboxStarfieldParams {
  return starfieldStateToManifestParams(params);
}

export const cloudsLayerAddon: EffectLayerAddon<"clouds", CloudsState> = {
  cloneParams: cloneCloudsState,
  createDefaultParams: createDefaultCloudsState,
  defaultBlendMode: "normal",
  displayName: "Clouds",
  getDefaultName: () => "Clouds",
  load: (serialized) => cloneCloudsState(serialized.params),
  serialize: (params) => ({ params: cloneCloudsState(params), type: "clouds" }),
  // The editor params are the runtime params verbatim — no editor-only fields to drop.
  toManifestParams: (params) => cloneCloudsState(params),
  runtime: {
    // Structural only. Every cloud param is a continuously-dragged scalar or colour, so this stays
    // constant and edits take the Direct (uniform-push) path instead of rebuilding the material.
    getTopologyKey: (layer) => ({
      enabled: layer.enabled,
      id: layer.id,
      type: layer.type,
    }),
    updateLayerParams: (skybox, layer, manifestLayer) => {
      skybox.updateLayer(layer.id, manifestLayer.params);
    },
  },
  type: "clouds",
};

export const gradientLayerAddon: EffectLayerAddon<"gradient", GradientState> = {
  cloneParams: cloneGradientState,
  createDefaultParams: createDefaultGradientState,
  defaultBlendMode: "normal",
  displayName: "Gradient",
  getDefaultName: () => "Gradient",
  load: (serialized) => cloneGradientState(serialized.params),
  serialize: (params) => ({ params: cloneGradientState(params), type: "gradient" }),
  toManifestParams: manifestGradientParams,
  runtime: {
    getTopologyKey: (layer) => ({
      enabled: layer.enabled,
      id: layer.id,
      stopCount: layer.params.stops.length,
      type: layer.type,
    }),
    updateLayerParams: (skybox, layer, manifestLayer) => {
      skybox.updateGradientLayer(layer.id, manifestLayer.params);
    },
  },
  transformCapabilities: {
    rotation: {
      read: (layer) => (layer.type === "gradient" ? layer.params.rotation : null),
      write: (layer, value) =>
        layer.type === "gradient"
          ? {
              ...layer,
              params: {
                ...layer.params,
                rotation: value,
              },
            }
          : null,
    },
  },
  type: "gradient",
};

export const fieldGradientLayerAddon: EffectLayerAddon<"field-gradient", FieldGradientState> = {
  cloneParams: cloneFieldGradientState,
  createDefaultParams: createDefaultFieldGradientState,
  defaultBlendMode: "normal",
  displayName: "Field Gradient",
  getDefaultName: () => "Field Gradient",
  load: (serialized) => cloneFieldGradientState(serialized.params),
  serialize: (params) => ({ params: cloneFieldGradientState(params), type: "field-gradient" }),
  toManifestParams: manifestFieldGradientParams,
  runtime: {
    getTopologyKey: (layer) => ({
      anchorCount: layer.params.anchors.length,
      enabled: layer.enabled,
      id: layer.id,
      type: layer.type,
    }),
    updateLayerParams: (skybox, layer, manifestLayer) => {
      skybox.updateFieldGradientLayer(layer.id, manifestLayer.params);
    },
  },
  type: "field-gradient",
};

export const imageLayerAddon: EffectLayerAddon<"image", ImageState> = {
  cloneParams: cloneImageState,
  createDefaultParams: createDefaultImageState,
  defaultBlendMode: "normal",
  displayName: "Image",
  getFocusTarget: (layer) => {
    if (!layer.enabled || !layer.params.src || !layer.params.placement) {
      return null;
    }

    const placement = normalizeImagePlacement(layer.params.placement);
    const direction = placement.centerDirection;

    if (!isFiniteDirection(direction)) {
      return null;
    }

    return {
      direction,
      type: "direction",
    };
  },
  getDefaultName: () => "Image",
  // Direction-only light source; an unplaced image is not a light source.
  getLightSource: (layer) => {
    const direction = layer.params.placement?.centerDirection;
    return direction && isFiniteDirection(direction)
      ? {
          direction: [...direction],
          intensityScale: 1,
          angularRadius: 0,
          rendersOwnDisc: false,
        }
      : null;
  },
  load: (serialized) => cloneImageState(serialized.params),
  serialize: (params) => ({ params: cloneImageState(params), type: "image" }),
  // Decoded pixels and the object URL are rebuilt from the IndexedDB blob keyed by assetId
  // (see ThreeWorkspaceScene), so they must never be written to storage — they'd blow the quota.
  stripRuntimeParams: (params) => ({ ...params, pixels: null, src: null }),
  toManifestParams: manifestImageParams,
  runtime: {
    getTopologyKey: (layer) => ({
      enabled: layer.enabled,
      hasPlacement: Boolean(layer.params.placement),
      hasSrc: Boolean(layer.params.src),
      height: layer.params.height,
      id: layer.id,
      type: layer.type,
      width: layer.params.width,
    }),
    updateLayerParams: (skybox, layer, manifestLayer) => {
      skybox.updateImageLayerPlacement(layer.id, manifestLayer.params.placement);
    },
  },
  transformCapabilities: {
    "2d-position": {
      read: (layer) =>
        layer.type === "image" && layer.params.placement
          ? positionFromPlacement(layer.params.placement)
          : null,
      write: (layer, value) =>
        layer.type === "image" && layer.params.placement
          ? {
              ...layer,
              params: {
                ...layer.params,
                placement: placementFromPosition(layer.params.placement, value),
              },
            }
          : null,
    },
    rotation: {
      read: (layer) =>
        layer.type === "image" && layer.params.placement
          ? rotationFromPlacement(layer.params.placement)
          : null,
      write: (layer, value) =>
        layer.type === "image" && layer.params.placement
          ? {
              ...layer,
              params: {
                ...layer.params,
                placement: placementFromRotation(layer.params.placement, value),
              },
            }
          : null,
    },
    scale: {
      read: (layer) =>
        layer.type === "image" && layer.params.placement
          ? scaleFromPlacement(layer.params.placement)
          : null,
      write: (layer, value) =>
        layer.type === "image" && layer.params.placement
          ? {
              ...layer,
              params: {
                ...layer.params,
                placement: placementFromScale(layer.params.placement, value),
              },
            }
          : null,
    },
  },
  type: "image",
};

export const moonLayerAddon: EffectLayerAddon<"moon", MoonState> = {
  cloneParams: cloneMoonState,
  createDefaultParams: (context) => createDefaultMoonState(context?.centerDirection),
  defaultBlendMode: "normal",
  displayName: "Moon",
  getDefaultName: () => "Moon",
  getFocusTarget: (layer) => {
    if (!layer.enabled) return null;
    const direction = layer.params.placement.centerDirection;
    return isFiniteDirection(direction) ? { direction, type: "direction" } : null;
  },
  // Full descriptor: the runtime helper derives the intensity modulation from
  // phase/size/exposure and the disc's angular radius. Editor MoonState IS
  // SkyboxMoonParams, so this is a direct delegation — one photometric truth.
  getLightSource: (layer) => {
    const source = computeMoonLightSource(layer.params);
    return {
      direction: source.direction,
      intensityScale: source.intensityScale ?? 1,
      angularRadius: source.angularRadius ?? 0,
      rendersOwnDisc: source.rendersOwnDisc ?? false,
    };
  },
  load: (serialized) => loadMoonState(serialized.params),
  serialize: (params) => ({ params: cloneMoonState(params), type: "moon" }),
  toManifestParams: cloneMoonState,
  runtime: {
    getTopologyKey: (layer) => ({
      enabled: layer.enabled,
      id: layer.id,
      type: layer.type,
    }),
    updateLayerParams: (skybox, layer, manifestLayer) => {
      skybox.updateMoonLayer(layer.id, manifestLayer.params);
    },
  },
  transformCapabilities: {
    "2d-position": {
      read: (layer) =>
        layer.type === "moon" ? positionFromMoon(layer.params) : null,
      write: (layer, value) =>
        layer.type === "moon"
          ? {
              ...layer,
              params: setMoonPosition(layer.params, value),
            }
          : null,
    },
    scale: {
      read: (layer) =>
        layer.type === "moon" ? scaleFromPlacement(layer.params.placement) : null,
      write: (layer, value) =>
        layer.type === "moon"
          ? {
              ...layer,
              params: {
                ...layer.params,
                placement: placementFromScale(layer.params.placement, {
                  x: value.x,
                  y: value.x,
                }),
              },
            }
          : null,
    },
  },
  type: "moon",
};

export const spotLayerAddon: EffectLayerAddon<"spot", SpotState> = {
  cloneParams: cloneSpotState,
  createDefaultParams: (context) => createDefaultSpotState(context?.centerDirection),
  defaultBlendMode: "normal",
  displayName: "Spot",
  getFocusTarget: (layer) => {
    if (!layer.enabled) {
      return null;
    }

    const direction = layer.params.centerDirection;

    if (!isFiniteDirection(direction)) {
      return null;
    }

    return {
      direction,
      type: "direction",
    };
  },
  getDefaultName: () => "Spot",
  // Direction-only light source: appearance never leaks into the sky model.
  getLightSource: (layer) =>
    isFiniteDirection(layer.params.centerDirection)
      ? {
          direction: [...layer.params.centerDirection],
          intensityScale: 1,
          angularRadius: 0,
          rendersOwnDisc: false,
        }
      : null,
  load: (serialized) => cloneSpotState(serialized.params),
  serialize: (params) => ({ params: cloneSpotState(params), type: "spot" }),
  toManifestParams: manifestSpotParams,
  runtime: {
    getTopologyKey: (layer) => ({
      enabled: layer.enabled,
      id: layer.id,
      stopCount: layer.params.stops.length,
      type: layer.type,
    }),
    updateLayerParams: (skybox, layer, manifestLayer) => {
      skybox.updateSpotLayer(layer.id, manifestLayer.params);
    },
  },
  transformCapabilities: {
    "2d-position": {
      read: (layer) => (layer.type === "spot" ? positionFromSpot(layer.params) : null),
      write: (layer, value) =>
        layer.type === "spot"
          ? {
              ...layer,
              params: {
                ...layer.params,
                centerDirection: spotFromPosition(layer.params, value).centerDirection,
              },
            }
          : null,
    },
  },
  type: "spot",
};

export const starfieldLayerAddon: EffectLayerAddon<"starfield", StarfieldState> = {
  cloneParams: cloneStarfieldState,
  createDefaultParams: createDefaultStarfieldState,
  defaultBlendMode: "screen",
  displayName: "Starfield",
  getDefaultName: () => "Starfield",
  load: (serialized) => cloneStarfieldState(serialized.params),
  serialize: (params) => ({ params: cloneStarfieldState(params), type: "starfield" }),
  toManifestParams: manifestStarfieldParams,
  runtime: {
    getTopologyKey: (layer) => ({
      enabled: layer.enabled,
      id: layer.id,
      type: layer.type,
    }),
    updateLayerParams: (skybox, layer, manifestLayer) => {
      skybox.updateStarfieldLayer(layer.id, manifestLayer.params);
    },
  },
  type: "starfield",
};

export const builtInEffectLayerAddons = [
  gradientLayerAddon,
  cloudsLayerAddon,
  fieldGradientLayerAddon,
  spotLayerAddon,
  moonLayerAddon,
  imageLayerAddon,
  starfieldLayerAddon,
] as const;

const registeredEffectLayerAddons = new Map<EffectLayerType, EffectLayerAddon>();

builtInEffectLayerAddons.forEach((addon) => {
  registeredEffectLayerAddons.set(addon.type, addon as EffectLayerAddon);
});

export function registerEffectLayerAddon(addon: EffectLayerAddon) {
  if (registeredEffectLayerAddons.has(addon.type)) {
    throw new Error(`Effect layer addon "${addon.type}" is already registered.`);
  }

  registeredEffectLayerAddons.set(addon.type, addon);
}

export function getEffectLayerAddon(type: EffectLayerType) {
  const addon = registeredEffectLayerAddons.get(type);

  if (!addon) {
    throw new Error(`Effect layer addon "${type}" is not registered.`);
  }

  return addon;
}

export function getEffectLayerAddons() {
  return Array.from(registeredEffectLayerAddons.values());
}

export function registerEffectLayerUi(
  type: EffectLayerType,
  ui: { Icon?: ComponentType; Panel?: ComponentType }
) {
  const addon = getEffectLayerAddon(type);

  addon.Icon = ui.Icon;
  addon.Panel = ui.Panel;
}

export function cloneEffectLayerParams(layer: EffectLayer): EffectLayer["params"] {
  return getEffectLayerAddon(layer.type).cloneParams(layer.params as never) as EffectLayer["params"];
}

export function getEffectLayerFocusTarget(
  layer: EffectLayer | undefined
): EffectLayerFocusTarget | null {
  if (!layer) {
    return null;
  }

  return getEffectLayerAddon(layer.type).getFocusTarget?.(layer as never) ?? null;
}

// Drop every layer's editor-only runtime data (see EffectLayerAddon.stripRuntimeParams) so the result is
// safe to persist. Layers whose addon has no hook are returned untouched.
export function stripEffectLayerRuntimeData(layers: EffectLayer[]): EffectLayer[] {
  return layers.map((layer) => {
    const strip = getEffectLayerAddon(layer.type).stripRuntimeParams;

    return strip ? { ...layer, params: strip(layer.params as never) } : layer;
  });
}

export function serializeEffectLayer(layer: EffectLayer): SerializedEffectLayer {
  const addon = getEffectLayerAddon(layer.type);

  return {
    blendMode: layer.blendMode,
    effect: addon.serialize(layer.params as never) as SerializedEffectLayer["effect"],
    enabled: layer.enabled,
    id: layer.id,
    locked: layer.locked,
    name: layer.name,
    opacity: layer.opacity,
  };
}

export function loadEffectLayer(serialized: SerializedEffectLayer): EffectLayer {
  const addon = getEffectLayerAddon(serialized.effect.type);

  return {
    blendMode: normalizeBlendMode(serialized.blendMode),
    enabled: serialized.enabled,
    id: serialized.id,
    locked: serialized.locked ?? false,
    name: serialized.name,
    opacity: serialized.opacity ?? 100,
    params: addon.load(serialized.effect as never),
    type: serialized.effect.type,
  };
}
