import * as THREE from "three";

import { FloatingColorPicker } from "@/components/ui/composables/FloatingColorPicker";
import {
  Point2Input,
  type Point2Value,
  type PointInputChangeOptions,
} from "@/components/ui/composables/point-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { Slider } from "@/components/ui/primitives/slider";
import { Switch } from "@/components/ui/primitives/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives/tabs";
import * as moonOps from "@/effects/layers/moon/operations";
import {
  createDefaultMoonState,
  MOON_PLACEMENT_TRANSACTION_SCOPE,
  type MoonState,
} from "@/effects/layers/moon/state";
import type { SkyboxMoonResolutionMode, SkyboxMoonStyle } from "@/runtime";
import { useWorkspaceStore } from "@/store/app";
import { useSelectedLayerParams } from "@/store/use-selected-layer";
import { Widget } from "./Widget";

type HistoryOptions = { history?: "checkpoint" | "skip" };
type NumberControl = {
  key: moonOps.MoonNumericKey;
  label: string;
  max: number;
  min: number;
  step: number;
};

const SURFACE_CONTROLS: NumberControl[] = [
  { key: "craterFreq", label: "Crater scale", min: 1.5, max: 18, step: 0.1 },
  { key: "craterDepth", label: "Crater depth", min: 0.001, max: 0.05, step: 0.0005 },
  { key: "maria", label: "Maria", min: 0, max: 1, step: 0.01 },
  { key: "mariaDepth", label: "Maria depth", min: 0, max: 0.02, step: 0.0005 },
  { key: "regolith", label: "Regolith", min: 0, max: 2, step: 0.01 },
  { key: "rays", label: "Ray systems", min: 0, max: 3, step: 0.01 },
];

const REALISTIC_LIGHT_CONTROLS: NumberControl[] = [
  { key: "exposure", label: "Exposure", min: 0.1, max: 8, step: 0.01 },
];

const CARTOON_LIGHT_CONTROLS: NumberControl[] = [
  { key: "cartoonLightIntensity", label: "Intensity", min: 0, max: 5, step: 0.01 },
  { key: "cartoonFill", label: "Fill", min: 0, max: 0.6, step: 0.005 },
  { key: "cartoonNightStrength", label: "Night strength", min: 0, max: 2.4, step: 0.01 },
  { key: "exposure", label: "Exposure", min: 0.1, max: 4, step: 0.01 },
];

const CARTOON_CONTROLS: NumberControl[] = [
  { key: "cartoonCraters", label: "Craters", min: 3, max: 64, step: 1 },
  { key: "cartoonCraterSize", label: "Crater size", min: 0.04, max: 0.6, step: 0.005 },
  { key: "cartoonWobble", label: "Outline wobble", min: 0, max: 0.8, step: 0.01 },
  { key: "cartoonRelief", label: "Relief", min: 0, max: 0.8, step: 0.01 },
  { key: "cartoonForm", label: "Ball gradient", min: 0, max: 1, step: 0.01 },
  { key: "cartoonSunLean", label: "Sun lean", min: 0, max: 1, step: 0.01 },
  { key: "cartoonOutline", label: "Outline", min: 0, max: 1, step: 0.01 },
  { key: "cartoonSoftness", label: "Edge softness", min: 0, max: 0.3, step: 0.005 },
  { key: "cartoonShadowSize", label: "Shadow size", min: 0, max: 3, step: 0.01 },
  { key: "cartoonEdgeGlow", label: "Edge glow", min: 0, max: 1.5, step: 0.01 },
];

const CARTOON_SHARED_CONTROLS: NumberControl[] = [
  { key: "maria", label: "Maria", min: 0, max: 1, step: 0.01 },
];

function formatNumber(value: number, step: number) {
  if (step < 0.001) return value.toFixed(4);
  if (step < 0.01) return value.toFixed(3);
  return value.toFixed(step >= 1 ? 0 : 2);
}

function mergeChangedPointValue(
  currentValue: Point2Value,
  nextValue: Point2Value,
  options?: PointInputChangeOptions,
) {
  const changedAxes = options?.changedAxes?.length
    ? new Set(options.changedAxes)
    : new Set(["x", "y"]);

  return {
    x: changedAxes.has("x") ? nextValue.x : currentValue.x,
    y: changedAxes.has("y") ? nextValue.y : currentValue.y,
  };
}

function NumericSlider({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number, options?: HistoryOptions) => void;
  step: number;
  value: number;
}) {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">
          {formatNumber(value, step)}
        </span>
      </div>
      <Slider
        aria-label={label}
        max={max}
        min={min}
        onPointerCancel={() => commitHistoryTransaction()}
        onPointerDown={() => beginHistoryTransaction()}
        onValueChange={(next) => onChange(next[0] ?? value, { history: "skip" })}
        onValueCommit={(next) => {
          onChange(next[0] ?? value, { history: "skip" });
          commitHistoryTransaction();
        }}
        step={step}
        value={[value]}
      />
    </div>
  );
}

function ColorRow({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span>{label}</span>
      <FloatingColorPicker onChange={onChange} value={value} />
    </div>
  );
}

export function MoonWidget() {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const updateSelectedLayerParams = useWorkspaceStore((state) => state.updateSelectedLayerParams);
  const moon = useSelectedLayerParams<MoonState>("moon") ?? createDefaultMoonState();

  const update = (
    operation: (params: MoonState) => MoonState,
    options?: HistoryOptions,
  ) => updateSelectedLayerParams((params) => operation(params as MoonState), options);

  const renderControls = (controls: NumberControl[]) =>
    controls.map((control) => (
      <NumericSlider
        key={control.key}
        onChange={(value, options) =>
          update(
            (params) => moonOps.setMoonNumber(params, control.key, value, control.min, control.max),
            options,
          )
        }
        value={moon[control.key] as number}
        label={control.label}
        max={control.max}
        min={control.min}
        step={control.step}
      />
    ));

  const position = moonOps.positionFromMoon(moon);
  const updatePosition = (next: Point2Value, options?: PointInputChangeOptions) => {
    update(
      (params) =>
        moonOps.setMoonPosition(
          params,
          mergeChangedPointValue(moonOps.positionFromMoon(params), next, options),
        ),
      { history: options?.history },
    );
  };

  const isCartoon = moon.style === "cartoon";

  return (
    <Widget contentClassName="flex flex-col gap-5" title="Moon">
      <div className="widget-inline-fields">
        <div className="widget-field widget-field-mode">
          <span className="text-xs">Style</span>
          <Select
            onValueChange={(value) =>
              update((params) => moonOps.setMoonStyle(params, value as SkyboxMoonStyle))
            }
            value={moon.style}
          >
            <SelectTrigger aria-label="Moon style" className="w-full bg-background text-xs" size="xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem className="text-xs" value="realistic">Realistic</SelectItem>
                <SelectItem className="text-xs" value="cartoon">Cartoon</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="widget-inline-fields">
        <div className="widget-field widget-field-mode">
          <span className="text-xs">Resolution</span>
          <Select
            onValueChange={(value) =>
              update((params) =>
                moonOps.setMoonResolutionMode(
                  params,
                  value as SkyboxMoonResolutionMode,
                ),
              )
            }
            value={moon.resolutionMode}
          >
            <SelectTrigger aria-label="Moon resolution" className="w-full bg-background text-xs" size="xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem className="text-xs" value="auto">Auto</SelectItem>
                {[128, 256, 512, 1024, 2048].map((resolution) => (
                  <SelectItem className="text-xs" key={resolution} value={String(resolution)}>
                    {resolution} × {resolution}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Point2Input
        fields={{
          x: { label: "X", min: -1, max: 1, step: 0.01 },
          y: { label: "Y", min: -1, max: 1, step: 0.01 },
        }}
        formatValue={(value) => value.toFixed(2)}
        label="Position"
        layout="vertical"
        onBlur={() => commitHistoryTransaction(MOON_PLACEMENT_TRANSACTION_SCOPE)}
        onFocus={() => beginHistoryTransaction(MOON_PLACEMENT_TRANSACTION_SCOPE)}
        onInteractionEnd={() => commitHistoryTransaction(MOON_PLACEMENT_TRANSACTION_SCOPE)}
        onInteractionStart={() => beginHistoryTransaction(MOON_PLACEMENT_TRANSACTION_SCOPE)}
        onValueChange={updatePosition}
        value={position}
      />

      <div className="grid gap-3">
        <NumericSlider
          label="Angular size"
          max={90}
          min={0.25}
          onChange={(value, options) =>
            update(
              (params) => moonOps.setMoonAngularSize(params, THREE.MathUtils.degToRad(value)),
              options,
            )
          }
          step={0.25}
          value={THREE.MathUtils.radToDeg(moon.placement.angularWidth)}
        />
        {renderControls([
          { key: "phase", label: "Phase", min: 0, max: 1, step: 0.001 },
          { key: "sunTilt", label: "Sun tilt", min: -1, max: 1, step: 0.01 },
          { key: "bodyRotation", label: "Body rotation", min: -Math.PI, max: Math.PI, step: 0.005 },
          { key: "bodyTilt", label: "Body tilt", min: -1.2, max: 1.2, step: 0.005 },
        ])}
      </div>

      <Tabs defaultValue={isCartoon ? "cartoon" : "surface"} key={moon.style}>
        <TabsList className="w-full">
          {isCartoon ? (
            <TabsTrigger className="flex-1" value="cartoon">Toon</TabsTrigger>
          ) : (
            <TabsTrigger className="flex-1" value="surface">Land</TabsTrigger>
          )}
          <TabsTrigger className="flex-1" value="light">Light</TabsTrigger>
        </TabsList>

        {!isCartoon ? (
          <TabsContent className="grid gap-3" value="surface">
            {renderControls(SURFACE_CONTROLS)}
          </TabsContent>
        ) : null}

        <TabsContent className="grid gap-3" value="light">
          {!isCartoon ? (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Model</span>
              <span className="text-foreground">Hapke · LRO/WAC 643 nm</span>
            </div>
          ) : null}
          {renderControls(isCartoon ? CARTOON_LIGHT_CONTROLS : REALISTIC_LIGHT_CONTROLS)}
        </TabsContent>

        {isCartoon ? (
          <TabsContent className="grid gap-3" value="cartoon">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>Crop unlit side</span>
              <Switch
                aria-label="Crop unlit side"
                checked={moon.cartoonCrop}
                onCheckedChange={(checked) => update((params) => moonOps.setMoonBoolean(params, "cartoonCrop", checked))}
                size="sm"
              />
            </div>
            {renderControls(CARTOON_CONTROLS)}
            {renderControls(CARTOON_SHARED_CONTROLS)}
            <ColorRow label="Base color" value={moon.baseColor} onChange={(value) => update((params) => moonOps.setMoonColor(params, "baseColor", value))} />
            <ColorRow label="Maria color" value={moon.mareColor} onChange={(value) => update((params) => moonOps.setMoonColor(params, "mareColor", value))} />
            <ColorRow label="Night color" value={moon.nightColor} onChange={(value) => update((params) => moonOps.setMoonColor(params, "nightColor", value))} />
          </TabsContent>
        ) : null}
      </Tabs>
    </Widget>
  );
}
