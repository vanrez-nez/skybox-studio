/*
 * Terrain surface classification adapted from Runevision's Advanced Terrain Erosion Filter demo,
 * whose renderer is derived from Fewes' Terrain Erosion Noise.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Source: https://www.shadertoy.com/view/wXcfWn
 *
 * The classification thresholds are unchanged. What changed is the output:
 * instead of collapsing the features into one flat colour per texel (which
 * capped all surface detail at the map's ~5 m texel size), it emits how much
 * of each material covers the texel plus a tint. The renderer paints those
 * weights with tiling material textures, so the colour detail comes from the
 * tiles rather than from this map.
 */

import type { TerrainMaps } from "@/scenarios/terrain/erosion";
import {
  TERRAIN_MATERIALS,
  type TerrainMaterialId,
} from "@/scenarios/terrain/materials";

export type TerrainSurfaceInput = {
  breakup: number;
  erosion: number;
  height: number;
  normalY: number;
  ridgeMap: number;
  trees: number;
};

export type TerrainColor = [red: number, green: number, blue: number];

export type TerrainMaterialWeights = Record<TerrainMaterialId, number>;

export type TerrainSurfaceSample = {
  /** Fraction of the texel covered by each material; sums to 1. */
  weights: TerrainMaterialWeights;
  /** Multiplier applied to the blended material colour, per channel. */
  tint: TerrainColor;
  /** Multiplier applied to the rock material alone (relief base darkening). */
  rockShade: number;
};

/** Tint is stored in an 8-bit texture, so multipliers are capped here. */
export const TERRAIN_TINT_RANGE = 2;

const DIRT_COLOR: TerrainColor = [0.6, 0.5, 0.4];
const TREE_COLOR: TerrainColor = [0.12, 0.26, 0.1];
const GRASS_COLOR_1: TerrainColor = [0.15, 0.3, 0.1];
const GRASS_COLOR_2: TerrainColor = [0.4, 0.5, 0.2];
const GRASS_HEIGHT = 0.465;
const DRAINAGE_WIDTH = 0.3;

const MATERIAL_COLORS = Object.fromEntries(
  TERRAIN_MATERIALS.map((material) => [material.id, material.color])
) as Record<TerrainMaterialId, TerrainColor>;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = edge0 === edge1 ? (value < edge0 ? 0 : 1) : clamp01((value - edge0) / (edge1 - edge0));

  return t * t * (3 - 2 * t);
}

function mixColor(a: TerrainColor, b: TerrainColor, amount: number): TerrainColor {
  return [
    a[0] * (1 - amount) + b[0] * amount,
    a[1] * (1 - amount) + b[1] * amount,
    a[2] * (1 - amount) + b[2] * amount,
  ];
}

function scaleColor(color: TerrainColor, amount: number): TerrainColor {
  return [color[0] * amount, color[1] * amount, color[2] * amount];
}

/** Redistributes every material's coverage toward `id` by `amount`. */
function coverWith(
  weights: TerrainMaterialWeights,
  id: TerrainMaterialId,
  amount: number
): void {
  const remaining = 1 - amount;

  weights.rock *= remaining;
  weights.dirt *= remaining;
  weights.grass *= remaining;
  weights.snow *= remaining;
  weights[id] += amount;
}

export function calculateTerrainSurface({
  breakup,
  erosion,
  height,
  normalY,
  ridgeMap,
  trees,
}: TerrainSurfaceInput): TerrainSurfaceSample {
  const occlusion = clamp01(erosion + 0.5);
  const weights: TerrainMaterialWeights = { dirt: 0, grass: 0, rock: 1, snow: 0 };

  // Bare rock everywhere to begin with, darkened toward the base of the relief.
  const rockShade = smoothstep(0.4, 0.52, height);

  coverWith(weights, "dirt", smoothstep(0.6, 0, occlusion + breakup * 1.5));
  coverWith(weights, "snow", smoothstep(0.53, 0.6, height + breakup * 0.1));

  const grassAmount =
    smoothstep(
      GRASS_HEIGHT + 0.05,
      GRASS_HEIGHT + 0.02,
      height + 0.01 + (occlusion - 0.8) * 0.05 - breakup * 0.02
    ) *
    smoothstep(0.8, 1, 1 - (1 - normalY) * (1 - trees) + breakup * 0.1);

  let grassColor = mixColor(
    GRASS_COLOR_1,
    GRASS_COLOR_2,
    smoothstep(0.4, 0.6, height - erosion * 0.05 + breakup * 0.3)
  );

  coverWith(weights, "grass", grassAmount);

  // Tree cover reads as darker grass: it counts toward the same material and
  // pulls that material's colour toward the canopy tone.
  const treeAmount = clamp01(trees * 2.2 - 0.8) * 0.6;

  coverWith(weights, "grass", treeAmount);

  if (weights.grass > 0) {
    // Weighted average: the canopy share of the grass channel takes the tree
    // tone, the share carried over from before keeps the grass tone.
    grassColor = mixColor(
      grassColor,
      scaleColor(TREE_COLOR, Math.pow(trees, 8)),
      treeAmount / weights.grass
    );
  }

  coverWith(weights, "snow", clamp01((1 - clamp01(ridgeMap / DRAINAGE_WIDTH)) * 1.5));

  // The grass tone gradient and the tree canopy are colour shifts on the grass
  // material, so they enter the shared tint scaled by how much grass is here.
  const grassBase = MATERIAL_COLORS.grass;
  const grassTint: TerrainColor = [
    grassColor[0] / grassBase[0],
    grassColor[1] / grassBase[1],
    grassColor[2] / grassBase[2],
  ];
  const breakupGain = 1 + breakup * 0.5;
  const tint = mixColor([1, 1, 1], grassTint, weights.grass).map((channel) =>
    Math.min(TERRAIN_TINT_RANGE, Math.max(0, channel * breakupGain))
  ) as TerrainColor;

  return { rockShade, tint, weights };
}

/**
 * The colour the surface resolves to once its materials are composited. The
 * renderer reaches this through the tiled textures; this exists so the
 * classification stays verifiable on its own.
 */
export function calculateTerrainColor(input: TerrainSurfaceInput): TerrainColor {
  const { rockShade, tint, weights } = calculateTerrainSurface(input);
  const color: TerrainColor = [0, 0, 0];

  for (const material of TERRAIN_MATERIALS) {
    const weight =
      material.id === "rock" ? weights.rock * rockShade : weights[material.id];

    color[0] += material.color[0] * weight;
    color[1] += material.color[1] * weight;
    color[2] += material.color[2] * weight;
  }

  return [
    clamp01(color[0] * tint[0]),
    clamp01(color[1] * tint[1]),
    clamp01(color[2] * tint[2]),
  ];
}

export function terrainMapNormalY(maps: TerrainMaps, index: number): number {
  const column = index % maps.resolution;
  const row = Math.floor(index / maps.resolution);
  const nextColumn = Math.min(column + 1, maps.resolution - 1);
  const nextRow = Math.min(row + 1, maps.resolution - 1);
  const height = maps.height[index] ?? 0;
  const derivativeX =
    ((maps.height[row * maps.resolution + nextColumn] ?? height) - height) *
    (maps.resolution - 1);
  const derivativeY =
    ((maps.height[nextRow * maps.resolution + column] ?? height) - height) *
    (maps.resolution - 1);

  return 1 / Math.sqrt(1 + derivativeX * derivativeX + derivativeY * derivativeY);
}

export type TerrainSurfaceMaps = {
  /** RGB = colour multiplier scaled into 0..TERRAIN_TINT_RANGE, A = rock shade. */
  tint: Uint8Array;
  /** RGBA = rock, dirt, grass, snow coverage. */
  weights: Uint8Array;
};

// DataTexture rows start at UV y=0, while PlaneGeometry's first vertex row uses UV y=1. Bake rows
// upside-down so the texture features remain registered with the worker-generated displacement.
export function generateTerrainSurfaceMaps(maps: TerrainMaps): TerrainSurfaceMaps {
  const texelCount = maps.resolution * maps.resolution * 4;
  const tint = new Uint8Array(texelCount);
  const weights = new Uint8Array(texelCount);

  for (let row = 0; row < maps.resolution; row += 1) {
    const destinationRow = maps.resolution - row - 1;

    for (let column = 0; column < maps.resolution; column += 1) {
      const sourceIndex = row * maps.resolution + column;
      const destinationIndex = (destinationRow * maps.resolution + column) * 4;
      const surface = calculateTerrainSurface({
        breakup: maps.breakup[sourceIndex] ?? 0,
        erosion: maps.erosion[sourceIndex] ?? 0,
        height: maps.height[sourceIndex] ?? 0.5,
        normalY: terrainMapNormalY(maps, sourceIndex),
        ridgeMap: maps.ridgeMap[sourceIndex] ?? 1,
        trees: maps.trees[sourceIndex] ?? -1,
      });

      weights[destinationIndex] = Math.round(clamp01(surface.weights.rock) * 255);
      weights[destinationIndex + 1] = Math.round(clamp01(surface.weights.dirt) * 255);
      weights[destinationIndex + 2] = Math.round(clamp01(surface.weights.grass) * 255);
      weights[destinationIndex + 3] = Math.round(clamp01(surface.weights.snow) * 255);

      tint[destinationIndex] = Math.round(
        clamp01(surface.tint[0] / TERRAIN_TINT_RANGE) * 255
      );
      tint[destinationIndex + 1] = Math.round(
        clamp01(surface.tint[1] / TERRAIN_TINT_RANGE) * 255
      );
      tint[destinationIndex + 2] = Math.round(
        clamp01(surface.tint[2] / TERRAIN_TINT_RANGE) * 255
      );
      tint[destinationIndex + 3] = Math.round(clamp01(surface.rockShade) * 255);
    }
  }

  return { tint, weights };
}
