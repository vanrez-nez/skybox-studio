export type TerrainParams = {
  creaseRounding: number;
  erosionDetail: number;
  erosionOctaves: number;
  erosionScale: number;
  erosionStrength: number;
  extent: number;
  frequency: number;
  gain: number;
  gullyWeight: number;
  height: number;
  octaves: number;
  ridgeRounding: number;
  roughness: number;
  seed: number;
};

export function createDefaultTerrainParams(): TerrainParams {
  return {
    creaseRounding: 0,
    erosionDetail: 1.5,
    erosionOctaves: 5,
    erosionScale: 0.15,
    erosionStrength: 0.22,
    // The rim must sit well beyond the scene's fog far distance, otherwise the terrain's outer edge
    // is visible as a hard line against the sky instead of fading out.
    extent: 2400,
    frequency: 3,
    gain: 0.1,
    gullyWeight: 0.5,
    height: 400,
    octaves: 3,
    ridgeRounding: 0.1,
    roughness: 1,
    seed: 1337,
  };
}

const TERRAIN_PARAM_KEYS = [
  "creaseRounding",
  "erosionDetail",
  "erosionOctaves",
  "erosionScale",
  "erosionStrength",
  "extent",
  "frequency",
  "gain",
  "gullyWeight",
  "height",
  "octaves",
  "ridgeRounding",
  "roughness",
  "seed",
] as const;

// Scenario state is persisted independently of releases. Pick only current finite numeric fields so
// old Low/High colour values disappear naturally and partial records receive the new erosion defaults.
export function resolveTerrainParams(value: unknown): TerrainParams {
  const defaults = createDefaultTerrainParams();

  if (!value || typeof value !== "object") {
    return defaults;
  }

  const stored = value as Record<string, unknown>;
  const resolved = { ...defaults };

  for (const key of TERRAIN_PARAM_KEYS) {
    const candidate = stored[key];

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      resolved[key] = candidate;
    }
  }

  return resolved;
}
