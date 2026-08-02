/*
 * Portions adapted from "Advanced Terrain Erosion Filter"
 * Copyright (c) 2025 Rune Skovbo Johansen.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Source: https://www.shadertoy.com/view/wXcfWn
 */

import type { TerrainParams } from "@/scenarios/terrain/params";

const HASH_K_X = 0.3183099;
const HASH_K_Y = 0.3678794;
const TAU = Math.PI * 2;
const HEIGHT_AMPLITUDE = 0.125;
const HEIGHT_LACUNARITY = 2;
const EROSION_LACUNARITY = 2;
const EROSION_GAIN = 0.5;
const EROSION_CELL_SCALE = 0.7;
const EROSION_NORMALIZATION = 0.5;
const EROSION_ROUNDING_INPUT_MULTIPLIER = 0.1;
const EROSION_ROUNDING_OCTAVE_MULTIPLIER = 2;
const EROSION_ONSET = [1.25, 1.25, 2.8, 1.5] as const;
const EROSION_ASSUMED_SLOPE = [0.7, 1] as const;
const TERRAIN_HEIGHT_OFFSET = -0.65;
const GRASS_HEIGHT = 0.465;
const DEFAULT_SEED = 1337;

export type TerrainSamplingParams = Pick<
  TerrainParams,
  | "creaseRounding"
  | "erosionDetail"
  | "erosionOctaves"
  | "erosionScale"
  | "erosionStrength"
  | "frequency"
  | "gain"
  | "gullyWeight"
  | "octaves"
  | "ridgeRounding"
  | "seed"
>;

export type TerrainPointSample = {
  breakup: number;
  erosion: number;
  height: number;
  ridgeMap: number;
  trees: number;
};

export type TerrainMaps = {
  breakup: Float32Array;
  erosion: Float32Array;
  height: Float32Array;
  resolution: number;
  ridgeMap: Float32Array;
  trees: Float32Array;
};

type NoiseSample = {
  dx: number;
  dy: number;
  value: number;
};

type ErosionSample = {
  deltaDx: number;
  deltaDy: number;
  deltaHeight: number;
  magnitude: number;
  ridgeMap: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function mix(a: number, b: number, amount: number): number {
  return a * (1 - amount) + b * amount;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hashCommon(x: number, y: number): number {
  const px = x * HASH_K_X + HASH_K_Y;
  const py = y * HASH_K_Y + HASH_K_X;

  return fract(px * py * (px + py));
}

function hashX(x: number, y: number): number {
  return -1 + 2 * fract(16 * HASH_K_X * hashCommon(x, y));
}

function hashY(x: number, y: number): number {
  return -1 + 2 * fract(16 * HASH_K_Y * hashCommon(x, y));
}

// Gradient noise and its analytic derivatives, matching the Common buffer's noised().
export function noised(x: number, y: number): NoiseSample {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fract(x);
  const fy = fract(y);
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1);
  const duy = 30 * fy * fy * (fy * (fy - 2) + 1);

  const gaX = hashX(ix, iy);
  const gaY = hashY(ix, iy);
  const gbX = hashX(ix + 1, iy);
  const gbY = hashY(ix + 1, iy);
  const gcX = hashX(ix, iy + 1);
  const gcY = hashY(ix, iy + 1);
  const gdX = hashX(ix + 1, iy + 1);
  const gdY = hashY(ix + 1, iy + 1);

  const va = gaX * fx + gaY * fy;
  const vb = gbX * (fx - 1) + gbY * fy;
  const vc = gcX * fx + gcY * (fy - 1);
  const vd = gdX * (fx - 1) + gdY * (fy - 1);
  const cornerDelta = va - vb - vc + vd;

  return {
    value: va + ux * (vb - va) + uy * (vc - va) + ux * uy * cornerDelta,
    dx:
      gaX +
      ux * (gbX - gaX) +
      uy * (gcX - gaX) +
      ux * uy * (gaX - gbX - gcX + gdX) +
      dux * (uy * cornerDelta + vb - va),
    dy:
      gaY +
      ux * (gbY - gaY) +
      uy * (gcY - gaY) +
      ux * uy * (gaY - gbY - gcY + gdY) +
      duy * (ux * cornerDelta + vc - va),
  };
}

function fractalNoise(
  x: number,
  y: number,
  frequency: number,
  octaves: number,
  gain: number
): NoiseSample {
  let value = 0;
  let dx = 0;
  let dy = 0;
  let octaveFrequency = frequency;
  let amplitude = 1;

  for (let octave = 0; octave < octaves; octave += 1) {
    const sample = noised(x * octaveFrequency, y * octaveFrequency);

    value += sample.value * amplitude;
    dx += sample.dx * amplitude * octaveFrequency;
    dy += sample.dy * amplitude * octaveFrequency;
    amplitude *= gain;
    octaveFrequency *= HEIGHT_LACUNARITY;
  }

  return { value, dx, dy };
}

function phacelleNoise(
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  frequency: number,
  offset: number,
  normalization: number
) {
  const sideX = -directionY * frequency * TAU;
  const sideY = directionX * frequency * TAU;
  const phaseOffset = offset * TAU;
  const integerX = Math.floor(x);
  const integerY = Math.floor(y);
  const fractionX = fract(x);
  const fractionY = fract(y);
  let phaseX = 0;
  let phaseY = 0;
  let weightSum = 0;

  for (let cellX = -1; cellX <= 2; cellX += 1) {
    for (let cellY = -1; cellY <= 2; cellY += 1) {
      const gridX = integerX + cellX;
      const gridY = integerY + cellY;
      const randomX = hashX(gridX, gridY) * 0.5;
      const randomY = hashY(gridX, gridY) * 0.5;
      const fromCellX = fractionX - cellX - randomX;
      const fromCellY = fractionY - cellY - randomY;
      const squaredDistance = fromCellX * fromCellX + fromCellY * fromCellY;
      const weight = Math.max(0, Math.exp(-squaredDistance * 2) - 0.01111);
      const waveInput = fromCellX * sideX + fromCellY * sideY + phaseOffset;

      weightSum += weight;
      phaseX += Math.cos(waveInput) * weight;
      phaseY += Math.sin(waveInput) * weight;
    }
  }

  const interpolatedX = phaseX / weightSum;
  const interpolatedY = phaseY / weightSum;
  const magnitude = Math.max(
    1 - normalization,
    Math.sqrt(interpolatedX * interpolatedX + interpolatedY * interpolatedY)
  );

  return {
    cosine: interpolatedX / magnitude,
    sine: interpolatedY / magnitude,
    sideX,
    sideY,
  };
}

function powInv(value: number, power: number): number {
  return 1 - Math.pow(1 - clamp01(value), power);
}

function easeOut(value: number): number {
  const flipped = 1 - clamp01(value);
  return 1 - flipped * flipped;
}

function smoothStart(value: number, smoothing: number): number {
  if (smoothing <= 1e-10) {
    return value;
  }

  if (value >= smoothing) {
    return value - 0.5 * smoothing;
  }

  return (0.5 * value * value) / smoothing;
}

function erosionFilter(
  x: number,
  y: number,
  height: number,
  slopeX: number,
  slopeY: number,
  initialFadeTarget: number,
  params: TerrainSamplingParams
): ErosionSample {
  const scale = Math.max(params.erosionScale, 1e-6);
  let strength = Math.max(params.erosionStrength, 0) * scale;
  let fadeTarget = clamp(initialFadeTarget, -1, 1);
  let outputHeight = height;
  let outputSlopeX = slopeX;
  let outputSlopeY = slopeY;
  let frequency = 1 / (scale * EROSION_CELL_SCALE);
  const slopeLength = Math.max(Math.hypot(slopeX, slopeY), 1e-10);
  let magnitude = 0;
  let roundingMultiplier = 1;
  const roundingForInput =
    mix(params.creaseRounding, params.ridgeRounding, clamp01(fadeTarget + 0.5)) *
    EROSION_ROUNDING_INPUT_MULTIPLIER;
  let combinedMask = easeOut(
    smoothStart(slopeLength * EROSION_ONSET[0], roundingForInput * EROSION_ONSET[0])
  );
  let ridgeCombinedMask = easeOut(slopeLength * EROSION_ONSET[2]);
  let ridgeFadeTarget = fadeTarget;
  const actualDirectionX = slopeX / slopeLength;
  const actualDirectionY = slopeY / slopeLength;
  let gullySlopeX = mix(slopeX, actualDirectionX * EROSION_ASSUMED_SLOPE[0], EROSION_ASSUMED_SLOPE[1]);
  let gullySlopeY = mix(slopeY, actualDirectionY * EROSION_ASSUMED_SLOPE[0], EROSION_ASSUMED_SLOPE[1]);

  for (let octave = 0; octave < params.erosionOctaves; octave += 1) {
    const gullyLength = Math.hypot(gullySlopeX, gullySlopeY);
    const directionX = gullyLength > 1e-10 ? gullySlopeX / gullyLength : 0;
    const directionY = gullyLength > 1e-10 ? gullySlopeY / gullyLength : 0;
    const phacelle = phacelleNoise(
      x * frequency,
      y * frequency,
      directionX,
      directionY,
      EROSION_CELL_SCALE,
      0.25,
      EROSION_NORMALIZATION
    );
    const derivativeX = -phacelle.sideX * frequency;
    const derivativeY = -phacelle.sideY * frequency;
    const sloping = Math.abs(phacelle.sine);
    const sineSign = Math.sign(phacelle.sine);

    gullySlopeX +=
      sineSign * derivativeX * strength * clamp01(params.gullyWeight);
    gullySlopeY +=
      sineSign * derivativeY * strength * clamp01(params.gullyWeight);

    const gullyHeight = phacelle.cosine * clamp01(params.gullyWeight);
    const gullySlopeDeltaX = phacelle.sine * derivativeX * clamp01(params.gullyWeight);
    const gullySlopeDeltaY = phacelle.sine * derivativeY * clamp01(params.gullyWeight);
    const fadedHeight = mix(fadeTarget, gullyHeight, combinedMask);
    const fadedSlopeX = gullySlopeDeltaX * combinedMask;
    const fadedSlopeY = gullySlopeDeltaY * combinedMask;

    outputHeight += fadedHeight * strength;
    outputSlopeX += fadedSlopeX * strength;
    outputSlopeY += fadedSlopeY * strength;
    magnitude += strength;
    fadeTarget = fadedHeight;

    const roundingForOctave =
      mix(params.creaseRounding, params.ridgeRounding, clamp01(phacelle.cosine + 0.5)) *
      roundingMultiplier;
    const newMask = easeOut(
      smoothStart(sloping * EROSION_ONSET[1], roundingForOctave * EROSION_ONSET[1])
    );
    combinedMask = powInv(combinedMask, params.erosionDetail) * newMask;

    ridgeFadeTarget = mix(ridgeFadeTarget, phacelle.cosine, ridgeCombinedMask);
    ridgeCombinedMask *= easeOut(sloping * EROSION_ONSET[3]);

    strength *= EROSION_GAIN;
    frequency *= EROSION_LACUNARITY;
    roundingMultiplier *= EROSION_ROUNDING_OCTAVE_MULTIPLIER;
  }

  return {
    deltaHeight: outputHeight - height,
    deltaDx: outputSlopeX - slopeX,
    deltaDy: outputSlopeY - slopeY,
    magnitude,
    ridgeMap: ridgeFadeTarget * (1 - ridgeCombinedMask),
  };
}

function treesAmount(
  height: number,
  normalY: number,
  occlusion: number,
  ridgeMap: number
): number {
  return (
    smoothstep(
      GRASS_HEIGHT + 0.05,
      GRASS_HEIGHT + 0.01,
      height + 0.01 + (occlusion - 0.8) * 0.05
    ) *
      smoothstep(0, 0.4, occlusion) *
      smoothstep(0.95, 1, normalY) *
      smoothstep(-1.4, 0, ridgeMap) -
    0.5
  ) / 0.6;
}

function detailBreakup(x: number, y: number): number {
  let amplitude = 0.5;
  let frequency = 2;
  let breakup = 0;

  for (let octave = 0; octave < 8; octave += 1) {
    breakup += noised(x * frequency, y * frequency).value * amplitude;
    amplitude *= 0.95;
    frequency *= 2;
  }

  return breakup;
}

function seedOffset(seed: number): [number, number] {
  // Domain translation keeps Runevision's hash/noise functions intact while retaining the app's
  // deterministic Seed control. The default starts at the ShaderToy's time-zero scroll position;
  // other integer seeds make large jumps to visually distinct terrain regions.
  const seedX = seed + 17.17;
  const seedY = seed * 0.754877666 + 43.11;
  const defaultX = DEFAULT_SEED + 17.17;
  const defaultY = DEFAULT_SEED * 0.754877666 + 43.11;

  return [
    2 + (hashX(seedX, seedY) - hashX(defaultX, defaultY)) * 32,
    (hashY(seedX, seedY) - hashY(defaultX, defaultY)) * 32,
  ];
}

export function pickTerrainSamplingParams(params: TerrainParams): TerrainSamplingParams {
  return {
    creaseRounding: params.creaseRounding,
    erosionDetail: params.erosionDetail,
    erosionOctaves: Math.max(0, Math.round(params.erosionOctaves)),
    erosionScale: params.erosionScale,
    erosionStrength: params.erosionStrength,
    frequency: params.frequency,
    gain: params.gain,
    gullyWeight: params.gullyWeight,
    octaves: Math.max(1, Math.round(params.octaves)),
    ridgeRounding: params.ridgeRounding,
    seed: Math.round(params.seed),
  };
}

export function sampleTerrainPoint(
  u: number,
  v: number,
  params: TerrainSamplingParams
): TerrainPointSample {
  const offset = seedOffset(params.seed);
  const x = u + offset[0];
  const y = v + offset[1];
  const base = fractalNoise(x, y, params.frequency, params.octaves, params.gain);
  const rawHeight = base.value * HEIGHT_AMPLITUDE;
  const fadeTarget = clamp(rawHeight / (HEIGHT_AMPLITUDE * 0.6), -1, 1);
  const height = rawHeight * 0.5 + 0.5;
  const slopeX = base.dx * HEIGHT_AMPLITUDE * 0.5;
  const slopeY = base.dy * HEIGHT_AMPLITUDE * 0.5;
  const erosion = erosionFilter(x, y, height, slopeX, slopeY, fadeTarget, params);
  const offsetHeight = TERRAIN_HEIGHT_OFFSET * erosion.magnitude;
  let erodedHeight = height + erosion.deltaHeight + offsetHeight;
  const normalizedErosion = erosion.magnitude > 1e-10 ? erosion.deltaHeight / erosion.magnitude : 0;
  const derivativeX = slopeX + erosion.deltaDx;
  const derivativeY = slopeY + erosion.deltaDy;
  const normalY = 1 / Math.sqrt(1 + derivativeX * derivativeX + derivativeY * derivativeY);
  const treeCoverage = treesAmount(
    erodedHeight,
    normalY,
    normalizedErosion + 0.5,
    erosion.ridgeMap
  );
  const treeNoise = noised((x + 0.5) * 200, (y + 0.5) * 200).value * 0.5 + 0.5;
  const rawTrees = (-Math.pow(treeNoise, 2) + treeCoverage) * 1.5;

  if (rawTrees > 0) {
    erodedHeight += rawTrees / 300;
  }

  return {
    breakup: detailBreakup(x, y),
    erosion: clamp(normalizedErosion, -1, 1),
    height: erodedHeight,
    // Buffer A packs the raw [-1, 1] ridge value into [0, 1], and the Image buffer deliberately
    // leaves that channel packed when calculating drainage.
    ridgeMap: clamp01(erosion.ridgeMap * 0.5 + 0.5),
    trees: clamp(rawTrees, -1, 1),
  };
}

export function generateTerrainMaps(
  params: TerrainSamplingParams,
  resolution: number
): TerrainMaps {
  if (!Number.isInteger(resolution) || resolution < 2) {
    throw new Error("Terrain map resolution must be an integer of at least 2.");
  }

  const sampleCount = resolution * resolution;
  const height = new Float32Array(sampleCount);
  const erosion = new Float32Array(sampleCount);
  const ridgeMap = new Float32Array(sampleCount);
  const trees = new Float32Array(sampleCount);
  const breakup = new Float32Array(sampleCount);
  const denominator = resolution - 1;

  for (let row = 0; row < resolution; row += 1) {
    for (let column = 0; column < resolution; column += 1) {
      const index = row * resolution + column;
      const sample = sampleTerrainPoint(column / denominator, row / denominator, params);

      height[index] = sample.height;
      erosion[index] = sample.erosion;
      ridgeMap[index] = sample.ridgeMap;
      trees[index] = sample.trees;
      breakup[index] = sample.breakup;
    }
  }

  return { breakup, erosion, height, resolution, ridgeMap, trees };
}
