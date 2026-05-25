import type { FieldGradientState, GradientState } from "@/store/workspace-store";

export type EffectLayerType = "gradient" | "field-gradient";

export type SerializedGradientEffect = {
  params: GradientState;
  type: "gradient";
};

export type SerializedFieldGradientEffect = {
  params: FieldGradientState;
  type: "field-gradient";
};

export type SerializedEffectLayer = {
  effect: SerializedGradientEffect | SerializedFieldGradientEffect;
  enabled: boolean;
  id: string;
  name: string;
};

export type EffectLayer =
  | {
      enabled: boolean;
      id: string;
      name: string;
      params: GradientState;
      type: "gradient";
    }
  | {
      enabled: boolean;
      id: string;
      name: string;
      params: FieldGradientState;
      type: "field-gradient";
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

export function serializeEffectLayer(layer: EffectLayer): SerializedEffectLayer {
  return {
    effect:
      layer.type === "gradient"
        ? gradientLayerAdapter.serialize(layer.params)
        : fieldGradientLayerAdapter.serialize(layer.params),
    enabled: layer.enabled,
    id: layer.id,
    name: layer.name,
  };
}

export function loadEffectLayer(serialized: SerializedEffectLayer): EffectLayer {
  return serialized.effect.type === "gradient"
    ? {
        enabled: serialized.enabled,
        id: serialized.id,
        name: serialized.name,
        params: gradientLayerAdapter.load(serialized.effect),
        type: "gradient",
      }
    : {
        enabled: serialized.enabled,
        id: serialized.id,
        name: serialized.name,
        params: fieldGradientLayerAdapter.load(serialized.effect),
        type: "field-gradient",
      };
}
