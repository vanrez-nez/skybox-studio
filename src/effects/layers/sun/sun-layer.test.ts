import { describe, expect, it } from "vitest";

import {
  moonLayerAddon,
  spotLayerAddon,
  sunLayerAddon,
  type EffectLayer,
} from "@/effects/effect-layer";
import { createDefaultMoonState } from "@/effects/layers/moon/state";
import { createDefaultSpotState } from "@/effects/layers/spot/state";
import * as sunOps from "@/effects/layers/sun/operations";
import { cloneSunState, createDefaultSunState } from "@/effects/layers/sun/state";
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

describe("sun layer addon", () => {
  it("exposes an un-dimmed light source from editor state", () => {
    const sun = layer("sun", "sun-1", createDefaultSunState());
    const source = sunLayerAddon.getLightSource?.(sun);
    expect(source?.intensityScale).toBeCloseTo(1, 9);
    expect(source?.rendersOwnDisc).toBe(true);
    expect(source?.angularRadius).toBeGreaterThan(0);
  });

  it("only disc-bearing sources qualify as eclipse occluders", () => {
    const moonSource = moonLayerAddon.getLightSource?.(
      layer("moon", "moon-1", createDefaultMoonState()),
    );
    const spotSource = spotLayerAddon.getLightSource?.(
      layer("spot", "spot-1", createDefaultSpotState([1, 0, 0])),
    );
    expect(moonSource && moonSource.angularRadius > 0).toBe(true);
    expect(spotSource?.angularRadius).toBe(0);
  });

  it("serializes without resolution outputs", () => {
    const withResolved = {
      ...createDefaultSunState(),
      resolvedOccluderAngularRadius: 0.2,
      resolvedOccluderDirection: [0, 0, -1] as [number, number, number],
    };
    const cloned = cloneSunState(withResolved);
    expect("resolvedOccluderAngularRadius" in cloned).toBe(false);
    expect("resolvedOccluderDirection" in cloned).toBe(false);

    const serialized = sunLayerAddon.serialize(withResolved);
    expect("resolvedOccluderDirection" in serialized.params).toBe(false);
  });

  it("sets and clears the occluder reference", () => {
    let params = createDefaultSunState();
    params = sunOps.setSunOccluderReference(params, "moon-1");
    expect(params.occluderLayerId).toBe("moon-1");
    expect(sunOps.setSunOccluderReference(params, "moon-1")).toBe(params);
    params = sunOps.setSunOccluderReference(params, null);
    expect(params.occluderLayerId).toBeNull();
  });
});

describe("occluder detach on delete", () => {
  it("clears a sun's occluder reference without baking anything", () => {
    const sun = createDefaultSunState();
    sun.occluderLayerId = "moon-1";
    sun.exposure = 2.5;

    const next = removeLayerAndDetachLightReferences(
      [
        layer("sun", "sun-1", sun),
        layer("moon", "moon-1", createDefaultMoonState()),
      ],
      "moon-1",
    );
    expect(next).toHaveLength(1);
    const params = next[0].params as ReturnType<typeof createDefaultSunState>;
    expect(params.occluderLayerId).toBeNull();
    expect(params.exposure).toBe(2.5);
  });

  it("clears a moon's light reference when its light source is deleted", () => {
    const moon = { ...createDefaultMoonState(), lightLayerId: "sun-1" };

    const next = removeLayerAndDetachLightReferences(
      [
        layer("sun", "sun-1", createDefaultSunState()),
        layer("moon", "moon-1", moon),
      ],
      "sun-1",
    );
    expect(next).toHaveLength(1);
    const params = next[0].params as typeof moon;
    expect(params.lightLayerId).toBeNull();
  });

  it("leaves unrelated sun layers untouched", () => {
    const sun = createDefaultSunState();
    sun.occluderLayerId = "moon-1";
    const sunLayer = layer("sun", "sun-1", sun);

    const next = removeLayerAndDetachLightReferences(
      [
        sunLayer,
        layer("moon", "moon-1", createDefaultMoonState()),
        layer("moon", "moon-2", createDefaultMoonState()),
      ],
      "moon-2",
    );
    expect(next.find((candidate) => candidate.id === "sun-1")).toBe(sunLayer);
  });
});
