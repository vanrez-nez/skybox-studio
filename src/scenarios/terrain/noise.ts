// Seeded value-noise FBM for terrain heights.
//
// Self-contained on purpose: the runtime has `materialPerlinNoise3` / `fbm01` but they are
// module-private in starfield-static.ts and not part of its published surface, and the submodule's
// ARCHITECTURE.md puts internal modules outside the stability boundary. This is ~40 lines and the
// forest scenario will reuse it to place instances on the same heightfield.

function hash2(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);

  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;

  return (h >>> 0) / 0xffffffff;
}

// Quintic fade — same curve Perlin uses, so slopes stay continuous and normals don't facet.
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function valueNoise2(seed: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = fade(x - xi);
  const yf = fade(y - yi);

  const c00 = hash2(seed, xi, yi);
  const c10 = hash2(seed, xi + 1, yi);
  const c01 = hash2(seed, xi, yi + 1);
  const c11 = hash2(seed, xi + 1, yi + 1);

  const top = c00 + (c10 - c00) * xf;
  const bottom = c01 + (c11 - c01) * xf;

  return top + (bottom - top) * yf;
}

export type FbmOptions = {
  frequency: number;
  gain: number;
  lacunarity?: number;
  octaves: number;
  seed: number;
};

// Returns roughly [0, 1].
export function fbm2(x: number, y: number, options: FbmOptions): number {
  const octaves = Math.max(1, Math.min(8, Math.floor(options.octaves)));
  const lacunarity = options.lacunarity ?? 2;
  const gain = Math.min(0.999, Math.max(0.001, options.gain));

  let frequency = options.frequency;
  let amplitude = 0.5;
  let sum = 0;
  let norm = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * valueNoise2(options.seed + octave * 1013, x * frequency, y * frequency);
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }

  return norm <= 0 ? 0 : sum / norm;
}
