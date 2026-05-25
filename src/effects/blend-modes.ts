import {
  blendChannel,
  compositeBlendChannel,
  type SkyboxLayerBlendMode,
} from "@/runtime/index";

export type EffectLayerBlendMode = SkyboxLayerBlendMode;

export type BlendModeOption = {
  label: string;
  value: EffectLayerBlendMode;
};

export type BlendModeGroup = {
  label: string;
  modes: BlendModeOption[];
};

export const BLEND_MODE_GROUPS: BlendModeGroup[] = [
  {
    label: "Normal",
    modes: [{ label: "Normal", value: "normal" }],
  },
  {
    label: "Darken",
    modes: [
      { label: "Darken", value: "darken" },
      { label: "Multiply", value: "multiply" },
      { label: "Color Burn", value: "color-burn" },
    ],
  },
  {
    label: "Lighten",
    modes: [
      { label: "Lighten", value: "lighten" },
      { label: "Screen", value: "screen" },
      { label: "Color Dodge", value: "color-dodge" },
    ],
  },
  {
    label: "Contrast",
    modes: [
      { label: "Overlay", value: "overlay" },
      { label: "Soft Light", value: "soft-light" },
      { label: "Hard Light", value: "hard-light" },
    ],
  },
  {
    label: "Difference",
    modes: [
      { label: "Difference", value: "difference" },
      { label: "Exclusion", value: "exclusion" },
    ],
  },
];

const BLEND_MODES = new Set<EffectLayerBlendMode>(
  BLEND_MODE_GROUPS.flatMap((group) => group.modes.map((mode) => mode.value))
);

export function isEffectLayerBlendMode(value: unknown): value is EffectLayerBlendMode {
  return typeof value === "string" && BLEND_MODES.has(value as EffectLayerBlendMode);
}

export function normalizeBlendMode(value: unknown): EffectLayerBlendMode {
  if (isEffectLayerBlendMode(value)) {
    return value;
  }

  if (value === "multiply") {
    return "multiply";
  }

  return "normal";
}
export { blendChannel, compositeBlendChannel };
