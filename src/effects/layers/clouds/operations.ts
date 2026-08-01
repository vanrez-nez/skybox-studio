import {
  cloneSkyboxCloudsParams,
  type SkyboxCloudLightParams,
  type SkyboxCloudMotionMode,
  type VectorTuple,
} from "@/runtime";
import {
  CLOUDS_FIELD_LIMITS,
  CLOUDS_LAYER_LIMITS,
  CLOUDS_ROOT_LIMITS,
  type CloudsFieldNumericKey,
  type CloudsLayerNumericKey,
  type CloudsRootNumericKey,
  type CloudsState,
} from "./state";

type CloudLayerName = "cloudHigh" | "cloudLow";
type CloudLightName = "moon" | "sun";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function setRootParameter(
  params: CloudsState,
  key: CloudsRootNumericKey,
  value: number,
): CloudsState {
  const limits = CLOUDS_ROOT_LIMITS[key];
  const next = clamp(value, limits.min, limits.max);
  if (params[key] === next) return params;
  return { ...params, [key]: next };
}

export function setCloudLayerParameter(
  params: CloudsState,
  layer: CloudLayerName,
  key: CloudsLayerNumericKey,
  value: number,
): CloudsState {
  const limits = CLOUDS_LAYER_LIMITS[key];
  const next = clamp(value, limits.min, limits.max);
  if (params[layer][key] === next) return params;
  return { ...params, [layer]: { ...params[layer], [key]: next } };
}

export function setCloudLayerEnabled(
  params: CloudsState,
  layer: CloudLayerName,
  enabled: boolean,
): CloudsState {
  if (params[layer].enabled === enabled) return params;
  return { ...params, [layer]: { ...params[layer], enabled } };
}

export function setFieldParameter(
  params: CloudsState,
  key: CloudsFieldNumericKey,
  value: number,
): CloudsState {
  const limits = CLOUDS_FIELD_LIMITS[key];
  const next = clamp(value, limits.min, limits.max);
  if (params.field[key] === next) return params;
  return { ...params, field: { ...params.field, [key]: next } };
}

export function setMotionMode(
  params: CloudsState,
  motionMode: SkyboxCloudMotionMode,
): CloudsState {
  return params.motionMode === motionMode ? params : { ...params, motionMode };
}

export function setDebugLayers(
  params: CloudsState,
  debugLayers: boolean,
): CloudsState {
  return params.debugLayers === debugLayers
    ? params
    : { ...params, debugLayers };
}

function updateLight(
  params: CloudsState,
  light: CloudLightName,
  update: Partial<SkyboxCloudLightParams>,
): CloudsState {
  const current = params[light];
  const changed = Object.entries(update).some(
    ([key, value]) => current[key as keyof SkyboxCloudLightParams] !== value,
  );
  return changed ? { ...params, [light]: { ...current, ...update } } : params;
}

export function setLightIntensity(
  params: CloudsState,
  light: CloudLightName,
  intensity: number,
): CloudsState {
  return updateLight(params, light, { intensity: clamp(intensity, 0, 100) });
}

export function setLightTint(
  params: CloudsState,
  light: CloudLightName,
  tint: string,
): CloudsState {
  return updateLight(params, light, { tint });
}

export function setLightDisc(
  params: CloudsState,
  light: CloudLightName,
  disc: boolean,
): CloudsState {
  return updateLight(params, light, { disc });
}

export function setLightDirection(
  params: CloudsState,
  light: CloudLightName,
  direction: VectorTuple,
): CloudsState {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  const next: VectorTuple =
    length > 1e-8
      ? [direction[0] / length, direction[1] / length, direction[2] / length]
      : [0, 1, 0];
  const current = params[light].direction;
  if (current.every((component, index) => component === next[index])) return params;
  return updateLight(params, light, { direction: next });
}

export function setLightReference(
  params: CloudsState,
  light: CloudLightName,
  directionLayerId: string | null,
  resolvedDirection?: VectorTuple,
): CloudsState {
  return updateLight(params, light, {
    directionLayerId,
    ...(resolvedDirection ? { direction: resolvedDirection } : {}),
  });
}

export function applyPreset(
  _params: CloudsState,
  preset: CloudsState,
): CloudsState {
  return cloneSkyboxCloudsParams(preset);
}
