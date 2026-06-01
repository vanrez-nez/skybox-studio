import type {
  FieldGradientState,
  GradientState,
  ImageState,
  SpotState,
  StarfieldState,
} from "@/store/modules/layers";
import {
  normalizeBlendMode,
  type EffectLayerBlendMode,
} from "@/effects/blend-modes";
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
  normalizeSpotParams,
  positionFromSpot,
  spotFromPosition,
} from "@/runtime/spot-transform";
import { normalizeStarfieldParams } from "@/runtime/starfield-static";

export type EffectLayerType = "gradient" | "field-gradient" | "image" | "spot" | "starfield";
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

export type EffectLayer =
  | {
      blendMode: EffectLayerBlendMode;
      enabled: boolean;
      id: string;
      locked: boolean;
      name: string;
      opacity: number;
      params: GradientState;
      type: "gradient";
    }
  | {
      blendMode: EffectLayerBlendMode;
      enabled: boolean;
      id: string;
      locked: boolean;
      name: string;
      opacity: number;
      params: FieldGradientState;
      type: "field-gradient";
    }
  | {
      blendMode: EffectLayerBlendMode;
      enabled: boolean;
      id: string;
      locked: boolean;
      name: string;
      opacity: number;
      params: ImageState;
      type: "image";
    }
  | {
      blendMode: EffectLayerBlendMode;
      enabled: boolean;
      id: string;
      locked: boolean;
      name: string;
      opacity: number;
      params: SpotState;
      type: "spot";
    }
  | {
      blendMode: EffectLayerBlendMode;
      enabled: boolean;
      id: string;
      locked: boolean;
      name: string;
      opacity: number;
      params: StarfieldState;
      type: "starfield";
    };

export type EffectLayerFocusTarget = {
  direction: [number, number, number];
  type: "direction";
};

export type EffectLayerIconName = "field-gradient" | "gradient" | "image" | "spot" | "starfield";
export type EffectLayerSelectedStateKey =
  | "fieldGradient"
  | "gradient"
  | "image"
  | "spot"
  | "starfield";

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

export type EffectLayerTransformCapability<TKind extends EffectLayerTransformKind> = {
  read: (layer: EffectLayer) => EffectLayerTransformValueMap[TKind] | null;
  write: (
    layer: EffectLayer,
    value: EffectLayerTransformValueMap[TKind]
  ) => EffectLayer | null;
};

export type EffectLayerTransformCapabilities = Partial<{
  [TKind in EffectLayerTransformKind]: EffectLayerTransformCapability<TKind>;
}>;

export type EffectLayerAddon<TType extends EffectLayerType = EffectLayerType, TParams = EffectLayer["params"]> = {
  cloneParams: (params: TParams) => TParams;
  displayName: string;
  getDefaultName: (index: number) => string;
  getFocusTarget?: (layer: Extract<EffectLayer, { type: TType }>) => EffectLayerFocusTarget | null;
  iconName: EffectLayerIconName;
  load: (serialized: { params: TParams; type: TType }) => TParams;
  panelId: TType;
  serialize: (params: TParams) => { params: TParams; type: TType };
  selectedStateKey: EffectLayerSelectedStateKey;
  toManifestParams: (params: TParams) => Extract<SkyboxManifestLayer, { type: TType }>["params"];
  transformCapabilities?: EffectLayerTransformCapabilities;
  runtime: {
    getTopologyKey: (layer: Extract<EffectLayer, { type: TType }>) => unknown;
    updateLayerParams: (
      skybox: Skybox,
      layer: Extract<EffectLayer, { type: TType }>,
      manifestLayer: Extract<SkyboxManifestLayer, { type: TType }>
    ) => void;
  };
  type: TType;
};

export type EffectLayerAdapter<TType extends EffectLayerType, TParams> = {
  getDefaultName: (index: number) => string;
  load: (serialized: { params: TParams; type: TType }) => TParams;
  serialize: (params: TParams) => { params: TParams; type: TType };
  type: TType;
};

export function cloneGradientState(gradient: GradientState): GradientState {
  return {
    ...gradient,
    stops: gradient.stops.map((stop) => ({
      ...stop,
      midpoint: stop.midpoint ?? 50,
    })),
  };
}

export function cloneFieldGradientState(fieldGradient: FieldGradientState): FieldGradientState {
  return {
    ...fieldGradient,
    anchors: fieldGradient.anchors.map((anchor) => ({ ...anchor })),
  };
}

function cloneImagePlacement(placement: ImageState["placement"]): ImageState["placement"] {
  if (!placement) {
    return null;
  }

  return normalizeImagePlacement(placement);
}

export function cloneImageState(image: ImageState): ImageState {
  return {
    ...image,
    assetId: image.assetId ?? null,
    pixels: image.pixels ? [...image.pixels] : null,
    placement: cloneImagePlacement(image.placement),
    src: image.src ?? null,
  };
}

export function cloneSpotState(spot: SpotState): SpotState {
  const normalizedSpot = normalizeSpotParams(spot);

  return {
    ...normalizedSpot,
    selectedStopId: spot.selectedStopId ?? "spot-start",
    stops: normalizedSpot.stops.map((stop, index) => ({
      ...stop,
      id: spot.stops[index]?.id ?? `spot-stop-${index}`,
      midpoint: stop.midpoint ?? 50,
    })),
  };
}

export function cloneStarfieldState(starfield: StarfieldState): StarfieldState {
  const normalized = normalizeStarfieldParams(starfield);
  const sourceAnchors = starfield.nebulaField?.anchors ?? [];
  const anchors = normalized.nebulaField.anchors.map((anchor, index) => ({
    ...anchor,
    id: sourceAnchors[index]?.id ?? `starfield-field-${index}`,
  }));

  return {
    ...normalized,
    nebulaField: {
      ...normalized.nebulaField,
      anchors,
      selectedAnchorId:
        starfield.nebulaField?.selectedAnchorId &&
        anchors.some((anchor) => anchor.id === starfield.nebulaField.selectedAnchorId)
          ? starfield.nebulaField.selectedAnchorId
          : anchors[0]?.id ?? "starfield-field-0",
    },
  };
}

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
  const starfield = cloneStarfieldState(params);

  return normalizeStarfieldParams({
    clip: starfield.clip,
    nebula: starfield.nebula,
    nebulaField: {
      amplitude: starfield.nebulaField.amplitude,
      anchors: starfield.nebulaField.anchors.map((anchor) => ({
        color: anchor.color,
        x: anchor.x,
        y: anchor.y,
      })),
      frequency: starfield.nebulaField.frequency,
      mode: starfield.nebulaField.mode,
      power: starfield.nebulaField.power,
    },
    stars: starfield.stars,
  });
}

export const gradientLayerAddon: EffectLayerAddon<"gradient", GradientState> = {
  cloneParams: cloneGradientState,
  displayName: "Gradient",
  getDefaultName: () => "Gradient",
  iconName: "gradient",
  load: (serialized) => cloneGradientState(serialized.params),
  panelId: "gradient",
  serialize: (params) => ({ params: cloneGradientState(params), type: "gradient" }),
  selectedStateKey: "gradient",
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
  displayName: "Field Gradient",
  getDefaultName: () => "Field Gradient",
  iconName: "field-gradient",
  load: (serialized) => cloneFieldGradientState(serialized.params),
  panelId: "field-gradient",
  serialize: (params) => ({ params: cloneFieldGradientState(params), type: "field-gradient" }),
  selectedStateKey: "fieldGradient",
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
  iconName: "image",
  load: (serialized) => cloneImageState(serialized.params),
  panelId: "image",
  serialize: (params) => ({ params: cloneImageState(params), type: "image" }),
  selectedStateKey: "image",
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
  displayName: "Spot",
  getDefaultName: () => "Spot",
  iconName: "spot",
  load: (serialized) => cloneSpotState(serialized.params),
  panelId: "spot",
  serialize: (params) => ({ params: cloneSpotState(params), type: "spot" }),
  selectedStateKey: "spot",
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
  displayName: "Starfield",
  getDefaultName: () => "Starfield",
  iconName: "starfield",
  load: (serialized) => cloneStarfieldState(serialized.params),
  panelId: "starfield",
  serialize: (params) => ({ params: cloneStarfieldState(params), type: "starfield" }),
  selectedStateKey: "starfield",
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

export const gradientLayerAdapter = gradientLayerAddon;
export const fieldGradientLayerAdapter = fieldGradientLayerAddon;
export const imageLayerAdapter = imageLayerAddon;
export const spotLayerAdapter = spotLayerAddon;
export const starfieldLayerAdapter = starfieldLayerAddon;

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
  const baseLayer = {
    blendMode: normalizeBlendMode(serialized.blendMode),
    enabled: serialized.enabled,
    id: serialized.id,
    locked: serialized.locked ?? false,
    name: serialized.name,
    opacity: serialized.opacity ?? 100,
    type: serialized.effect.type,
  };

  if (serialized.effect.type === "gradient") {
    return {
      ...baseLayer,
      params: addon.load(serialized.effect as never) as GradientState,
      type: serialized.effect.type,
    };
  }

  if (serialized.effect.type === "field-gradient") {
    return {
      ...baseLayer,
      params: addon.load(serialized.effect as never) as FieldGradientState,
      type: serialized.effect.type,
    };
  }

  if (serialized.effect.type === "image") {
    return {
      ...baseLayer,
      params: addon.load(serialized.effect as never) as ImageState,
      type: serialized.effect.type,
    };
  }

  if (serialized.effect.type === "starfield") {
    return {
      ...baseLayer,
      params: addon.load(serialized.effect as never) as StarfieldState,
      type: serialized.effect.type,
    };
  }

  return {
    ...baseLayer,
    params: addon.load(serialized.effect as never) as SpotState,
    type: serialized.effect.type,
  };
}
