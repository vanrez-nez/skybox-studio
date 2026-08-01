import {
  cloneSkyboxMoonParams,
  createDefaultSkyboxMoonParams,
  normalizeSkyboxMoonParams,
  type SkyboxMoonParams,
} from "@/runtime";

export type MoonState = SkyboxMoonParams;

export const MOON_PLACEMENT_TRANSACTION_SCOPE = "moon-placement";

export function createDefaultMoonState(
  centerDirection?: [number, number, number],
): MoonState {
  return createDefaultSkyboxMoonParams(centerDirection);
}

export function cloneMoonState(params: MoonState): MoonState {
  return cloneSkyboxMoonParams(params);
}

export function loadMoonState(value: Partial<MoonState> | null | undefined): MoonState {
  return normalizeSkyboxMoonParams(value);
}
