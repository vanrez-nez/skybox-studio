import { describe, expect, it } from "vitest";

import {
  generateTerrainMaps,
  noised,
  pickTerrainSamplingParams,
  sampleTerrainPoint,
} from "@/scenarios/terrain/erosion";
import {
  createDefaultTerrainParams,
  resolveTerrainParams,
} from "@/scenarios/terrain/params";

describe("advanced terrain erosion", () => {
  it("matches finite differences with its analytic noise derivatives", () => {
    const epsilon = 1e-5;

    for (const [x, y] of [
      [0.17, 0.83],
      [2.45, -1.31],
      [-4.2, 7.77],
    ]) {
      const sample = noised(x, y);
      const derivativeX =
        (noised(x + epsilon, y).value - noised(x - epsilon, y).value) / (2 * epsilon);
      const derivativeY =
        (noised(x, y + epsilon).value - noised(x, y - epsilon).value) / (2 * epsilon);

      expect(sample.dx).toBeCloseTo(derivativeX, 4);
      expect(sample.dy).toBeCloseTo(derivativeY, 4);
    }
  });

  it("is deterministic and keeps packed feature channels in their source ranges", () => {
    const params = pickTerrainSamplingParams(createDefaultTerrainParams());
    const first = sampleTerrainPoint(0.37, 0.61, params);
    const second = sampleTerrainPoint(0.37, 0.61, params);

    expect(second).toEqual(first);
    expect(Object.values(first).every(Number.isFinite)).toBe(true);
    expect(first.erosion).toBeGreaterThanOrEqual(-1);
    expect(first.erosion).toBeLessThanOrEqual(1);
    expect(first.ridgeMap).toBeGreaterThanOrEqual(0);
    expect(first.ridgeMap).toBeLessThanOrEqual(1);
    expect(first.ridgeMap).toBeCloseTo(0.584360209, 8);
    expect(first.trees).toBeGreaterThanOrEqual(-1);
    expect(first.trees).toBeLessThanOrEqual(1);
  });

  it("handles zero erosion strength without NaNs", () => {
    const params = pickTerrainSamplingParams({
      ...createDefaultTerrainParams(),
      erosionStrength: 0,
    });
    const sample = sampleTerrainPoint(0.5, 0.5, params);

    expect(Object.values(sample).every(Number.isFinite)).toBe(true);
    expect(sample.erosion).toBe(0);
  });

  it("changes the sampled domain deterministically with Seed", () => {
    const defaults = createDefaultTerrainParams();
    const first = sampleTerrainPoint(0.25, 0.75, pickTerrainSamplingParams(defaults));
    const shifted = sampleTerrainPoint(
      0.25,
      0.75,
      pickTerrainSamplingParams({ ...defaults, seed: defaults.seed + 1 })
    );

    expect(shifted.height).not.toBeCloseTo(first.height, 5);
  });

  it("generates aligned map channels", () => {
    const maps = generateTerrainMaps(
      pickTerrainSamplingParams(createDefaultTerrainParams()),
      5
    );

    expect(maps.resolution).toBe(5);
    expect(maps.height).toHaveLength(25);
    expect(maps.erosion).toHaveLength(25);
    expect(maps.ridgeMap).toHaveLength(25);
    expect(maps.trees).toHaveLength(25);
    expect(maps.breakup).toHaveLength(25);
  });
});

describe("terrain parameter migration", () => {
  it("merges partial legacy records and drops obsolete colour fields", () => {
    const resolved = resolveTerrainParams({
      colorHigh: "#ffffff",
      colorLow: "#000000",
      extent: 1800,
      seed: 42,
    });

    expect(resolved.extent).toBe(1800);
    expect(resolved.seed).toBe(42);
    expect(resolved.erosionStrength).toBe(0.22);
    expect(resolved).not.toHaveProperty("colorHigh");
    expect(resolved).not.toHaveProperty("colorLow");
  });

  it("rejects non-finite persisted values", () => {
    const defaults = createDefaultTerrainParams();
    const resolved = resolveTerrainParams({ height: Number.NaN, seed: Number.POSITIVE_INFINITY });

    expect(resolved.height).toBe(defaults.height);
    expect(resolved.seed).toBe(defaults.seed);
  });
});
