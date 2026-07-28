import type { SkyboxCloudsParams, VectorTuple } from "@/runtime";
import { clampRange, clampUnit } from "@/effects/layers/primitives";

// The editor params are the runtime params verbatim — clouds carry no editor-only fields, so
// `toManifestParams` is a straight pass-through.
export type CloudsState = SkyboxCloudsParams;

export type CloudsNumericParameterKey =
  | "coverage"
  | "density"
  | "elevation"
  | "phase"
  | "scale"
  | "speed";

export const CLOUDS_PARAMETER_LIMITS: Record<
  CloudsNumericParameterKey,
  { max: number; min: number }
> = {
  coverage: { min: 0, max: 1 },
  density: { min: 0, max: 1 },
  elevation: { min: 0, max: 1 },
  // Phase is unbounded in principle; this range is what the slider offers.
  phase: { min: 0, max: 1000 },
  // SkyMesh's natural scale is ~0.0002. The panel works in friendlier units and converts.
  scale: { min: 0.00002, max: 0.002 },
  speed: { min: 0, max: 0.01 },
};

export function createDefaultCloudsState(): CloudsState {
  return {
    color: "#ffffff",
    coverage: 0.4,
    density: 0.9,
    elevation: 0.5,
    phase: 0,
    // SkyMesh defaults to 0.0002, which lands sub-cell near the zenith and reads as an almost flat
    // wash here. This shows cloud structure straight away.
    scale: 0.001,
    shadowColor: "#6b7280",
    speed: 0.0001,
    sunDirection: [0, 1, 0],
  };
}

// Doubles as the normalizer — the store runs this on every param write.
export function cloneCloudsState(clouds: CloudsState): CloudsState {
  return {
    ...clouds,
    coverage: clampUnit(clouds.coverage),
    density: clampUnit(clouds.density),
    elevation: clampUnit(clouds.elevation),
    scale: Math.max(clouds.scale, 0),
    speed: Math.max(clouds.speed, 0),
    sunDirection: [...clouds.sunDirection] as VectorTuple,
  };
}

export function clampCloudsParameter(parameter: CloudsNumericParameterKey, value: number) {
  const limits = CLOUDS_PARAMETER_LIMITS[parameter];

  return clampRange(value, limits.min, limits.max);
}
