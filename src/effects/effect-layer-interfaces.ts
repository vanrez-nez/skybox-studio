import type { EffectLayer } from "@/effects/effect-layer";
import {
  placementFromPosition,
  placementFromRotation,
  placementFromScale,
  positionFromPlacement,
  rotationFromPlacement,
  scaleFromPlacement,
  type Point2,
} from "@/runtime/image-placement-transform";
import {
  positionFromSpot,
  spotFromPosition,
} from "@/runtime/spot-transform";

export type Point3 = {
  x: number;
  y: number;
  z: number;
};

export type EffectLayerInterfaceKind =
  | "2d-position"
  | "3d-position"
  | "rotation"
  | "scale";

export type EffectLayerInterfaceValueMap = {
  "2d-position": Point2;
  "3d-position": Point3;
  rotation: number;
  scale: Point2;
};

export type EffectLayerTransformInterface<TKind extends EffectLayerInterfaceKind> = {
  kind: TKind;
  read: (layer: EffectLayer) => EffectLayerInterfaceValueMap[TKind] | null;
  write: (
    layer: EffectLayer,
    value: EffectLayerInterfaceValueMap[TKind]
  ) => EffectLayer | null;
};

export type EffectLayerModifier =
  | {
      delta: Point2;
      interface: "2d-position";
      operation: "translate";
    }
  | {
      interface: "2d-position";
      operation: "set";
      value: Point2;
    }
  | {
      delta: Point3;
      interface: "3d-position";
      operation: "translate";
    }
  | {
      interface: "3d-position";
      operation: "set";
      value: Point3;
    }
  | {
      delta: number;
      interface: "rotation";
      operation: "rotate";
    }
  | {
      interface: "rotation";
      operation: "set";
      value: number;
    }
  | {
      interface: "scale";
      operation: "set";
      value: Point2;
    };

function point2Equals(first: Point2, second: Point2) {
  return first.x === second.x && first.y === second.y;
}

function point3Equals(first: Point3, second: Point3) {
  return first.x === second.x && first.y === second.y && first.z === second.z;
}

export const effectLayer2DPositionInterface: EffectLayerTransformInterface<"2d-position"> = {
  kind: "2d-position",
  read: (layer) => {
    if (layer.type === "image" && layer.params.placement) {
      return positionFromPlacement(layer.params.placement);
    }

    if (layer.type === "spot") {
      return positionFromSpot(layer.params);
    }

    return null;
  },
  write: (layer, value) => {
    if (layer.type === "image" && layer.params.placement) {
      return {
        ...layer,
        params: {
          ...layer.params,
          placement: placementFromPosition(layer.params.placement, value),
        },
      };
    }

    if (layer.type === "spot") {
      return {
        ...layer,
        params: {
          ...layer.params,
          centerDirection: spotFromPosition(layer.params, value).centerDirection,
        },
      };
    }

    return null;
  },
};

export const effectLayer3DPositionInterface: EffectLayerTransformInterface<"3d-position"> = {
  kind: "3d-position",
  read: () => null,
  write: () => null,
};

export const effectLayerRotationInterface: EffectLayerTransformInterface<"rotation"> = {
  kind: "rotation",
  read: (layer) => {
    if (layer.type === "image" && layer.params.placement) {
      return rotationFromPlacement(layer.params.placement);
    }

    if (layer.type === "gradient") {
      return layer.params.rotation;
    }

    return null;
  },
  write: (layer, value) => {
    if (layer.type === "image" && layer.params.placement) {
      return {
        ...layer,
        params: {
          ...layer.params,
          placement: placementFromRotation(layer.params.placement, value),
        },
      };
    }

    if (layer.type === "gradient") {
      return {
        ...layer,
        params: {
          ...layer.params,
          rotation: value,
        },
      };
    }

    return null;
  },
};

export const effectLayerScaleInterface: EffectLayerTransformInterface<"scale"> = {
  kind: "scale",
  read: (layer) => {
    if (layer.type === "image" && layer.params.placement) {
      return scaleFromPlacement(layer.params.placement);
    }

    return null;
  },
  write: (layer, value) => {
    if (layer.type === "image" && layer.params.placement) {
      return {
        ...layer,
        params: {
          ...layer.params,
          placement: placementFromScale(layer.params.placement, value),
        },
      };
    }

    return null;
  },
};

export const effectLayerTransformInterfaces = {
  "2d-position": effectLayer2DPositionInterface,
  "3d-position": effectLayer3DPositionInterface,
  rotation: effectLayerRotationInterface,
  scale: effectLayerScaleInterface,
};

export function readEffectLayerInterface<TKind extends EffectLayerInterfaceKind>(
  layer: EffectLayer,
  kind: TKind
): EffectLayerInterfaceValueMap[TKind] | null {
  return effectLayerTransformInterfaces[kind].read(layer) as
    | EffectLayerInterfaceValueMap[TKind]
    | null;
}

export function getEffectLayerInterface<TKind extends EffectLayerInterfaceKind>(
  layer: EffectLayer,
  kind: TKind
): EffectLayerTransformInterface<TKind> | null {
  return readEffectLayerInterface(layer, kind) === null
    ? null
    : (effectLayerTransformInterfaces[kind] as unknown as EffectLayerTransformInterface<TKind>);
}

export function writeEffectLayerInterface<TKind extends EffectLayerInterfaceKind>(
  layer: EffectLayer,
  kind: TKind,
  value: EffectLayerInterfaceValueMap[TKind]
): EffectLayer | null {
  return effectLayerTransformInterfaces[kind].write(layer, value as never);
}

export function applyEffectLayerModifier(
  layer: EffectLayer,
  modifier: EffectLayerModifier
): EffectLayer | null {
  if (modifier.interface === "2d-position") {
    const currentValue = effectLayer2DPositionInterface.read(layer);

    if (!currentValue) {
      return null;
    }

    const nextValue =
      modifier.operation === "translate"
        ? {
            x: currentValue.x + modifier.delta.x,
            y: currentValue.y + modifier.delta.y,
          }
        : modifier.value;

    return point2Equals(currentValue, nextValue)
      ? null
      : effectLayer2DPositionInterface.write(layer, nextValue);
  }

  if (modifier.interface === "3d-position") {
    const currentValue = effectLayer3DPositionInterface.read(layer);

    if (!currentValue) {
      return null;
    }

    const nextValue =
      modifier.operation === "translate"
        ? {
            x: currentValue.x + modifier.delta.x,
            y: currentValue.y + modifier.delta.y,
            z: currentValue.z + modifier.delta.z,
          }
        : modifier.value;

    return point3Equals(currentValue, nextValue)
      ? null
      : effectLayer3DPositionInterface.write(layer, nextValue);
  }

  if (modifier.interface === "rotation") {
    const currentValue = effectLayerRotationInterface.read(layer);

    if (currentValue === null) {
      return null;
    }

    const nextValue =
      modifier.operation === "rotate" ? currentValue + modifier.delta : modifier.value;

    return currentValue === nextValue
      ? null
      : effectLayerRotationInterface.write(layer, nextValue);
  }

  const currentValue = effectLayerScaleInterface.read(layer);

  if (!currentValue) {
    return null;
  }

  return point2Equals(currentValue, modifier.value)
    ? null
    : effectLayerScaleInterface.write(layer, modifier.value);
}
