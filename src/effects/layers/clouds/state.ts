import {
  cloneSkyboxCloudsParams,
  createDefaultSkyboxCloudsParams,
  type SkyboxCloudLayerParams,
  type SkyboxCloudsParams,
} from "@/runtime";

export type CloudsState = SkyboxCloudsParams;

export type CloudsRootNumericKey =
  | "exposure"
  | "eyeHeight"
  | "km"
  | "kr"
  | "mieDirectionalG"
  | "mistDensity"
  | "mistHeight"
  | "samples";

export type CloudsLayerNumericKey = Exclude<
  keyof SkyboxCloudLayerParams,
  "enabled"
>;

export type CloudsFieldNumericKey = keyof CloudsState["field"];

export const CLOUDS_ROOT_LIMITS: Record<
  CloudsRootNumericKey,
  { max: number; min: number; step: number }
> = {
  kr: { min: 0, max: 0.02, step: 0.0001 },
  km: { min: 0, max: 0.02, step: 0.0001 },
  mieDirectionalG: { min: -0.999, max: 0, step: 0.001 },
  samples: { min: 1, max: 12, step: 1 },
  eyeHeight: { min: 0.0001, max: 0.24, step: 0.0001 },
  mistDensity: { min: 0, max: 1.5, step: 0.01 },
  mistHeight: { min: 0.0005, max: 0.01, step: 0.0005 },
  exposure: { min: 0.1, max: 8, step: 0.1 },
};

export const CLOUDS_LAYER_LIMITS: Record<
  CloudsLayerNumericKey,
  { max: number; min: number; step: number }
> = {
  altitude: { min: 0.004, max: 0.08, step: 0.001 },
  featureSize: { min: 0.01, max: 0.3, step: 0.005 },
  speed: { min: -0.0005, max: 0.0005, step: 0.00001 },
  morphBlend: { min: 0, max: 1, step: 0.01 },
  morphScale: { min: 0.5, max: 4, step: 0.05 },
  morphSpeed: { min: -0.0005, max: 0.0005, step: 0.00001 },
  coverage: { min: 0, max: 1, step: 0.01 },
  density: { min: 0, max: 1, step: 0.01 },
  phaseG: { min: 0, max: 0.95, step: 0.01 },
};

export const CLOUDS_FIELD_LIMITS: Record<
  CloudsFieldNumericKey,
  { max: number; min: number; step: number }
> = {
  size: { min: 64, max: 1024, step: 64 },
  tiles: { min: 2, max: 24, step: 1 },
  octaves: { min: 1, max: 8, step: 1 },
  persistence: { min: 0.2, max: 0.8, step: 0.01 },
  seed: { min: 0, max: 100, step: 1 },
};

export function createDefaultCloudsState(): CloudsState {
  return createDefaultSkyboxCloudsParams();
}

function isCurrentCloudsState(value: unknown): value is CloudsState {
  const candidate = value as Partial<CloudsState> | null;
  return Boolean(
    candidate &&
      candidate.cloudLow &&
      candidate.cloudHigh &&
      candidate.field &&
      candidate.sun &&
      candidate.moon,
  );
}

export function cloneCloudsState(clouds: CloudsState): CloudsState {
  if (!isCurrentCloudsState(clouds)) {
    return createDefaultCloudsState();
  }

  return cloneSkyboxCloudsParams(clouds);
}
