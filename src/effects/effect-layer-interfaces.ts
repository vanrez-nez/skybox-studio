import {
  getEffectLayerAddon,
  type EffectLayer,
  type EffectLayerTransformCapability,
  type EffectLayerTransformKind,
  type EffectLayerTransformValueMap,
  type Point3,
} from "@/effects/effect-layer";
import type { Point2 } from "@/runtime/image-placement-transform";

export type EffectLayerInterfaceKind = EffectLayerTransformKind;
export type EffectLayerInterfaceValueMap = EffectLayerTransformValueMap;

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

function getAddonTransformCapability<TKind extends EffectLayerInterfaceKind>(
  layer: EffectLayer,
  kind: TKind
): EffectLayerTransformCapability<TKind> | null {
  return (getEffectLayerAddon(layer.type).transformCapabilities?.[kind] ??
    null) as EffectLayerTransformCapability<TKind> | null;
}

export function readEffectLayerInterface<TKind extends EffectLayerInterfaceKind>(
  layer: EffectLayer,
  kind: TKind
): EffectLayerInterfaceValueMap[TKind] | null {
  return getAddonTransformCapability(layer, kind)?.read(layer) ?? null;
}

export function getEffectLayerInterface<TKind extends EffectLayerInterfaceKind>(
  layer: EffectLayer,
  kind: TKind
): EffectLayerTransformInterface<TKind> | null {
  const capability = getAddonTransformCapability(layer, kind);

  return !capability || capability.read(layer) === null
    ? null
    : {
        kind,
        read: capability.read,
        write: capability.write,
      };
}

export function writeEffectLayerInterface<TKind extends EffectLayerInterfaceKind>(
  layer: EffectLayer,
  kind: TKind,
  value: EffectLayerInterfaceValueMap[TKind]
): EffectLayer | null {
  return getAddonTransformCapability(layer, kind)?.write(layer, value as never) ?? null;
}

export function applyEffectLayerModifier(
  layer: EffectLayer,
  modifier: EffectLayerModifier
): EffectLayer | null {
  if (modifier.interface === "2d-position") {
    const currentValue = readEffectLayerInterface(layer, "2d-position");

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
      : writeEffectLayerInterface(layer, "2d-position", nextValue);
  }

  if (modifier.interface === "3d-position") {
    const currentValue = readEffectLayerInterface(layer, "3d-position");

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
      : writeEffectLayerInterface(layer, "3d-position", nextValue);
  }

  if (modifier.interface === "rotation") {
    const currentValue = readEffectLayerInterface(layer, "rotation");

    if (currentValue === null) {
      return null;
    }

    const nextValue =
      modifier.operation === "rotate" ? currentValue + modifier.delta : modifier.value;

    return currentValue === nextValue
      ? null
      : writeEffectLayerInterface(layer, "rotation", nextValue);
  }

  const currentValue = readEffectLayerInterface(layer, "scale");

  if (!currentValue) {
    return null;
  }

  return point2Equals(currentValue, modifier.value)
    ? null
    : writeEffectLayerInterface(layer, "scale", modifier.value);
}
