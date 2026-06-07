import {
  createDefaultSpotParams,
  normalizeSpotParams,
  type SkyboxSpotParams,
  type VectorTuple,
} from "@/runtime";
import type { GradientStop } from "@/effects/layers/primitives";

export type SpotColorMode = "gradient" | "light";
export type SpotLightParameterKey =
  | "brightness"
  | "coreRadius"
  | "coreSoftness"
  | "dispersion"
  | "dogSpread"
  | "dogStrength"
  | "dogStretch"
  | "glareSize"
  | "glareStrength"
  | "glowSize"
  | "glowStrength"
  | "haloInnerWidth"
  | "haloOuterWidth"
  | "haloRadius"
  | "haloStrength";

export type SpotState = Omit<SkyboxSpotParams, "colorMode" | "stops"> & {
  colorMode: SpotColorMode;
  selectedStopId: string;
  stops: GradientStop[];
};

export const SPOT_LIGHT_PARAMETER_LIMITS: Record<
  SpotLightParameterKey,
  { max: number; min: number }
> = {
  brightness: { min: 0, max: 4 },
  coreRadius: { min: 0.01, max: 0.7 },
  coreSoftness: { min: 0.4, max: 6 },
  dispersion: { min: 0, max: 1 },
  dogSpread: { min: 0.015, max: 0.18 },
  dogStrength: { min: 0, max: 1.8 },
  dogStretch: { min: 0, max: 0.55 },
  glareSize: { min: 0.03, max: 1.1 },
  glareStrength: { min: 0, max: 1.4 },
  glowSize: { min: 0.05, max: 1.4 },
  glowStrength: { min: 0, max: 1 },
  haloInnerWidth: { min: 0.003, max: 0.09 },
  haloOuterWidth: { min: 0.01, max: 0.24 },
  haloRadius: { min: 0.04, max: 1 },
  haloStrength: { min: 0, max: 1.4 },
};

export function createDefaultSpotState(centerDirection?: VectorTuple): SpotState {
  const defaultSpot = centerDirection
    ? normalizeSpotParams({
        ...createDefaultSpotParams(),
        centerDirection,
      })
    : createDefaultSpotParams();

  return {
    ...defaultSpot,
    selectedStopId: "spot-start",
    stops: defaultSpot.stops.map((stop, index) => ({
      ...stop,
      id: index === 0 ? "spot-start" : "spot-end",
      midpoint: stop.midpoint ?? 50,
    })),
  };
}

export function cloneSpotState(spot: SpotState): SpotState {
  const normalizedSpot = normalizeSpotParams(spot);

  return {
    ...normalizedSpot,
    selectedStopId: spot.selectedStopId ?? "spot-start",
    stops: normalizedSpot.stops.map((stop, index) => ({
      ...stop,
      id: spot.stops[index]?.id ?? `spot-stop-${index}`,
      midpoint: stop.midpoint ?? 50,
    })),
  };
}
