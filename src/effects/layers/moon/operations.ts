import {
  MOON_STYLE_EXPOSURE,
  createAngularDecalPlacement,
  IMAGE_PLACEMENT_ELEVATION_LIMIT,
  placementFromPosition,
  positionFromPlacement,
  type Point2,
  type SkyboxMoonResolutionMode,
  type SkyboxMoonStyle,
} from "@/runtime";

import type { MoonState } from "./state";

export type MoonNumericKey = {
  [K in keyof MoonState]-?: MoonState[K] extends number ? K : never;
}[keyof MoonState];

const MOON_POSITION_X_TO_AZIMUTH = 180;
const MOON_POSITION_Y_TO_ELEVATION = IMAGE_PLACEMENT_ELEVATION_LIMIT;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function setMoonNumber(
  params: MoonState,
  key: MoonNumericKey,
  value: number,
  min = -Infinity,
  max = Infinity,
): MoonState {
  const next = clamp(value, min, max);
  return params[key] === next ? params : { ...params, [key]: next };
}

export function setMoonBoolean(
  params: MoonState,
  key: "cartoonCrop",
  value: boolean,
): MoonState {
  return params[key] === value ? params : { ...params, [key]: value };
}

export function setMoonColor(
  params: MoonState,
  key: "baseColor" | "mareColor" | "nightColor",
  value: string,
): MoonState {
  return params[key] === value ? params : { ...params, [key]: value };
}

export function setMoonStyle(params: MoonState, style: SkyboxMoonStyle): MoonState {
  return params.style === style
    ? params
    : { ...params, exposure: MOON_STYLE_EXPOSURE[style], style };
}

/**
 * Dynamic lighting link: when set, the runtime derives the moon's sun
 * direction and photometric phase from the referenced layer's geometry, and
 * the manual phase/sunTilt sliders are ignored.
 */
export function setMoonLightReference(
  params: MoonState,
  lightLayerId: string | null,
): MoonState {
  return params.lightLayerId === lightLayerId
    ? params
    : { ...params, lightLayerId };
}

export function setMoonResolutionMode(
  params: MoonState,
  resolutionMode: SkyboxMoonResolutionMode,
): MoonState {
  return params.resolutionMode === resolutionMode
    ? params
    : { ...params, resolutionMode };
}

export function positionFromMoon(params: MoonState): Point2 {
  const angles = positionFromPlacement(params.placement);

  return {
    x: angles.x / MOON_POSITION_X_TO_AZIMUTH,
    y: angles.y / MOON_POSITION_Y_TO_ELEVATION,
  };
}

export function setMoonPosition(params: MoonState, position: Point2): MoonState {
  const current = positionFromMoon(params);
  if (current.x === position.x && current.y === position.y) return params;
  return {
    ...params,
    placement: placementFromPosition(params.placement, {
      x: clamp(position.x, -1, 1) * MOON_POSITION_X_TO_AZIMUTH,
      y: clamp(position.y, -1, 1) * MOON_POSITION_Y_TO_ELEVATION,
    }),
  };
}

export function setMoonCenterDirection(
  params: MoonState,
  centerDirection: [number, number, number],
): MoonState {
  const current = params.placement.centerDirection;
  if (current.every((component, index) => component === centerDirection[index])) {
    return params;
  }

  return {
    ...params,
    placement: createAngularDecalPlacement({
      angularHeight: params.placement.angularHeight,
      angularWidth: params.placement.angularWidth,
      baseAngularHeight: params.placement.baseAngularHeight,
      baseAngularWidth: params.placement.baseAngularWidth,
      centerDirection,
    }),
  };
}

/** Radius as a scale of the base angular size — the sun/spot "R" semantics. */
export function radiusScaleFromMoon(params: MoonState) {
  return (
    params.placement.angularWidth /
    Math.max(params.placement.baseAngularWidth, 0.0001)
  );
}

export function setMoonRadiusScale(params: MoonState, radiusScale: number): MoonState {
  const scale = Math.max(0.01, radiusScale);

  if (radiusScaleFromMoon(params) === scale) {
    return params;
  }

  return setMoonAngularSize(
    params,
    params.placement.baseAngularWidth * scale,
  );
}

export function setMoonAngularSize(params: MoonState, angularSize: number): MoonState {
  const size = clamp(angularSize, 0.001, Math.PI * 0.95);
  if (
    params.placement.angularHeight === size &&
    params.placement.angularWidth === size
  ) {
    return params;
  }

  return {
    ...params,
    placement: createAngularDecalPlacement({
      angularHeight: size,
      angularWidth: size,
      baseAngularHeight: params.placement.baseAngularHeight,
      baseAngularWidth: params.placement.baseAngularWidth,
      centerDirection: params.placement.centerDirection,
    }),
  };
}
