import type { TerrainSamplingParams } from "@/scenarios/terrain/erosion";

export type TerrainWorkerRequest = {
  params: TerrainSamplingParams;
  resolution: number;
  revision: number;
  /** World vertical units divided by world horizontal units. */
  surfaceSlopeScale: number;
  type: "generate";
};

export type TerrainWorkerResult = {
  breakup: ArrayBuffer;
  erosion: ArrayBuffer;
  height: ArrayBuffer;
  resolution: number;
  revision: number;
  ridgeMap: ArrayBuffer;
  /** RGB colour multiplier, A rock shade. */
  tint: ArrayBuffer;
  trees: ArrayBuffer;
  type: "result";
  /** RGBA material coverage: rock, dirt, grass, snow. */
  weights: ArrayBuffer;
};

export type TerrainWorkerError = {
  error: string;
  revision: number;
  type: "error";
};

export type TerrainWorkerResponse = TerrainWorkerError | TerrainWorkerResult;
