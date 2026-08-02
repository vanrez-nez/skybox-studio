import { describe, expect, it } from "vitest";

import * as moonOps from "@/effects/layers/moon/operations";
import { createDefaultMoonState } from "@/effects/layers/moon/state";

describe("moon radius scale", () => {
  it("reads 1 at the default placement and scales the angular size", () => {
    const params = createDefaultMoonState();
    expect(moonOps.radiusScaleFromMoon(params)).toBeCloseTo(1, 9);

    const doubled = moonOps.setMoonRadiusScale(params, 2);
    expect(doubled.placement.angularWidth).toBeCloseTo(
      params.placement.baseAngularWidth * 2,
      9,
    );
    expect(doubled.placement.angularHeight).toBeCloseTo(
      params.placement.baseAngularWidth * 2,
      9,
    );
    expect(moonOps.radiusScaleFromMoon(doubled)).toBeCloseTo(2, 9);
    // The base is preserved so the scale stays relative, like the sun's R.
    expect(doubled.placement.baseAngularWidth).toBe(params.placement.baseAngularWidth);
  });

  it("is a no-op at the current scale", () => {
    const params = createDefaultMoonState();
    expect(moonOps.setMoonRadiusScale(params, 1)).toBe(params);
  });
});
