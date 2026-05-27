import type { FieldGradientState, GradientState, ImageState, SpotState } from "@/store/modules/layers";
import {
  normalizeBlendMode,
  type EffectLayerBlendMode,
} from "@/effects/blend-modes";
import { normalizeImagePlacement } from "@/runtime/image-placement-transform";
import { normalizeSpotParams } from "@/runtime/spot-transform";

export type EffectLayerType = "gradient" | "field-gradient" | "image" | "spot";
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

export type SerializedEffectLayer = {
  blendMode?: EffectLayerBlendMode;
  effect:
    | SerializedGradientEffect
    | SerializedFieldGradientEffect
    | SerializedImageEffect
    | SerializedSpotEffect;
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
    };

export type EffectLayerFocusTarget = {
  direction: [number, number, number];
  type: "direction";
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

function isFiniteDirection(direction: [number, number, number]) {
  return direction.every(Number.isFinite) && direction.some((component) => component !== 0);
}

export function getEffectLayerFocusTarget(
  layer: EffectLayer | undefined
): EffectLayerFocusTarget | null {
  if (
    !layer ||
    layer.type !== "image" ||
    !layer.enabled ||
    !layer.params.src ||
    !layer.params.placement
  ) {
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

export const spotLayerAdapter: EffectLayerAdapter<"spot", SpotState> = {
  getDefaultName: () => "Spot",
  load: (serialized) => cloneSpotState(serialized.params),
  serialize: (params) => ({ params: cloneSpotState(params), type: "spot" }),
  type: "spot",
};

export function serializeEffectLayer(layer: EffectLayer): SerializedEffectLayer {
  return {
    blendMode: layer.blendMode,
    effect:
      layer.type === "gradient"
        ? gradientLayerAdapter.serialize(layer.params)
        : layer.type === "field-gradient"
          ? fieldGradientLayerAdapter.serialize(layer.params)
          : layer.type === "image"
            ? imageLayerAdapter.serialize(layer.params)
            : spotLayerAdapter.serialize(layer.params),
    enabled: layer.enabled,
    id: layer.id,
    locked: layer.locked,
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
      locked: serialized.locked ?? false,
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
      locked: serialized.locked ?? false,
      name: serialized.name,
      opacity: serialized.opacity ?? 100,
      params: fieldGradientLayerAdapter.load(serialized.effect),
      type: "field-gradient",
    };
  }

  if (serialized.effect.type === "image") {
    return {
      blendMode: normalizeBlendMode(serialized.blendMode),
      enabled: serialized.enabled,
      id: serialized.id,
      locked: serialized.locked ?? false,
      name: serialized.name,
      opacity: serialized.opacity ?? 100,
      params: imageLayerAdapter.load(serialized.effect),
      type: "image",
    };
  }

  return {
    blendMode: normalizeBlendMode(serialized.blendMode),
    enabled: serialized.enabled,
    id: serialized.id,
    locked: serialized.locked ?? false,
    name: serialized.name,
    opacity: serialized.opacity ?? 100,
    params: spotLayerAdapter.load(serialized.effect),
    type: "spot",
  };
}
