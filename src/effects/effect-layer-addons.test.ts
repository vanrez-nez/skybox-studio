import { describe, expect, it } from "vitest";

import {
  getEffectLayerAddon,
  getEffectLayerAddons,
  getEffectLayerFocusTarget,
  loadEffectLayer,
  registerEffectLayerAddon,
  serializeEffectLayer,
  type EffectLayer,
} from "@/effects/effect-layer";
import { layerToManifestLayer } from "@/effects/skybox-manifest";
import {
  readEffectLayerInterface,
  writeEffectLayerInterface,
} from "@/effects/effect-layer-interfaces";
import { createAngularDecalPlacement } from "@/runtime/image-placement-transform";
import { createDefaultGradientState } from "@/effects/layers/gradient/state";
import { createDefaultImageState } from "@/effects/layers/image/state";
import { createDefaultMoonState } from "@/effects/layers/moon/state";
import { createDefaultSpotState } from "@/effects/layers/spot/state";

describe("effect layer addons", () => {
  it("registers built-in addons in layer creation order", () => {
    expect(getEffectLayerAddons().map((addon) => addon.type)).toEqual([
      "gradient",
      "clouds",
      "field-gradient",
      "spot",
      "moon",
      "image",
      "starfield",
    ]);
  });

  it("rejects duplicate addon type registration", () => {
    expect(() => registerEffectLayerAddon(getEffectLayerAddon("gradient"))).toThrow(
      /already registered/
    );
  });

  it("converts app params to manifest params through the addon", () => {
    const layer: EffectLayer = {
      blendMode: "normal",
      enabled: true,
      id: "gradient",
      locked: false,
      name: "Gradient",
      opacity: 100,
      params: createDefaultGradientState(),
      type: "gradient",
    };

    const manifestLayer = layerToManifestLayer(layer);

    expect(manifestLayer.type).toBe("gradient");
    expect("selectedStopId" in manifestLayer.params).toBe(false);
  });

  it("exposes focus and transform capabilities through addons", () => {
    const placement = createAngularDecalPlacement({
      angularHeight: 10,
      angularWidth: 10,
      centerDirection: [0, 0, -1],
    });
    const imageLayer: EffectLayer = {
      blendMode: "normal",
      enabled: true,
      id: "image",
      locked: false,
      name: "Image",
      opacity: 100,
      params: {
        ...createDefaultImageState(),
        height: 100,
        placement,
        src: "blob:test",
        width: 100,
      },
      type: "image",
    };
    const spotLayer: EffectLayer = {
      blendMode: "normal",
      enabled: true,
      id: "spot",
      locked: false,
      name: "Spot",
      opacity: 100,
      params: createDefaultSpotState(),
      type: "spot",
    };
    const moonLayer: EffectLayer = {
      blendMode: "normal",
      enabled: true,
      id: "moon",
      locked: false,
      name: "Moon",
      opacity: 100,
      params: createDefaultMoonState([1, 0, 0]),
      type: "moon",
    };

    expect(getEffectLayerFocusTarget(imageLayer)?.direction).toEqual([0, 0, -1]);
    expect(readEffectLayerInterface(imageLayer, "scale")).toEqual({ x: 1, y: 1 });
    expect(readEffectLayerInterface(spotLayer, "2d-position")).not.toBeNull();
    expect(getEffectLayerFocusTarget(moonLayer)?.direction).toEqual([1, 0, 0]);
    expect(readEffectLayerInterface(moonLayer, "2d-position")).toEqual({ x: 0.5, y: 0 });
    expect(readEffectLayerInterface(moonLayer, "scale")).toEqual({ x: 1, y: 1 });
    const movedMoon = writeEffectLayerInterface(
      moonLayer,
      "2d-position",
      { x: -0.5, y: 0.5 },
    );
    expect(readEffectLayerInterface(movedMoon as EffectLayer, "2d-position")?.x)
      .toBeCloseTo(-0.5);
    expect(readEffectLayerInterface(movedMoon as EffectLayer, "2d-position")?.y)
      .toBeCloseTo(0.5);
    expect(writeEffectLayerInterface(spotLayer, "scale", { x: 2, y: 2 })).toBeNull();
  });

  it("round-trips complete Moon state through project serialization", () => {
    const layer: EffectLayer = {
      blendMode: "screen",
      enabled: true,
      id: "moon",
      locked: false,
      name: "Moon",
      opacity: 80,
      params: {
        ...createDefaultMoonState([1, 0, 0]),
        phase: 0.75,
        resolutionMode: "1024",
        style: "cartoon",
      },
      type: "moon",
    };

    expect(loadEffectLayer(serializeEffectLayer(layer))).toEqual(layer);
  });
});
