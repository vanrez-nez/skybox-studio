import { describe, expect, it } from "vitest";

import {
  imageLayerAddon,
  moonLayerAddon,
  spotLayerAddon,
  type EffectLayer,
} from "@/effects/effect-layer";
import { createDefaultCloudsState } from "@/effects/layers/clouds/state";
import * as cloudsOps from "@/effects/layers/clouds/operations";
import { createDefaultImageState } from "@/effects/layers/image/state";
import { createDefaultMoonState } from "@/effects/layers/moon/state";
import { createDefaultSpotState } from "@/effects/layers/spot/state";
import { removeLayerAndDetachLightReferences } from "@/store/modules/layers";

function layer<TParams>(
  type: string,
  id: string,
  params: TParams,
): EffectLayer<TParams> {
  return {
    blendMode: "normal",
    enabled: true,
    id,
    locked: false,
    name: id,
    opacity: 100,
    params,
    type,
  };
}

describe("light-source addon capability", () => {
  it("spot exposes a direction-only source", () => {
    const spot = layer("spot", "spot-1", createDefaultSpotState([1, 0, 0]));
    const source = spotLayerAddon.getLightSource?.(spot);
    expect(source).toEqual({
      direction: [1, 0, 0],
      intensityScale: 1,
      angularRadius: 0,
      rendersOwnDisc: false,
    });
  });

  it("an unplaced image is not a light source", () => {
    const image = layer("image", "image-1", createDefaultImageState());
    expect(imageLayerAddon.getLightSource?.(image)).toBeNull();
  });

  it("moon delegates to the runtime descriptor (scale 1 at defaults)", () => {
    const moon = layer("moon", "moon-1", createDefaultMoonState());
    const source = moonLayerAddon.getLightSource?.(moon);
    expect(source).not.toBeNull();
    expect(source?.intensityScale).toBeCloseTo(1, 6);
    expect(source?.angularRadius).toBeGreaterThan(0);
    expect(source?.rendersOwnDisc).toBe(true);
  });
});

describe("setLightReference baking", () => {
  it("bakes direction, trimmed intensity and disc on unlink", () => {
    let params = createDefaultCloudsState();
    params = cloudsOps.setLightReference(params, "sun", "moon-1");
    params = cloudsOps.setLightIntensity(params, "sun", 40);

    const unlinked = cloudsOps.setLightReference(params, "sun", null, {
      direction: [0, 0, -1],
      intensity: 40 * 0.09,
      disc: false,
    });
    expect(unlinked.sun.directionLayerId).toBeNull();
    expect(unlinked.sun.direction).toEqual([0, 0, -1]);
    expect(unlinked.sun.intensity).toBeCloseTo(3.6, 6);
    expect(unlinked.sun.disc).toBe(false);
  });

  it("clamps a baked intensity to the slider range", () => {
    const params = cloudsOps.setLightReference(
      createDefaultCloudsState(),
      "sun",
      null,
      { intensity: 900 },
    );
    expect(params.sun.intensity).toBe(100);
  });
});

describe("removeLayerAndDetachLightReferences", () => {
  it("bakes a deleted moon reference's effective look into the clouds light", () => {
    const moon = layer("moon", "moon-1", {
      ...createDefaultMoonState(),
      phase: 0.25,
    });
    const moonSource = moonLayerAddon.getLightSource?.(moon);
    if (!moonSource) throw new Error("Expected a moon light source");

    const clouds = createDefaultCloudsState();
    clouds.sun.directionLayerId = "moon-1";
    clouds.sun.intensity = 50;
    clouds.sun.disc = true;

    const next = removeLayerAndDetachLightReferences(
      [layer("clouds", "clouds-1", clouds), moon],
      "moon-1",
    );
    expect(next).toHaveLength(1);
    const sun = (next[0].params as ReturnType<typeof createDefaultCloudsState>)
      .sun;
    expect(sun.directionLayerId).toBeNull();
    expect(sun.direction).toEqual(moonSource.direction);
    expect(sun.intensity).toBeCloseTo(50 * moonSource.intensityScale, 6);
    expect(sun.disc).toBe(false);
  });

  it("keeps the stored light untouched for unrelated deletions", () => {
    const clouds = createDefaultCloudsState();
    clouds.sun.directionLayerId = "spot-1";
    const spot = layer("spot", "spot-1", createDefaultSpotState([0, 1, 0]));
    const other = layer("spot", "spot-2", createDefaultSpotState([1, 0, 0]));

    const next = removeLayerAndDetachLightReferences(
      [layer("clouds", "clouds-1", clouds), spot, other],
      "spot-2",
    );
    const sun = (next[0].params as ReturnType<typeof createDefaultCloudsState>)
      .sun;
    expect(sun.directionLayerId).toBe("spot-1");
  });
});
