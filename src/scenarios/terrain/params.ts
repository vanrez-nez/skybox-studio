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
  octaves: number;
  reliefHeight: number;
  ridgeRounding: number;
  roughness: number;
  seed: number;
};

export function createDefaultTerrainParams(): TerrainParams {
  return {
    creaseRounding: 0,
    erosionDetail: 1.5,
    erosionOctaves: 5,
    // Runevision's animated showcase reaches 0.08 for the crisp, densely branching state used in
    // the reference mountain views. At 512² this is also the finest scale we can resolve safely.
    erosionScale: 0.08,
    erosionStrength: 0.22,
    // The rim must sit well beyond the scene's fog far distance, otherwise the terrain's outer edge
    // is visible as a hard line against the sky instead of fading out.
    extent: 2400,
    frequency: 3,
    gain: 0.1,
    gullyWeight: 0.5,
    octaves: 3,
    // The source heightfield uses the same normalized horizontal and vertical scale. Keeping that
    // 1:1 contract is what makes its analytic slopes, material classification and rendered relief
    // describe the same surface.
    reliefHeight: 2400,
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
  "octaves",
  "reliefHeight",
  "ridgeRounding",
  "roughness",
  "seed",
] as const;

// Scenario state is persisted independently of releases. Pick only current finite numeric fields so
// old Low/High colour values and the old flattened `height` field disappear naturally. Renaming the
// latter is intentional: persisted 400-unit previews must migrate to the mountain-scale default.
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
