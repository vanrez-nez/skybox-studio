import type { VectorTuple } from "@/runtime";
import {
  clampCloudsParameter,
  type CloudsNumericParameterKey,
  type CloudsState,
} from "@/effects/layers/clouds/state";

// Every operation returns the SAME object reference when nothing changed. The store, EditorSkyboxSync
// and the history stack all bail out on that identity check.

export function setCloudsParameter(
  params: CloudsState,
  parameter: CloudsNumericParameterKey,
  value: number
): CloudsState {
  const nextValue = clampCloudsParameter(parameter, value);

  if (params[parameter] === nextValue) {
    return params;
  }

  return { ...params, [parameter]: nextValue };
}

export function setCloudsColor(params: CloudsState, color: string): CloudsState {
  if (params.color === color) {
    return params;
  }

  return { ...params, color };
}

export function setCloudsShadowColor(params: CloudsState, shadowColor: string): CloudsState {
  if (params.shadowColor === shadowColor) {
    return params;
  }

  return { ...params, shadowColor };
}

export function setCloudsSunDirection(
  params: CloudsState,
  sunDirection: VectorTuple
): CloudsState {
  const [x, y, z] = params.sunDirection;

  if (x === sunDirection[0] && y === sunDirection[1] && z === sunDirection[2]) {
    return params;
  }

  return { ...params, sunDirection: [...sunDirection] as VectorTuple };
}
