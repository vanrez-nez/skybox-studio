import { describe, expect, it } from "vitest";

import {
  applyEffectLayerModifier,
  readEffectLayerInterface,
} from "@/effects/effect-layer-interfaces";
import type { EffectLayer } from "@/effects/effect-layer";
import { createAngularDecalPlacement } from "@/runtime/image-placement-transform";
import { createDefaultFieldGradientState } from "@/store/modules/layer-field-gradient";
import { createDefaultGradientState } from "@/store/modules/layer-gradient";
import { createDefaultSpotState } from "@/store/modules/layer-spot";

const COMMON_LAYER_FIELDS = {
  blendMode: "normal" as const,
  enabled: true,
  locked: false,
  opacity: 100,
};

function createImageLayer(): EffectLayer {
  return {
    ...COMMON_LAYER_FIELDS,
    id: "image",
    name: "Image",
    params: {
      assetId: null,
      byteSize: 0,
      fileName: "",
      height: 16,
      loadedAt: 0,
      mimeType: "image/png",
      pixels: null,
      placement: createAngularDecalPlacement({
        angularHeight: 0.25,
        angularWidth: 0.25,
        centerDirection: [0, 0, -1],
      }),
      src: "blob:image",
      width: 16,
    },
    type: "image",
  };
}

function createSpotLayer(): EffectLayer {
  return {
    ...COMMON_LAYER_FIELDS,
    id: "spot",
    name: "Spot",
    params: createDefaultSpotState(),
    type: "spot",
  };
}

function createGradientLayer(): EffectLayer {
  return {
    ...COMMON_LAYER_FIELDS,
    id: "gradient",
    name: "Gradient",
    params: createDefaultGradientState(),
    type: "gradient",
  };
}

function createFieldGradientLayer(): EffectLayer {
  return {
    ...COMMON_LAYER_FIELDS,
    id: "field-gradient",
    name: "Field Gradient",
    params: createDefaultFieldGradientState(),
    type: "field-gradient",
  };
}

describe("effect layer transform interfaces", () => {
  it("exposes position, rotation, and scale for placed image layers", () => {
    const imageLayer = createImageLayer();

    expect(readEffectLayerInterface(imageLayer, "2d-position")).toEqual({ x: 0, y: 0 });
    expect(readEffectLayerInterface(imageLayer, "rotation")).toBe(0);
    expect(readEffectLayerInterface(imageLayer, "scale")).toEqual({ x: 1, y: 1 });
  });

  it("exposes only 2D position for spot layers", () => {
    const spotLayer = createSpotLayer();

    expect(readEffectLayerInterface(spotLayer, "2d-position")).toEqual({ x: 0, y: 0 });
    expect(readEffectLayerInterface(spotLayer, "rotation")).toBeNull();
    expect(readEffectLayerInterface(spotLayer, "scale")).toBeNull();
    expect(readEffectLayerInterface(spotLayer, "3d-position")).toBeNull();
  });

  it("exposes only rotation for gradient layers", () => {
    const gradientLayer = createGradientLayer();

    expect(readEffectLayerInterface(gradientLayer, "rotation")).toBe(0);
    expect(readEffectLayerInterface(gradientLayer, "2d-position")).toBeNull();
    expect(readEffectLayerInterface(gradientLayer, "scale")).toBeNull();
  });

  it("exposes no transform interfaces for field gradient layers", () => {
    const fieldGradientLayer = createFieldGradientLayer();

    expect(readEffectLayerInterface(fieldGradientLayer, "2d-position")).toBeNull();
    expect(readEffectLayerInterface(fieldGradientLayer, "3d-position")).toBeNull();
    expect(readEffectLayerInterface(fieldGradientLayer, "rotation")).toBeNull();
    expect(readEffectLayerInterface(fieldGradientLayer, "scale")).toBeNull();
  });

  it("applies supported modifiers and skips unsupported modifiers", () => {
    const imageLayer = createImageLayer();
    const movedImageLayer = applyEffectLayerModifier(imageLayer, {
      delta: { x: 4, y: -2 },
      interface: "2d-position",
      operation: "translate",
    });
    const gradientLayer = createGradientLayer();
    const rotatedGradientLayer = applyEffectLayerModifier(gradientLayer, {
      delta: 15,
      interface: "rotation",
      operation: "rotate",
    });

    const movedImagePosition = readEffectLayerInterface(
      movedImageLayer as EffectLayer,
      "2d-position"
    );

    expect(movedImagePosition?.x).toBeCloseTo(4);
    expect(movedImagePosition?.y).toBeCloseTo(-2);
    expect(readEffectLayerInterface(rotatedGradientLayer as EffectLayer, "rotation"))
      .toBe(15);
    expect(applyEffectLayerModifier(createFieldGradientLayer(), {
      delta: { x: 1, y: 1 },
      interface: "2d-position",
      operation: "translate",
    })).toBeNull();
  });
});
