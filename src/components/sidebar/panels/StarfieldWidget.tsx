import starfieldQualityHelp from "@/help/starfield-quality.md?raw";
import { FieldGradientGroup } from "@/components/ui/composables/field-gradient-group";
import { FloatingColorPicker } from "@/components/ui/composables/FloatingColorPicker";
import { HelpHint } from "@/components/ui/composables/help-hint";
import { FieldGroup } from "@/components/ui/primitives/field-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { Slider } from "@/components/ui/primitives/slider";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives/tabs";
import type { SkyboxStarfieldClipParams } from "@/runtime/manifest";
import * as starfieldOps from "@/effects/layers/starfield/operations";
import {
  createDefaultStarfieldState,
  type StarfieldClipParameterKey,
  type StarfieldColor,
  type StarfieldNebulaColorKey,
  type StarfieldNebulaParameterKey,
  type StarfieldQuality,
  type StarfieldStarsParameterKey,
  type StarfieldState,
} from "@/effects/layers/starfield/state";
import type { StarfieldFieldAnchor } from "@/effects/layers/starfield/state";
import { useWorkspaceStore } from "@/store/app";
import { useSelectedLayerParams } from "@/store/use-selected-layer";
import { Widget } from "./Widget";

type SliderHistoryOptions = {
  history?: "checkpoint" | "skip";
};

type StarfieldSliderProps<TParameter extends string> = {
  format?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (parameter: TParameter, value: number, options?: SliderHistoryOptions) => void;
  parameter: TParameter;
  step: number;
  value: number;
};

const CLIP_CONTROLS: Array<{
  label: string;
  max: number;
  min: number;
  parameter: StarfieldClipParameterKey;
  step: number;
}> = [
  { parameter: "azimuthCenterDeg", label: "Azimuth", min: -180, max: 180, step: 1 },
  { parameter: "altitudeCenterDeg", label: "Altitude", min: -90, max: 90, step: 1 },
  { parameter: "azimuthSpanDeg", label: "Azimuth span", min: 1, max: 360, step: 1 },
  { parameter: "altitudeSpanDeg", label: "Altitude span", min: 1, max: 180, step: 1 },
];

const CLIP_PRESETS = [
  {
    id: "disable",
    label: "Disable",
    clip: { azimuthCenterDeg: 0, altitudeCenterDeg: 0, azimuthSpanDeg: 360, altitudeSpanDeg: 180 },
  },
  {
    id: "upper-half",
    label: "Upper Half",
    clip: { azimuthCenterDeg: 0, altitudeCenterDeg: 45, azimuthSpanDeg: 360, altitudeSpanDeg: 90 },
  },
  {
    id: "bottom-half",
    label: "Bottom Half",
    clip: { azimuthCenterDeg: 0, altitudeCenterDeg: -45, azimuthSpanDeg: 360, altitudeSpanDeg: 90 },
  },
  {
    id: "front-half",
    label: "Front Half",
    clip: { azimuthCenterDeg: 0, altitudeCenterDeg: 0, azimuthSpanDeg: 180, altitudeSpanDeg: 180 },
  },
  {
    id: "back-half",
    label: "Back Half",
    clip: { azimuthCenterDeg: 180, altitudeCenterDeg: 0, azimuthSpanDeg: 180, altitudeSpanDeg: 180 },
  },
] as const satisfies ReadonlyArray<{
  clip: SkyboxStarfieldClipParams;
  id: string;
  label: string;
}>;

type ClipPresetId = (typeof CLIP_PRESETS)[number]["id"] | "custom";

const STAR_CONTROLS: Array<{
  label: string;
  max: number;
  min: number;
  parameter: StarfieldStarsParameterKey;
  step: number;
}> = [
  { parameter: "uDensity", label: "Density", min: 0, max: 2000, step: 1 },
  { parameter: "uStarSize", label: "Size", min: 0.01, max: 8, step: 0.01 },
  { parameter: "uSizeVar", label: "Size variance", min: 0, max: 1, step: 0.01 },
  { parameter: "uLargeStarRarity", label: "Large rarity", min: 0, max: 1, step: 0.01 },
  { parameter: "uBright", label: "Brightness", min: 0, max: 8, step: 0.01 },
  { parameter: "uBrightVar", label: "Brightness variance", min: 0, max: 1, step: 0.01 },
  { parameter: "uGlareSize", label: "Glare size", min: 0, max: 12, step: 0.01 },
  { parameter: "uGlareStr", label: "Glare strength", min: 0, max: 4, step: 0.01 },
  { parameter: "uGlareVar", label: "Glare variance", min: 0, max: 1, step: 0.01 },
  { parameter: "uColorVar", label: "Color variance", min: 0, max: 1, step: 0.01 },
  { parameter: "uSeed", label: "Seed", min: -1000, max: 1000, step: 1 },
];

const NEBULA_CONTROLS: Array<{
  label: string;
  max: number;
  min: number;
  parameter: StarfieldNebulaParameterKey;
  step: number;
}> = [
  { parameter: "uCoverage", label: "Coverage", min: 0.02, max: 0.98, step: 0.01 },
  { parameter: "uDensity", label: "Density", min: 0, max: 10, step: 0.01 },
  { parameter: "uSoftness", label: "Softness", min: 0.001, max: 2, step: 0.001 },
  { parameter: "uContrast", label: "Contrast", min: 0.05, max: 12, step: 0.01 },
  { parameter: "uBaseScale", label: "Base scale", min: 0.001, max: 100, step: 0.01 },
  { parameter: "uOctaves", label: "Octaves", min: 1, max: 8, step: 1 },
  { parameter: "uOpacity", label: "Opacity", min: 0, max: 1, step: 0.01 },
  { parameter: "uLightIntensity", label: "Light intensity", min: 0, max: 4, step: 0.01 },
  { parameter: "uLightFocus", label: "Light focus", min: 0.001, max: 8, step: 0.01 },
  { parameter: "uLightLining", label: "Light lining", min: 0, max: 4, step: 0.01 },
  { parameter: "uNebulaStrength", label: "Strength", min: 0, max: 20, step: 0.01 },
  { parameter: "uNebulaExposure", label: "Exposure", min: 0.001, max: 4, step: 0.01 },
  { parameter: "uColorWarpAmp", label: "Color warp amp", min: 0, max: 1, step: 0.001 },
  { parameter: "uColorWarpFreq", label: "Color warp freq", min: 0.001, max: 20, step: 0.01 },
  { parameter: "uSeed", label: "Seed", min: -1000, max: 1000, step: 0.1 },
];

const NEBULA_COLORS: Array<{ label: string; parameter: StarfieldNebulaColorKey }> = [
  { parameter: "uCloudShadow", label: "Shadow" },
  { parameter: "uCloudCore", label: "Core" },
  { parameter: "uCloudHighlight", label: "Highlight" },
];

function formatValue(value: number) {
  const roundedValue = Number(value.toFixed(3));

  return Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : `${roundedValue}`;
}

function colorToHex(color: StarfieldColor) {
  return `#${color
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

function hexToColor(hex: string): StarfieldColor {
  const value = hex.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return [1, 1, 1];
  }

  return [0, 2, 4].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16) / 255
  ) as StarfieldColor;
}

function getMatchingClipPresetId(clip: SkyboxStarfieldClipParams): ClipPresetId {
  return (
    CLIP_PRESETS.find((preset) =>
      CLIP_CONTROLS.every((control) => clip[control.parameter] === preset.clip[control.parameter])
    )?.id ?? "custom"
  );
}

function StarfieldSlider<TParameter extends string>({
  format = formatValue,
  label,
  max,
  min,
  onChange,
  parameter,
  step,
  value,
}: StarfieldSliderProps<TParameter>) {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground/70">
        <span>{label}</span>
        <span className="font-mono text-foreground">{format(value)}</span>
      </div>
      <Slider
        aria-label={label}
        max={max}
        min={min}
        onPointerCancel={() => commitHistoryTransaction()}
        onPointerDown={() => beginHistoryTransaction()}
        onValueChange={(sliderValue) =>
          onChange(parameter, sliderValue[0] ?? value, { history: "skip" })
        }
        onValueCommit={(sliderValue) => {
          onChange(parameter, sliderValue[0] ?? value, { history: "skip" });
          commitHistoryTransaction();
        }}
        step={step}
        value={[value]}
      />
    </div>
  );
}

function ColorField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (color: StarfieldColor, options?: SliderHistoryOptions) => void;
  value: StarfieldColor;
}) {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground/70">
      <span>{label}</span>
      <FloatingColorPicker
        onChange={(color) => onChange(hexToColor(color), { history: "skip" })}
        onChangeEnd={commitHistoryTransaction}
        onChangeStart={beginHistoryTransaction}
        value={colorToHex(value)}
      />
    </div>
  );
}

export function StarfieldWidget() {
  type HistoryOptions = { history?: "checkpoint" | "skip" };
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const updateSelectedLayerParams = useWorkspaceStore((state) => state.updateSelectedLayerParams);
  const starfield = useSelectedLayerParams<StarfieldState>("starfield") ?? createDefaultStarfieldState();
  const addAnchor = (anchor: Omit<StarfieldFieldAnchor, "id">) =>
    updateSelectedLayerParams((params) =>
      starfieldOps.addStarfieldFieldAnchor(params as StarfieldState, anchor)
    );
  const randomizeField = () =>
    updateSelectedLayerParams((params) =>
      starfieldOps.randomizeStarfieldField(params as StarfieldState)
    );
  const removeAnchor = (id: string) =>
    updateSelectedLayerParams((params) =>
      starfieldOps.removeStarfieldFieldAnchor(params as StarfieldState, id)
    );
  const resetField = () =>
    updateSelectedLayerParams((params) =>
      starfieldOps.resetStarfieldField(params as StarfieldState)
    );
  const selectAnchor = (id: string) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.selectStarfieldFieldAnchor(params as StarfieldState, id),
      { history: "skip" }
    );
  const setClip = (clip: SkyboxStarfieldClipParams, options?: HistoryOptions) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.setStarfieldClip(params as StarfieldState, clip),
      options
    );
  const setClipParameter = (
    parameter: StarfieldClipParameterKey,
    value: number,
    options?: HistoryOptions
  ) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.setStarfieldClipParameter(params as StarfieldState, parameter, value),
      options
    );
  const setFieldAmplitude = (amplitude: number, options?: HistoryOptions) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.setStarfieldFieldAmplitude(params as StarfieldState, amplitude),
      options
    );
  const setFieldFrequency = (frequency: number, options?: HistoryOptions) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.setStarfieldFieldFrequency(params as StarfieldState, frequency),
      options
    );
  const setFieldMode = (mode: StarfieldState["nebulaField"]["mode"]) =>
    updateSelectedLayerParams((params) =>
      starfieldOps.setStarfieldFieldMode(params as StarfieldState, mode)
    );
  const setFieldPower = (power: number, options?: HistoryOptions) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.setStarfieldFieldPower(params as StarfieldState, power),
      options
    );
  const setNebulaColor = (
    parameter: StarfieldNebulaColorKey,
    color: StarfieldColor,
    options?: HistoryOptions
  ) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.setStarfieldNebulaColor(params as StarfieldState, parameter, color),
      options
    );
  const setNebulaParameter = (
    parameter: StarfieldNebulaParameterKey,
    value: number,
    options?: HistoryOptions
  ) =>
    updateSelectedLayerParams(
      (params) =>
        starfieldOps.setStarfieldNebulaParameter(params as StarfieldState, parameter, value),
      options
    );
  const setQuality = (quality: StarfieldQuality) =>
    updateSelectedLayerParams((params) =>
      starfieldOps.setStarfieldQuality(params as StarfieldState, quality)
    );
  const setStarsParameter = (
    parameter: StarfieldStarsParameterKey,
    value: number,
    options?: HistoryOptions
  ) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.setStarfieldStarsParameter(params as StarfieldState, parameter, value),
      options
    );
  const updateAnchor = (
    id: string,
    update: Partial<Omit<StarfieldFieldAnchor, "id">>,
    options?: HistoryOptions
  ) =>
    updateSelectedLayerParams(
      (params) => starfieldOps.updateStarfieldFieldAnchor(params as StarfieldState, id, update),
      options
    );

  return (
    <Widget title="Starfield" contentClassName="grid min-h-0 gap-3 overflow-y-auto p-3">
      <div className="widget-inline-fields">
        <div className="widget-field widget-field-mode">
          <span className="text-xs">Quality</span>
          <div className="flex min-w-0 items-center gap-1">
            <Select
              onValueChange={(value) => setQuality(value as StarfieldQuality)}
              value={starfield.quality}
            >
              <SelectTrigger
                aria-label="Starfield quality"
                className="min-w-0 flex-1 bg-background text-xs"
                size="xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="low">
                  Low
                </SelectItem>
                <SelectItem className="text-xs" value="medium">
                  Medium
                </SelectItem>
                <SelectItem className="text-xs" value="high">
                  High
                </SelectItem>
              </SelectContent>
            </Select>
            <HelpHint
              ariaLabel="How starfield quality works"
              className="shrink-0"
              doc={starfieldQualityHelp}
              size="xs"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="stars">
        <TabsList className="w-full">
          <TabsTrigger className="flex-1" value="stars">
            Stars
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="nebula">
            Nebula
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="clipping">
            Clipping
          </TabsTrigger>
        </TabsList>

        <TabsContent className="grid gap-3" value="stars">
          {STAR_CONTROLS.map((control) => (
            <StarfieldSlider
              key={control.parameter}
              {...control}
              onChange={setStarsParameter}
              value={starfield.stars[control.parameter]}
            />
          ))}
        </TabsContent>

        <TabsContent className="grid gap-3" value="nebula">
          <div className="grid gap-2">
            {NEBULA_COLORS.map((color) => (
              <ColorField
                key={color.parameter}
                label={color.label}
                onChange={(nextColor, options) =>
                  setNebulaColor(color.parameter, nextColor, options)
                }
                value={starfield.nebula[color.parameter]}
              />
            ))}
          </div>
          {NEBULA_CONTROLS.map((control) => (
            <StarfieldSlider
              key={control.parameter}
              {...control}
              onChange={setNebulaParameter}
              value={starfield.nebula[control.parameter]}
            />
          ))}
          <FieldGroup label="Nebula Field" contentClassName="grid gap-3">
            <FieldGradientGroup
              onAddAnchor={addAnchor}
              onInteractionEnd={commitHistoryTransaction}
              onInteractionStart={beginHistoryTransaction}
              onRandomize={randomizeField}
              onRemoveAnchor={removeAnchor}
              onReset={resetField}
              onSelectAnchor={selectAnchor}
              onSetAmplitude={setFieldAmplitude}
              onSetFrequency={setFieldFrequency}
              onSetMode={setFieldMode}
              onSetPower={setFieldPower}
              onUpdateAnchor={updateAnchor}
              value={starfield.nebulaField}
            />
          </FieldGroup>
        </TabsContent>

        <TabsContent className="grid gap-3" value="clipping">
          <div className="widget-field widget-field-mode">
            <span className="text-xs">Preset</span>
            <Select
              onValueChange={(value) => {
                if (value === "custom") {
                  return;
                }

                const preset = CLIP_PRESETS.find((entry) => entry.id === value);

                if (preset) {
                  setClip(preset.clip);
                }
              }}
              value={getMatchingClipPresetId(starfield.clip)}
            >
              <SelectTrigger
                aria-label="Starfield clip preset"
                className="w-full bg-background text-xs"
                size="xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIP_PRESETS.map((preset) => (
                  <SelectItem className="text-xs" key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem className="text-xs" value="custom">
                  Custom
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {CLIP_CONTROLS.map((control) => (
            <StarfieldSlider
              key={control.parameter}
              {...control}
              onChange={setClipParameter}
              value={starfield.clip[control.parameter]}
            />
          ))}
        </TabsContent>
      </Tabs>
    </Widget>
  );
}
