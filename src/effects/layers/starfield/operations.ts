import type { SkyboxStarfieldClipParams } from "@/runtime";
import { clampRange, clampUnit } from "@/effects/layers/primitives";
import { createRandomFieldAnchors } from "@/effects/layers/field-gradient/state";
import {
  cloneStarfieldState,
  createDefaultStarfieldState,
  type StarfieldClipParameterKey,
  type StarfieldColor,
  type StarfieldFieldAnchor,
  type StarfieldFieldMode,
  type StarfieldNebulaColorKey,
  type StarfieldNebulaParameterKey,
  type StarfieldQuality,
  type StarfieldStarsParameterKey,
  type StarfieldState,
} from "@/effects/layers/starfield/state";

function normalized(starfield: StarfieldState): StarfieldState {
  return cloneStarfieldState(starfield);
}

export function setStarfieldQuality(
  params: StarfieldState,
  quality: StarfieldQuality
): StarfieldState {
  return normalized({ ...params, quality });
}

export function setStarfieldClip(
  params: StarfieldState,
  clip: SkyboxStarfieldClipParams
): StarfieldState {
  return normalized({ ...params, clip });
}

export function setStarfieldClipParameter(
  params: StarfieldState,
  parameter: StarfieldClipParameterKey,
  value: number
): StarfieldState {
  return normalized({
    ...params,
    clip: { ...params.clip, [parameter]: value },
  });
}

export function setStarfieldStarsParameter(
  params: StarfieldState,
  parameter: StarfieldStarsParameterKey,
  value: number
): StarfieldState {
  return normalized({
    ...params,
    stars: { ...params.stars, [parameter]: value },
  });
}

export function setStarfieldNebulaParameter(
  params: StarfieldState,
  parameter: StarfieldNebulaParameterKey,
  value: number
): StarfieldState {
  return normalized({
    ...params,
    nebula: { ...params.nebula, [parameter]: value },
  });
}

export function setStarfieldNebulaColor(
  params: StarfieldState,
  parameter: StarfieldNebulaColorKey,
  color: StarfieldColor
): StarfieldState {
  return normalized({
    ...params,
    nebula: { ...params.nebula, [parameter]: color },
  });
}

export function setStarfieldFieldAmplitude(
  params: StarfieldState,
  amplitude: number
): StarfieldState {
  return normalized({
    ...params,
    nebulaField: { ...params.nebulaField, amplitude: clampRange(amplitude, 0, 0.6) },
  });
}

export function setStarfieldFieldFrequency(
  params: StarfieldState,
  frequency: number
): StarfieldState {
  return normalized({
    ...params,
    nebulaField: { ...params.nebulaField, frequency: clampRange(frequency, 0.3, 4) },
  });
}

export function setStarfieldFieldMode(
  params: StarfieldState,
  mode: StarfieldFieldMode
): StarfieldState {
  return normalized({
    ...params,
    nebulaField: { ...params.nebulaField, mode },
  });
}

export function setStarfieldFieldPower(params: StarfieldState, power: number): StarfieldState {
  return normalized({
    ...params,
    nebulaField: { ...params.nebulaField, power: clampRange(power, 0.4, 6) },
  });
}

export function addStarfieldFieldAnchor(
  params: StarfieldState,
  anchor: Omit<StarfieldFieldAnchor, "id">
): StarfieldState {
  if (params.nebulaField.anchors.length >= 8) {
    return params;
  }

  const nextAnchor = {
    ...anchor,
    id: `starfield-field-${Date.now()}`,
    x: clampUnit(anchor.x),
    y: clampUnit(anchor.y),
  };

  return normalized({
    ...params,
    nebulaField: {
      ...params.nebulaField,
      anchors: [...params.nebulaField.anchors, nextAnchor],
      selectedAnchorId: nextAnchor.id,
    },
  });
}

export function randomizeStarfieldField(params: StarfieldState): StarfieldState {
  const nextAnchors = createRandomFieldAnchors(params.nebulaField.anchors.length);

  return normalized({
    ...params,
    nebulaField: {
      ...params.nebulaField,
      anchors: nextAnchors.map((anchor) => ({
        ...anchor,
        id: anchor.id.replace("field-", "starfield-field-"),
      })),
      selectedAnchorId: nextAnchors[0]?.id.replace("field-", "starfield-field-") ?? "",
    },
  });
}

export function removeStarfieldFieldAnchor(params: StarfieldState, id: string): StarfieldState {
  if (params.nebulaField.anchors.length <= 1) {
    return params;
  }

  const nextAnchors = params.nebulaField.anchors.filter((anchor) => anchor.id !== id);

  if (nextAnchors.length === params.nebulaField.anchors.length) {
    return params;
  }

  return normalized({
    ...params,
    nebulaField: {
      ...params.nebulaField,
      anchors: nextAnchors,
      selectedAnchorId:
        params.nebulaField.selectedAnchorId === id
          ? nextAnchors[0].id
          : params.nebulaField.selectedAnchorId,
    },
  });
}

export function resetStarfieldField(params: StarfieldState): StarfieldState {
  return normalized({
    ...params,
    nebulaField: createDefaultStarfieldState().nebulaField,
  });
}

export function selectStarfieldFieldAnchor(params: StarfieldState, id: string): StarfieldState {
  if (params.nebulaField.selectedAnchorId === id) {
    return params;
  }

  return {
    ...params,
    nebulaField: { ...params.nebulaField, selectedAnchorId: id },
  };
}

export function updateStarfieldFieldAnchor(
  params: StarfieldState,
  id: string,
  update: Partial<Omit<StarfieldFieldAnchor, "id">>
): StarfieldState {
  if (!params.nebulaField.anchors.some((anchor) => anchor.id === id)) {
    return params;
  }

  return normalized({
    ...params,
    nebulaField: {
      ...params.nebulaField,
      anchors: params.nebulaField.anchors.map((anchor) =>
        anchor.id === id
          ? {
              ...anchor,
              ...update,
              x: update.x === undefined ? anchor.x : clampUnit(update.x),
              y: update.y === undefined ? anchor.y : clampUnit(update.y),
            }
          : anchor
      ),
    },
  });
}
