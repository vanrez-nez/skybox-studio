import { clampRange, clampUnit } from "@/effects/layers/primitives";
import {
  createDefaultFieldGradientState,
  createRandomFieldAnchors,
  FIELD_GRADIENT_MAX_ANCHORS,
  type FieldGradientAnchor,
  type FieldGradientMode,
  type FieldGradientState,
} from "@/effects/layers/field-gradient/state";

export function addFieldGradientAnchor(
  params: FieldGradientState,
  anchor: Omit<FieldGradientAnchor, "id">
): FieldGradientState {
  if (params.anchors.length >= FIELD_GRADIENT_MAX_ANCHORS) {
    return params;
  }

  const nextAnchor = {
    ...anchor,
    id: `field-${Date.now()}`,
    x: clampUnit(anchor.x),
    y: clampUnit(anchor.y),
  };

  return {
    ...params,
    anchors: [...params.anchors, nextAnchor],
    selectedAnchorId: nextAnchor.id,
  };
}

export function randomizeFieldGradient(params: FieldGradientState): FieldGradientState {
  const nextAnchors = createRandomFieldAnchors(params.anchors.length);

  return {
    ...params,
    anchors: nextAnchors,
    selectedAnchorId: nextAnchors[0].id,
  };
}

export function removeFieldGradientAnchor(
  params: FieldGradientState,
  id: string
): FieldGradientState {
  if (params.anchors.length <= 1) {
    return params;
  }

  const nextAnchors = params.anchors.filter((anchor) => anchor.id !== id);

  if (nextAnchors.length === params.anchors.length) {
    return params;
  }

  return {
    ...params,
    anchors: nextAnchors,
    selectedAnchorId:
      params.selectedAnchorId === id ? nextAnchors[0].id : params.selectedAnchorId,
  };
}

export function resetFieldGradient(): FieldGradientState {
  return createDefaultFieldGradientState();
}

export function selectFieldGradientAnchor(
  params: FieldGradientState,
  id: string
): FieldGradientState {
  if (params.selectedAnchorId === id) {
    return params;
  }

  return { ...params, selectedAnchorId: id };
}

export function setFieldGradientAmplitude(
  params: FieldGradientState,
  amplitude: number
): FieldGradientState {
  const nextAmplitude = clampRange(amplitude, 0, 0.6);

  if (params.amplitude === nextAmplitude) {
    return params;
  }

  return { ...params, amplitude: nextAmplitude };
}

export function setFieldGradientFrequency(
  params: FieldGradientState,
  frequency: number
): FieldGradientState {
  const nextFrequency = clampRange(frequency, 0.3, 4);

  if (params.frequency === nextFrequency) {
    return params;
  }

  return { ...params, frequency: nextFrequency };
}

export function setFieldGradientMode(
  params: FieldGradientState,
  mode: FieldGradientMode
): FieldGradientState {
  if (params.mode === mode) {
    return params;
  }

  return { ...params, mode };
}

export function setFieldGradientPower(
  params: FieldGradientState,
  power: number
): FieldGradientState {
  const nextPower = clampRange(power, 0.4, 6);

  if (params.power === nextPower) {
    return params;
  }

  return { ...params, power: nextPower };
}

export function updateFieldGradientAnchor(
  params: FieldGradientState,
  id: string,
  update: Partial<Omit<FieldGradientAnchor, "id">>
): FieldGradientState {
  if (!params.anchors.some((anchor) => anchor.id === id)) {
    return params;
  }

  return {
    ...params,
    anchors: params.anchors.map((anchor) =>
      anchor.id === id
        ? {
            ...anchor,
            ...update,
            x: update.x === undefined ? anchor.x : clampUnit(update.x),
            y: update.y === undefined ? anchor.y : clampUnit(update.y),
          }
        : anchor
    ),
  };
}
