import {
  DEFAULT_STARFIELD_PARAMS,
  normalizeStarfieldParams,
  type SkyboxStarfieldClipParams,
  type SkyboxStarfieldNebulaParams,
  type SkyboxStarfieldParams,
  type SkyboxStarfieldQuality,
  type SkyboxStarfieldStarsParams,
} from "@/runtime";
import {
  createDefaultFieldGradientState,
  type FieldGradientAnchor,
  type FieldGradientMode,
  type FieldGradientState,
} from "@/effects/layers/field-gradient/state";

export type StarfieldState = Omit<SkyboxStarfieldParams, "nebulaField"> & {
  nebulaField: FieldGradientState;
};
export type StarfieldColor = [number, number, number];
export type StarfieldQuality = SkyboxStarfieldQuality;
export type StarfieldStarsParameterKey = keyof SkyboxStarfieldStarsParams;
export type StarfieldNebulaParameterKey = {
  [K in keyof SkyboxStarfieldNebulaParams]: SkyboxStarfieldNebulaParams[K] extends number ? K : never;
}[keyof SkyboxStarfieldNebulaParams];
export type StarfieldNebulaColorKey = {
  [K in keyof SkyboxStarfieldNebulaParams]: SkyboxStarfieldNebulaParams[K] extends StarfieldColor ? K : never;
}[keyof SkyboxStarfieldNebulaParams];
export type StarfieldClipParameterKey = keyof SkyboxStarfieldClipParams;

export function createFieldStateFromRuntime(raw: unknown): FieldGradientState {
  const normalizedRuntime = normalizeStarfieldParams({
    ...DEFAULT_STARFIELD_PARAMS,
    nebulaField: raw as never,
  }).nebulaField;
  const anchors = normalizedRuntime.anchors.map((anchor, index) => ({
    ...anchor,
    id: (raw as any)?.anchors?.[index]?.id ?? `starfield-field-${index}`,
  }));

  return {
    ...normalizedRuntime,
    anchors,
    selectedAnchorId:
      (raw as any)?.selectedAnchorId && anchors.some((anchor) => anchor.id === (raw as any).selectedAnchorId)
        ? (raw as any).selectedAnchorId
        : anchors[0]?.id ?? "starfield-field-0",
  };
}

export function cloneStarfieldState(starfield: StarfieldState): StarfieldState {
  const normalized = normalizeStarfieldParams(starfield);
  const nebulaField = createFieldStateFromRuntime(starfield.nebulaField);

  return {
    ...normalized,
    nebulaField,
  };
}

export function createDefaultStarfieldState(): StarfieldState {
  const normalized = normalizeStarfieldParams(DEFAULT_STARFIELD_PARAMS);
  const defaultField = createFieldStateFromRuntime(normalized.nebulaField);

  return {
    ...normalized,
    nebulaField: defaultField.anchors.length ? defaultField : createDefaultFieldGradientState(),
  };
}

function manifestCompatibleStarfield(starfield: StarfieldState): SkyboxStarfieldParams {
  return {
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
    quality: starfield.quality,
    stars: starfield.stars,
  };
}

export function starfieldStateToManifestParams(starfield: StarfieldState): SkyboxStarfieldParams {
  return normalizeStarfieldParams(manifestCompatibleStarfield(cloneStarfieldState(starfield)));
}

export type {
  FieldGradientAnchor as StarfieldFieldAnchor,
  FieldGradientMode as StarfieldFieldMode,
};
