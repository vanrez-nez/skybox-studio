import { describe, expect, it } from "vitest";

import type { TerrainMaps } from "@/scenarios/terrain/erosion";
import { TERRAIN_MATERIALS } from "@/scenarios/terrain/materials";
import {
  calculateTerrainColor,
  calculateTerrainSurface,
  generateTerrainSurfaceMaps,
  TERRAIN_TINT_RANGE,
} from "@/scenarios/terrain/surface";

describe("terrain surface palette", () => {
  it("renders high, flat terrain as snow", () => {
    expect(
      calculateTerrainColor({
        breakup: 0,
        erosion: 0.5,
        height: 0.8,
        normalY: 1,
        ridgeMap: 1,
        trees: -1,
      })
    ).toEqual([1, 1, 1]);
  });

  it("whitens drainage creases", () => {
    expect(
      calculateTerrainColor({
        breakup: 0,
        erosion: 0,
        height: 0.48,
        normalY: 0.7,
        ridgeMap: 0,
        trees: -1,
      })
    ).toEqual([1, 1, 1]);
  });

  it("applies tree cover as a dark-green surface feature", () => {
    const bare = calculateTerrainColor({
      breakup: 0,
      erosion: 0.5,
      height: 0.45,
      normalY: 1,
      ridgeMap: 1,
      trees: -1,
    });
    const forested = calculateTerrainColor({
      breakup: 0,
      erosion: 0.5,
      height: 0.45,
      normalY: 1,
      ridgeMap: 1,
      trees: 1,
    });

    expect(forested[1]).toBeLessThan(bare[1]);
    expect(forested[1]).toBeGreaterThan(forested[0]);
    expect(forested[1]).toBeGreaterThan(forested[2]);
  });
});

describe("terrain material coverage", () => {
  it("resolves to exactly one unit of material everywhere", () => {
    for (let sample = 0; sample < 240; sample += 1) {
      const t = sample / 240;
      const { weights } = calculateTerrainSurface({
        breakup: Math.sin(t * 31) * 0.5,
        erosion: Math.sin(t * 17) * 0.5,
        height: t,
        normalY: 0.5 + Math.cos(t * 11) * 0.5,
        ridgeMap: Math.abs(Math.sin(t * 7)),
        trees: Math.sin(t * 5),
      });
      const total = weights.rock + weights.dirt + weights.grass + weights.snow;

      expect(total).toBeCloseTo(1, 6);

      for (const weight of Object.values(weights)) {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it("assigns snow to peaks, grass to slopes and rock to the base", () => {
    const peak = calculateTerrainSurface({
      breakup: 0,
      erosion: 0.5,
      height: 0.8,
      normalY: 1,
      ridgeMap: 1,
      trees: -1,
    });
    const slope = calculateTerrainSurface({
      breakup: 0,
      erosion: 0.5,
      height: 0.45,
      normalY: 1,
      ridgeMap: 1,
      trees: -1,
    });
    const base = calculateTerrainSurface({
      breakup: 0,
      erosion: 0.5,
      height: 0.3,
      normalY: 0.2,
      ridgeMap: 1,
      trees: -1,
    });

    expect(peak.weights.snow).toBeCloseTo(1, 6);
    expect(slope.weights.grass).toBeCloseTo(1, 6);
    expect(base.weights.rock).toBeCloseTo(1, 6);
    // The base of the relief keeps rock's material but darkened.
    expect(base.rockShade).toBeLessThan(0.5);
  });

  it("keeps the composed colour equal to the material blend the renderer draws", () => {
    for (let sample = 0; sample < 240; sample += 1) {
      const t = sample / 240;
      const input = {
        breakup: Math.sin(t * 23) * 0.4,
        erosion: Math.cos(t * 13) * 0.5,
        height: t,
        normalY: 0.5 + Math.sin(t * 9) * 0.5,
        ridgeMap: Math.abs(Math.cos(t * 3)),
        trees: Math.cos(t * 5),
      };
      const { rockShade, tint, weights } = calculateTerrainSurface(input);
      const composed = [0, 0, 0];

      for (const material of TERRAIN_MATERIALS) {
        const weight =
          material.id === "rock" ? weights.rock * rockShade : weights[material.id];

        for (let channel = 0; channel < 3; channel += 1) {
          composed[channel] += material.color[channel] * weight;
        }
      }

      const expected = calculateTerrainColor(input);

      for (let channel = 0; channel < 3; channel += 1) {
        expect(Math.min(1, composed[channel] * tint[channel])).toBeCloseTo(
          expected[channel],
          6
        );
      }
    }
  });
});

describe("terrain surface maps", () => {
  it("bakes coverage and tint with rows aligned to PlaneGeometry UVs", () => {
    const maps: TerrainMaps = {
      breakup: new Float32Array(4),
      erosion: new Float32Array([0.5, 0.5, 0.5, 0.5]),
      height: new Float32Array([0.8, 0.8, 0.45, 0.45]),
      resolution: 2,
      ridgeMap: new Float32Array([1, 1, 1, 1]),
      trees: new Float32Array([-1, -1, -1, -1]),
    };
    const { tint, weights } = generateTerrainSurfaceMaps(maps);

    expect(weights).toHaveLength(16);
    expect(tint).toHaveLength(16);

    // Row 0 of the source (snow at height 0.8) lands on the last texture row.
    expect(Array.from(weights.slice(8, 12))).toEqual([0, 0, 0, 255]);
    // Row 1 (grass at height 0.45) lands on the first texture row.
    expect(Array.from(weights.slice(0, 4))).toEqual([0, 0, 255, 0]);

    // Snow needs no tint, so its multiplier is a flat 1 of the stored range.
    const snowTint = Array.from(tint.slice(8, 11)).map(
      (channel) => (channel / 255) * TERRAIN_TINT_RANGE
    );

    for (const channel of snowTint) {
      expect(channel).toBeCloseTo(1, 2);
    }
  });
});
