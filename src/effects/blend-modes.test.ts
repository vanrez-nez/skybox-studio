import { describe, expect, it } from "vitest";
import * as blendUnit from "color-blend/unit";

import {
  blendChannel,
  compositeBlendChannel,
  type EffectLayerBlendMode,
} from "@/effects/blend-modes";

type UnitColor = {
  a: number;
  b: number;
  g: number;
  r: number;
};

const ORACLE_FUNCTIONS: Record<EffectLayerBlendMode, (backdrop: UnitColor, source: UnitColor) => UnitColor> = {
  "color-burn": blendUnit.colorBurn,
  "color-dodge": blendUnit.colorDodge,
  darken: blendUnit.darken,
  difference: blendUnit.difference,
  exclusion: blendUnit.exclusion,
  "hard-light": blendUnit.hardLight,
  lighten: blendUnit.lighten,
  multiply: blendUnit.multiply,
  normal: blendUnit.normal,
  overlay: blendUnit.overlay,
  screen: blendUnit.screen,
  "soft-light": blendUnit.softLight,
};

const MODES = Object.keys(ORACLE_FUNCTIONS) as EffectLayerBlendMode[];
const CHANNEL_VALUES = [0, 0.03, 0.25, 0.5, 0.75, 0.97, 1];
const SOURCE_ALPHA_VALUES = [0, 0.5, 1];
const UNIT_ORACLE_QUANTIZATION_TOLERANCE = 1 / 255 + 0.000001;

function color(value: number, alpha: number): UnitColor {
  return { a: alpha, b: value, g: value, r: value };
}

describe("blend modes", () => {
  it("matches color-blend/unit with an opaque backdrop", () => {
    MODES.forEach((mode) => {
      CHANNEL_VALUES.forEach((backdrop) => {
        CHANNEL_VALUES.forEach((source) => {
          SOURCE_ALPHA_VALUES.forEach((alpha) => {
            const oracle = ORACLE_FUNCTIONS[mode](color(backdrop, 1), color(source, alpha));

            expect(
              Math.abs(compositeBlendChannel(mode, backdrop, source, alpha) - oracle.r),
              mode
            ).toBeLessThanOrEqual(UNIT_ORACLE_QUANTIZATION_TOLERANCE);
          });
        });
      });
    });
  });

  it("keeps overlay equivalent to hard-light with swapped source/backdrop", () => {
    CHANNEL_VALUES.forEach((backdrop) => {
      CHANNEL_VALUES.forEach((source) => {
        expect(blendChannel("overlay", backdrop, source)).toBeCloseTo(
          blendChannel("hard-light", source, backdrop),
          6
        );
      });
    });
  });

  it("matches soft-light around the W3C backdrop branch point", () => {
    [0.24, 0.25, 0.26].forEach((backdrop) => {
      [0.3, 0.7].forEach((source) => {
        const oracle = blendUnit.softLight(color(backdrop, 1), color(source, 1));

        expect(Math.abs(blendChannel("soft-light", backdrop, source) - oracle.r))
          .toBeLessThanOrEqual(UNIT_ORACLE_QUANTIZATION_TOLERANCE);
      });
    });
  });
});
