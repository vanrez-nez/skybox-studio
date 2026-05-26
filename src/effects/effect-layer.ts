import type { FieldGradientState, GradientState, ImageState } from "@/store/modules/layers";
import {
  normalizeBlendMode,
  type EffectLayerBlendMode,
} from "@/effects/blend-modes";
import { normalizeImagePlacement } from "@/runtime/image-placement-transform";

export type EffectLayerType = "gradient" | "field-gradient" | "image";
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

export type SerializedEffectLayer = {
  blendMode?: EffectLayerBlendMode;
  effect: SerializedGradientEffect | SerializedFieldGradientEffect | SerializedImageEffect;
  enabled: boolean;
  id: string;
  name: string;
  opacity?: number;
};

export type EffectLayer =
  | {
      blendMode: EffectLayerBlendMode;
      enabled: boolean;
      id: string;
      name: string;
      opacity: number;
      params: GradientState;
      type: "gradient";
    }
  | {
      blendMode: EffectLayerBlendMode;
      enabled: boolean;
      id: string;
      name: string;
      opacity: number;
      params: FieldGradientState;
      type: "field-gradient";
    }
  | {
      blendMode: EffectLayerBlendMode;
      enabled: boolean;
      id: string;
      name: string;
      opacity: number;
      params: ImageState;
      type: "image";
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

export const gradientLayerAdapter: EffectLayerAdapter<"gradient", GradientState> = {
  getDefaultName: () => "Gradient",
  load: (serialized) => cloneGradientState(serialized.params),
  serialize: (params) => ({ params: cloneGradientState(params), type: "gradient" }),
  type: "gradient",
};

export const fieldGradientLayerAdapter: EffectLayerAdapter<"field-gradient", FieldGradientState> = {
  getDefaultName: () => "Field Gradient",
  load: (serialized) => cloneFieldGradientState(serialized.params),
  serialize: (params) => ({ params: cloneFieldGradientState(params), type: "field-gradient" }),
  type: "field-gradient",
};

export const imageLayerAdapter: EffectLayerAdapter<"image", ImageState> = {
  getDefaultName: () => "Image",
  load: (serialized) => cloneImageState(serialized.params),
  serialize: (params) => ({ params: cloneImageState(params), type: "image" }),
  type: "image",
};

export function serializeEffectLayer(layer: EffectLayer): SerializedEffectLayer {
  return {
    blendMode: layer.blendMode,
    effect:
      layer.type === "gradient"
        ? gradientLayerAdapter.serialize(layer.params)
        : layer.type === "field-gradient"
          ? fieldGradientLayerAdapter.serialize(layer.params)
          : imageLayerAdapter.serialize(layer.params),
    enabled: layer.enabled,
    id: layer.id,
    name: layer.name,
    opacity: layer.opacity,
  };
}

export function loadEffectLayer(serialized: SerializedEffectLayer): EffectLayer {
  if (serialized.effect.type === "gradient") {
    return {
      blendMode: normalizeBlendMode(serialized.blendMode),
      enabled: serialized.enabled,
      id: serialized.id,
      name: serialized.name,
      opacity: serialized.opacity ?? 100,
      params: gradientLayerAdapter.load(serialized.effect),
      type: "gradient",
    };
  }

  if (serialized.effect.type === "field-gradient") {
    return {
      blendMode: normalizeBlendMode(serialized.blendMode),
      enabled: serialized.enabled,
      id: serialized.id,
      name: serialized.name,
      opacity: serialized.opacity ?? 100,
      params: fieldGradientLayerAdapter.load(serialized.effect),
      type: "field-gradient",
    };
  }

  return {
    blendMode: normalizeBlendMode(serialized.blendMode),
    enabled: serialized.enabled,
    id: serialized.id,
    name: serialized.name,
    opacity: serialized.opacity ?? 100,
    params: imageLayerAdapter.load(serialized.effect),
    type: "image",
  };
}
