import type { FieldGradientState, GradientState, ImageState } from "@/store/modules/layers";
import {
  normalizeBlendMode,
  type EffectLayerBlendMode,
} from "@/effects/blend-modes";

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
    stops: gradient.stops.map((stop) => ({ ...stop })),
  };
}

export function cloneFieldGradientState(fieldGradient: FieldGradientState): FieldGradientState {
  return {
    ...fieldGradient,
    anchors: fieldGradient.anchors.map((anchor) => ({ ...anchor })),
  };
}

function normalizeTuple(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((component) => typeof component === "number" && Number.isFinite(component))
  ) {
    const length = Math.hypot(value[0], value[1], value[2]);

    if (length > 0) {
      return [value[0] / length, value[1] / length, value[2] / length];
    }
  }

  return fallback;
}

function cloneImagePlacement(placement: ImageState["placement"]): ImageState["placement"] {
  if (!placement) {
    return null;
  }

  const rawPlacement = placement as unknown as {
    angularHeight?: number;
    angularWidth?: number;
    center?: [number, number, number];
    centerDirection?: [number, number, number];
    height?: number;
    normal?: [number, number, number];
    projection?: string;
    tangentX?: [number, number, number];
    tangentY?: [number, number, number];
    width?: number;
  };
  const centerDirection = normalizeTuple(
    rawPlacement.centerDirection ?? rawPlacement.normal ?? rawPlacement.center,
    [0, 0, -1]
  );
  const tangentX = normalizeTuple(rawPlacement.tangentX, [1, 0, 0]);
  const tangentY = normalizeTuple(rawPlacement.tangentY, [0, 1, 0]);
  const legacyDistance = Array.isArray(rawPlacement.center)
    ? Math.max(0.0001, Math.hypot(rawPlacement.center[0], rawPlacement.center[1], rawPlacement.center[2]))
    : 1;
  const angularWidth =
    typeof rawPlacement.angularWidth === "number"
      ? rawPlacement.angularWidth
      : 2 * Math.atan(Math.max(0.0001, rawPlacement.width ?? 0.4) / (2 * legacyDistance));
  const angularHeight =
    typeof rawPlacement.angularHeight === "number"
      ? rawPlacement.angularHeight
      : 2 * Math.atan(Math.max(0.0001, rawPlacement.height ?? 0.3) / (2 * legacyDistance));

  return {
    angularHeight,
    angularWidth,
    centerDirection,
    projection: "angular-decal",
    tangentX,
    tangentY,
  };
}

export function cloneImageState(image: ImageState): ImageState {
  return {
    ...image,
    pixels: image.pixels ? [...image.pixels] : null,
    placement: cloneImagePlacement(image.placement),
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
