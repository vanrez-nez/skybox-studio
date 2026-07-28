export type TerrainParams = {
  colorHigh: string;
  colorLow: string;
  extent: number;
  frequency: number;
  gain: number;
  height: number;
  octaves: number;
  roughness: number;
  seed: number;
};

export function createDefaultTerrainParams(): TerrainParams {
  return {
    colorHigh: "#9a8f7a",
    colorLow: "#3f4a32",
    // The rim must sit well beyond the scene's fog far distance, otherwise the terrain's outer edge
    // is visible as a hard line against the sky instead of fading out.
    extent: 2400,
    frequency: 2.4,
    gain: 0.5,
    height: 400,
    octaves: 5,
    roughness: 0.95,
    seed: 1337,
  };
}
