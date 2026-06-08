import type { ComponentType } from "react";

import {
  normalizeBlendMode,
  type EffectLayerBlendMode,
} from "@/effects/blend-modes";
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
import type {
  SkyboxFieldGradientParams,
  SkyboxGradientParams,
  SkyboxImageParams,
  SkyboxManifestLayer,
  Skybox,
  SkyboxSpotParams,
  SkyboxStarfieldParams,
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
    | SerializedGradientEffect
    | SerializedFieldGradientEffect
    | SerializedImageEffect
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
  load: (serialized: { params: TParams; type: TType }) => TParams;
  serialize: (params: TParams) => { params: TParams; type: TType };
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
  load: (serialized) => cloneImageState(serialized.params),
  serialize: (params) => ({ params: cloneImageState(params), type: "image" }),
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
  fieldGradientLayerAddon,
  spotLayerAddon,
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
