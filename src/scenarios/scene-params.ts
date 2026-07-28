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
  // When true the sun tracks the sky's brightest spot layer (direction + colour) instead of the
  // azimuth/elevation/colour above.
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
      intensity: 0.15,
      environmentIntensity: 0.6,
    },
    fog: {
      enabled: true,
      color: "#ffffff",
      near: 30,
      // Kept inside the default terrain's rim (extent 2400 → 1200 out) so the ground fades into fog
      // before its boundary is reachable.
      far: 670,
    },
    fov: 50,
    sun: {
      azimuth: 135,
      elevation: 25,
      color: "#fff2dd",
      intensity: 0.35,
      linkToSky: true,
    },
  };
}
