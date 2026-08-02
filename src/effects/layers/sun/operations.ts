import {
  radiusScaleFromSun,
  sunFromRadiusScale,
  type VectorTuple,
} from "@/runtime";
import {
  SUN_PARAMETER_LIMITS,
  type SunNumericParameterKey,
  type SunState,
} from "@/effects/layers/sun/state";

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function setSunNumericParameter(
  params: SunState,
  parameter: SunNumericParameterKey,
  value: number,
): SunState {
  const limits = SUN_PARAMETER_LIMITS[parameter];
  const nextValue = clampRange(value, limits.min, limits.max);

  if (params[parameter] === nextValue) {
    return params;
  }

  return { ...params, [parameter]: nextValue };
}

export function setSunPosition(params: SunState, centerDirection: VectorTuple): SunState {
  return { ...params, centerDirection };
}

export function setSunRadiusScale(params: SunState, radiusScale: number): SunState {
  const currentScale = radiusScaleFromSun(params);
  const nextScale = Math.max(0.01, radiusScale);

  if (currentScale === nextScale) {
    return params;
  }

  return {
    ...params,
    angularRadius: sunFromRadiusScale(params, nextScale).angularRadius,
  };
}

/** The reference's "new corona" reroll: a fresh seed and axis. */
export function setSunCorona(params: SunState, seed: number, axis: number): SunState {
  const nextSeed = clampRange(seed, 0, 1000) % 100;
  const nextAxis = clampRange(axis, 0, Math.PI);

  if (params.coronaSeed === nextSeed && params.coronaAxis === nextAxis) {
    return params;
  }

  return { ...params, coronaAxis: nextAxis, coronaSeed: nextSeed };
}

export function setSunOccluderReference(
  params: SunState,
  occluderLayerId: string | null,
): SunState {
  if (params.occluderLayerId === occluderLayerId) {
    return params;
  }

  return { ...params, occluderLayerId };
}
