export type EffectLayerBlendMode =
  | "normal"
  | "darken"
  | "multiply"
  | "color-burn"
  | "lighten"
  | "screen"
  | "color-dodge"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "difference"
  | "exclusion";

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

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function softLightD(backdrop: number) {
  return backdrop <= 0.25
    ? ((16 * backdrop - 12) * backdrop + 4) * backdrop
    : Math.sqrt(backdrop);
}

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

export function blendChannel(
  mode: EffectLayerBlendMode,
  backdropValue: number,
  sourceValue: number
) {
  const backdrop = clamp01(backdropValue);
  const source = clamp01(sourceValue);

  switch (mode) {
    case "multiply":
      return backdrop * source;
    case "screen":
      return backdrop + source - backdrop * source;
    case "overlay":
      return backdrop <= 0.5
        ? 2 * backdrop * source
        : 1 - 2 * (1 - backdrop) * (1 - source);
    case "darken":
      return Math.min(backdrop, source);
    case "lighten":
      return Math.max(backdrop, source);
    case "color-dodge":
      return backdrop === 0 ? 0 : source === 1 ? 1 : Math.min(1, backdrop / (1 - source));
    case "color-burn":
      return backdrop === 1 ? 1 : source === 0 ? 0 : 1 - Math.min(1, (1 - backdrop) / source);
    case "hard-light":
      return source <= 0.5
        ? 2 * backdrop * source
        : backdrop + (2 * source - 1) - backdrop * (2 * source - 1);
    case "soft-light":
      return source <= 0.5
        ? backdrop - (1 - 2 * source) * backdrop * (1 - backdrop)
        : backdrop + (2 * source - 1) * (softLightD(backdrop) - backdrop);
    case "difference":
      return Math.abs(backdrop - source);
    case "exclusion":
      return backdrop + source - 2 * backdrop * source;
    case "normal":
    default:
      return source;
  }
}

export function compositeBlendChannel(
  mode: EffectLayerBlendMode,
  backdrop: number,
  source: number,
  alpha: number
) {
  const clampedBackdrop = clamp01(backdrop);
  const clampedAlpha = clamp01(alpha);
  const blended = clamp01(blendChannel(mode, clampedBackdrop, source));

  return clamp01(blended * clampedAlpha + clampedBackdrop * (1 - clampedAlpha));
}
