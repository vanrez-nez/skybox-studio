import { describe, expect, it } from "vitest";

import {
  createDefaultSkyboxMoonParams,
  createDefaultSpotParams,
  createDefaultSunParams,
  type SkyboxManifestLayer,
  type SkyboxManifestV2,
} from "@/runtime";
import { findSkyLightReference } from "./sky-environment";

function manifestWith(nodes: SkyboxManifestLayer[]): SkyboxManifestV2 {
  return {
    composition: { mode: "alpha-over", order: "bottom-to-top" },
    nodes,
    version: 2,
  };
}

function moonLayer(
  id: string,
  centerDirection: [number, number, number],
  enabled = true
): SkyboxManifestLayer {
  return {
    blendMode: "normal",
    enabled,
    id,
    name: `Moon ${id}`,
    opacity: 100,
    params: createDefaultSkyboxMoonParams(centerDirection),
    type: "moon",
  };
}

function spotLayer(id: string): SkyboxManifestLayer {
  return {
    blendMode: "normal",
    enabled: true,
    id,
    name: `Spot ${id}`,
    opacity: 100,
    params: createDefaultSpotParams(),
    type: "spot",
  };
}

function sunLayer(
  id: string,
  centerDirection: [number, number, number],
  enabled = true
): SkyboxManifestLayer {
  return {
    blendMode: "normal",
    enabled,
    id,
    name: `Sun ${id}`,
    opacity: 100,
    params: { ...createDefaultSunParams(), centerDirection },
    type: "sun",
  };
}

describe("findSkyLightReference", () => {
  it("returns only the first enabled Sun or Moon in layer order", () => {
    const moonFirst = findSkyLightReference(
      manifestWith([moonLayer("moon-first", [0, 3, -4]), sunLayer("sun-second", [1, 0, 0])])
    );
    const sunFirst = findSkyLightReference(
      manifestWith([sunLayer("sun-first", [3, 4, 0]), moonLayer("moon-second", [0, 1, 0])])
    );

    expect(moonFirst).toMatchObject({
      id: "moon-first",
      name: "Moon moon-first",
      type: "moon",
    });
    expect(moonFirst?.direction.x).toBeCloseTo(0);
    expect(moonFirst?.direction.y).toBeCloseTo(0.6);
    expect(moonFirst?.direction.z).toBeCloseTo(-0.8);
    expect(sunFirst).toMatchObject({
      id: "sun-first",
      name: "Sun sun-first",
      type: "sun",
    });
    expect(sunFirst?.direction.x).toBeCloseTo(0.6);
    expect(sunFirst?.direction.y).toBeCloseTo(0.8);
    expect(sunFirst?.direction.z).toBeCloseTo(0);
  });

  it("skips spots and disabled celestial layers", () => {
    const reference = findSkyLightReference(
      manifestWith([
        spotLayer("bright-spot"),
        moonLayer("disabled-moon", [0, 1, 0], false),
        sunLayer("enabled-sun", [1, 0, 0]),
      ])
    );

    expect(reference).toMatchObject({ id: "enabled-sun", type: "sun" });
  });

  it("returns null when the sky has no Sun or Moon reference", () => {
    expect(findSkyLightReference(manifestWith([spotLayer("spot-only")]))).toBeNull();
  });
});
