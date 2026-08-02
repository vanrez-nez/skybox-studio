import { describe, expect, it } from "vitest";

import {
  generateTerrainMaterialTiles,
  TERRAIN_MATERIAL_IDS,
  TERRAIN_MATERIALS,
  TERRAIN_TILE_RESOLUTION,
  TERRAIN_TILE_WORLD_SIZE,
} from "@/scenarios/terrain/materials";

const RESOLUTION = 64;

function channelMean(tile: Uint8Array, offset: number): number {
  let total = 0;

  for (let index = offset; index < tile.length; index += 4) {
    total += tile[index];
  }

  return total / (tile.length / 4);
}

function edgeSeamDelta(tile: Uint8Array, resolution: number): number {
  let worst = 0;

  for (let row = 0; row < resolution; row += 1) {
    const left = tile[(row * resolution) * 4];
    const right = tile[(row * resolution + resolution - 1) * 4];
    const top = tile[row * 4];
    const bottom = tile[((resolution - 1) * resolution + row) * 4];

    worst = Math.max(worst, Math.abs(left - right), Math.abs(top - bottom));
  }

  return worst;
}

describe("terrain material tiles", () => {
  it("resolves surface detail far finer than the feature map", () => {
    const metresPerTexel = TERRAIN_TILE_WORLD_SIZE / TERRAIN_TILE_RESOLUTION;

    // The 512² feature map spans the whole 2400 m terrain (~4.7 m per texel), while material
    // texture detail stays comfortably sub-metre without becoming centimetre-scale noise.
    expect(metresPerTexel).toBeLessThan(0.2);
  });

  it("generates one deterministic opaque tile per material", () => {
    const first = generateTerrainMaterialTiles(RESOLUTION);
    const second = generateTerrainMaterialTiles(RESOLUTION);

    expect(Object.keys(first.color).sort()).toEqual([...TERRAIN_MATERIAL_IDS].sort());

    for (const id of TERRAIN_MATERIAL_IDS) {
      expect(first.color[id]).toEqual(second.color[id]);
      expect(first.color[id]).toHaveLength(RESOLUTION * RESOLUTION * 4);

      for (let index = 3; index < first.color[id].length; index += 4) {
        expect(first.color[id][index]).toBe(255);
      }
    }

    expect(first.normal).toEqual(second.normal);
  });

  it("tints each tile toward the material's palette colour", () => {
    const tiles = generateTerrainMaterialTiles(RESOLUTION);
    const means = Object.fromEntries(
      TERRAIN_MATERIALS.map((material) => [
        material.id,
        [0, 1, 2].map((channel) => channelMean(tiles.color[material.id], channel)),
      ])
    );

    // Snow is the brightest, rock the darkest, grass greener than it is red.
    expect(means.snow[0]).toBeGreaterThan(means.dirt[0]);
    expect(means.dirt[0]).toBeGreaterThan(means.rock[0]);
    expect(means.grass[1]).toBeGreaterThan(means.grass[0]);
    expect(means.grass[1]).toBeGreaterThan(means.grass[2]);
  });

  it("wraps seamlessly so the repeat has no visible edge", () => {
    const tiles = generateTerrainMaterialTiles(RESOLUTION);

    for (const id of TERRAIN_MATERIAL_IDS) {
      expect(edgeSeamDelta(tiles.color[id], RESOLUTION)).toBeLessThan(96);
    }
  });

  it("rejects resolutions too small to hold the grain bands", () => {
    expect(() => generateTerrainMaterialTiles(8)).toThrow(
      "Terrain tile resolution must be an integer of at least 16."
    );
  });
});
