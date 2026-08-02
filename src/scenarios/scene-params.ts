// Scene parameters shared by every scenario — lights, fog and camera. Kept separate from
// per-scenario params so the Preview sidebar can show one "Scene" section regardless of which
// scenario is active.

export type SunParams = {
  // Direction the light comes FROM, as azimuth/elevation in degrees. Matches how the spot layer is
  // authored, so linking to the sky is a straight conversion rather than a vector edit.
  azimuth: number;
  elevation: number;
  color: string;
  intensity: number;
  // When true the key light tracks the first enabled Sun or Moon layer (direction + colour) instead
  // of the azimuth/elevation/colour above.
  linkToSky: boolean;
};

export type AmbientParams = {
  // Hemisphere light: sky colour above, ground bounce below.
  skyColor: string;
  groundColor: string;
  intensity: number;
  // Image-based lighting from the baked sky, on top of the hemisphere term.
  environmentIntensity: number;
};

export type FogParams = {
  enabled: boolean;
  color: string;
  // Linear fog distances in world units.
  near: number;
  far: number;
};

export type SceneParams = {
  ambient: AmbientParams;
  fog: FogParams;
  fov: number;
  sun: SunParams;
};

export function createDefaultSceneParams(): SceneParams {
  return {
    ambient: {
      skyColor: "#9db6d4",
      groundColor: "#3a3226",
      intensity: 0.25,
      environmentIntensity: 0.6,
    },
    fog: {
      enabled: true,
      // A blue-grey distance haze approximates the reference atmosphere without bleaching every
      // mountain beyond 30 units to white. The far edge still disappears before the 1200-unit rim.
      color: "#9db6d4",
      near: 350,
      far: 1150,
    },
    fov: 50,
    sun: {
      azimuth: 135,
      elevation: 25,
      color: "#fff2dd",
      intensity: 0.8,
      linkToSky: true,
    },
  };
}
