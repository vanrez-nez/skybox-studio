/*
 * Tiling material textures for the terrain surface.
 *
 * One 512px tile per surface material, tinted at generation with the palette
 * colour that the classification in `surface.ts` assigns to that feature.
 * The tiles repeat every TERRAIN_TILE_WORLD_SIZE metres, so surface detail is
 * resolved at 512 / 96 ≈ 5 texels per metre regardless of the
 * feature map's resolution — the map only decides *where* each material goes,
 * never what it looks like up close.
 *
 * Every noise field is periodic in both axes so the tiles wrap seamlessly.
 */

export const TERRAIN_TILE_RESOLUTION = 512;
// Metres spanned by one tile. Small enough that the near ground reads as
// ground, large enough that the repeat is not obvious at mid distance.
export const TERRAIN_TILE_WORLD_SIZE = 96;

export const TERRAIN_MATERIAL_IDS = ["rock", "dirt", "grass", "snow"] as const;

export type TerrainMaterialId = (typeof TERRAIN_MATERIAL_IDS)[number];

export type TerrainMaterialProfile = {
  /** Cells across the tile for the dominant grain band. */
  baseCells: number;
  /** Linear base colour; the tile is this colour modulated by its grain. */
  color: [number, number, number];
  /** Peak grain modulation around the base colour, 0..1. */
  contrast: number;
  id: TerrainMaterialId;
  /** Weight of the ridged (cracked/veined) component, 0..1. */
  ridged: number;
  seed: number;
  /** Weight of the fine speckle band versus the fractal band, 0..1. */
  speckle: number;
};

/*
 * Base colours are the existing surface palette, unchanged:
 * rock = CLIFF_COLOR, dirt = DIRT_COLOR, snow = the white the classification
 * mixes toward, grass = the midpoint of GRASS_COLOR_1/GRASS_COLOR_2 so the
 * per-texel tint can reach either end of that gradient with a multiplier.
 */
/*
 * The tile is intentionally much broader than the previous 12 m repeat. The reference detail
 * buffer spans the whole terrain and its visible breakup lives at metre-to-gully scales; repeating
 * centimetre grain hid those forms and made the preview look like a material swatch.
 */
export const TERRAIN_MATERIALS: readonly TerrainMaterialProfile[] = [
  {
    baseCells: 18,
    color: [0.22, 0.2, 0.2],
    contrast: 0.24,
    id: "rock",
    ridged: 0.6,
    seed: 0x2e63a9,
    speckle: 0.22,
  },
  {
    baseCells: 22,
    color: [0.6, 0.5, 0.4],
    contrast: 0.18,
    id: "dirt",
    ridged: 0.12,
    seed: 0x71b38d,
    speckle: 0.44,
  },
  {
    baseCells: 28,
    color: [0.275, 0.4, 0.15],
    contrast: 0.22,
    id: "grass",
    ridged: 0,
    seed: 0x4d91c7,
    speckle: 0.72,
  },
  {
    baseCells: 16,
    color: [1, 1, 1],
    contrast: 0.08,
    id: "snow",
    ridged: 0,
    seed: 0x8fa21b,
    speckle: 0.26,
  },
] as const;

export type TerrainMaterialTiles = {
  color: Record<TerrainMaterialId, Uint8Array>;
  normal: Uint8Array;
  resolution: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function wrap(value: number, period: number): number {
  return ((value % period) + period) % period;
}

function hashGrid(x: number, y: number, seed: number): number {
  let value = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ seed;

  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  value ^= value >>> 16;

  return (value >>> 0) / 0xffffffff * 2 - 1;
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function periodicValueNoise(u: number, v: number, cells: number, seed: number): number {
  const x = u * cells;
  const y = v * cells;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const topLeft = hashGrid(wrap(x0, cells), wrap(y0, cells), seed);
  const topRight = hashGrid(wrap(x1, cells), wrap(y0, cells), seed);
  const bottomLeft = hashGrid(wrap(x0, cells), wrap(y1, cells), seed);
  const bottomRight = hashGrid(wrap(x1, cells), wrap(y1, cells), seed);
  const top = topLeft * (1 - tx) + topRight * tx;
  const bottom = bottomLeft * (1 - tx) + bottomRight * tx;

  return top * (1 - ty) + bottom * ty;
}

/**
 * Fractal noise in [-1, 1]. The decay is deliberately shallow (0.62 rather
 * than the usual 0.5) so the fine bands keep enough amplitude to read as
 * surface grain; a steep decay leaves only low-frequency blotches, which is
 * what made the previous single detail tile look like a checkerboard.
 */
function periodicFractalNoise(
  u: number,
  v: number,
  startCells: number,
  maxCells: number,
  seed: number
): number {
  let amplitude = 1;
  let cells = startCells;
  let noise = 0;
  let weight = 0;

  while (cells <= maxCells) {
    noise += periodicValueNoise(u, v, cells, seed + cells) * amplitude;
    weight += amplitude;
    amplitude *= 0.62;
    cells *= 2;
  }

  return weight > 0 ? noise / weight : 0;
}

function materialGrain(
  u: number,
  v: number,
  profile: TerrainMaterialProfile,
  resolution: number
): number {
  const maxCells = Math.max(profile.baseCells, Math.floor(resolution / 2));
  const fractal = periodicFractalNoise(u, v, profile.baseCells, maxCells, profile.seed);
  const speckle = periodicValueNoise(u, v, maxCells, profile.seed + 977);
  const ridge = 1 - Math.abs(periodicValueNoise(u, v, profile.baseCells * 2, profile.seed + 331));
  const blended = fractal * (1 - profile.speckle) + speckle * profile.speckle;

  return clamp01(0.5 + blended * 0.5 + (ridge - 0.5) * profile.ridged);
}

function linearToSrgb(value: number): number {
  const linear = clamp01(value);

  return linear <= 0.0031308
    ? linear * 12.92
    : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

export function generateTerrainMaterialTiles(
  resolution = TERRAIN_TILE_RESOLUTION
): TerrainMaterialTiles {
  if (!Number.isInteger(resolution) || resolution < 16) {
    throw new Error("Terrain tile resolution must be an integer of at least 16.");
  }

  const pixelCount = resolution * resolution;
  const color = {} as Record<TerrainMaterialId, Uint8Array>;

  for (const profile of TERRAIN_MATERIALS) {
    const tile = new Uint8Array(pixelCount * 4);

    for (let row = 0; row < resolution; row += 1) {
      for (let column = 0; column < resolution; column += 1) {
        const grain = materialGrain(
          column / resolution,
          row / resolution,
          profile,
          resolution
        );
        const modulation = 1 + (grain - 0.5) * 2 * profile.contrast;
        const destination = (row * resolution + column) * 4;

        tile[destination] = Math.round(linearToSrgb(profile.color[0] * modulation) * 255);
        tile[destination + 1] = Math.round(linearToSrgb(profile.color[1] * modulation) * 255);
        tile[destination + 2] = Math.round(linearToSrgb(profile.color[2] * modulation) * 255);
        tile[destination + 3] = 255;
      }
    }

    color[profile.id] = tile;
  }

  // One shared relief field: the materials differ in colour and grain, but a
  // single tangent-space normal at the same world scale keeps the lighting
  // consistent across blends and costs one texture fetch instead of four.
  const height = new Float32Array(pixelCount);

  for (let row = 0; row < resolution; row += 1) {
    for (let column = 0; column < resolution; column += 1) {
      height[row * resolution + column] = clamp01(
        0.5 +
          periodicFractalNoise(
            column / resolution,
            row / resolution,
            20,
            Math.max(20, Math.floor(resolution / 2)),
            0x5c17ab
          ) *
            0.5
      );
    }
  }

  const normal = new Uint8Array(pixelCount * 4);

  for (let row = 0; row < resolution; row += 1) {
    const previousRow = wrap(row - 1, resolution);
    const nextRow = wrap(row + 1, resolution);

    for (let column = 0; column < resolution; column += 1) {
      const previousColumn = wrap(column - 1, resolution);
      const nextColumn = wrap(column + 1, resolution);
      const dx =
        (height[row * resolution + nextColumn] - height[row * resolution + previousColumn]) * 3.5;
      const dy =
        (height[nextRow * resolution + column] - height[previousRow * resolution + column]) * 3.5;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const destination = (row * resolution + column) * 4;

      normal[destination] = Math.round((-dx * inverseLength * 0.5 + 0.5) * 255);
      normal[destination + 1] = Math.round((-dy * inverseLength * 0.5 + 0.5) * 255);
      normal[destination + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
      normal[destination + 3] = 255;
    }
  }

  return { color, normal, resolution };
}
