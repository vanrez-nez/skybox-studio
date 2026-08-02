import {
  createDefaultSunParams,
  normalizeSunParams,
  type SkyboxSunParams,
  type VectorTuple,
} from "@/runtime";

export type SunNumericParameterKey =
  | "aureoleReach"
  | "aureoleStrength"
  | "coronaGain"
  | "coronaStructure"
  | "exposure";

// Resolution outputs (`resolvedOccluder*`) never enter editor state — the
// runtime resolver owns them (same rule as the clouds `resolved*` fields).
export type SunState = Omit<
  SkyboxSunParams,
  "resolvedOccluderAngularRadius" | "resolvedOccluderDirection"
>;

// Reference implementation slider ranges (reach re-expressed in photosphere
// radii so it scales with the stylized sun size).
export const SUN_PARAMETER_LIMITS: Record<
  SunNumericParameterKey,
  { max: number; min: number; step: number }
> = {
  aureoleReach: { min: 1.2, max: 30, step: 0.1 },
  aureoleStrength: { min: 0, max: 6, step: 0.02 },
  coronaGain: { min: 0, max: 26, step: 0.1 },
  coronaStructure: { min: 0, max: 1, step: 0.01 },
  exposure: { min: -2, max: 24, step: 0.05 },
};

function stripResolvedFields(params: SkyboxSunParams): SunState {
  const {
    resolvedOccluderAngularRadius: _radius,
    resolvedOccluderDirection: _direction,
    ...state
  } = params;

  return state;
}

export function createDefaultSunState(centerDirection?: VectorTuple): SunState {
  return centerDirection
    ? stripResolvedFields(
        normalizeSunParams({ ...createDefaultSunParams(), centerDirection }),
      )
    : createDefaultSunParams();
}

export function cloneSunState(params: SunState): SunState {
  return stripResolvedFields(normalizeSunParams(params));
}
