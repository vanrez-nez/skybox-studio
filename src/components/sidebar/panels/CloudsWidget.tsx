import type { ReactNode } from "react";
import * as THREE from "three";

import { FloatingColorPicker } from "@/components/ui/composables/FloatingColorPicker";
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
import * as cloudsOps from "@/effects/layers/clouds/operations";
import {
  CLOUDS_FIELD_LIMITS,
  CLOUDS_LAYER_LIMITS,
  CLOUDS_ROOT_LIMITS,
  createDefaultCloudsState,
  type CloudsFieldNumericKey,
  type CloudsLayerNumericKey,
  type CloudsRootNumericKey,
  type CloudsState,
} from "@/effects/layers/clouds/state";
import type { ImageState } from "@/effects/layers/image/state";
import type { SpotState } from "@/effects/layers/spot/state";
import {
  DEFAULT_SKYBOX_CLOUDS_PARAMS,
  FULL_MOON_SKYBOX_CLOUDS_PARAMS,
  type SkyboxCloudLightParams,
  type VectorTuple,
} from "@/runtime";
import { useWorkspaceStore } from "@/store/app";
import { useSelectedLayerParams } from "@/store/use-selected-layer";
import { Widget } from "./Widget";

type HistoryOptions = { history?: "checkpoint" | "skip" };
type LightName = "moon" | "sun";
type CloudLayerName = "cloudHigh" | "cloudLow";
type CloudsPresetId = "custom" | "day" | "full-moon";

const CLOUDS_PRESETS = [
  {
    id: "day",
    label: "Day",
    params: DEFAULT_SKYBOX_CLOUDS_PARAMS,
  },
  {
    id: "full-moon",
    label: "Full Moon",
    params: FULL_MOON_SKYBOX_CLOUDS_PARAMS,
  },
] as const satisfies ReadonlyArray<{
  id: Exclude<CloudsPresetId, "custom">;
  label: string;
  params: CloudsState;
}>;

function getMatchingCloudsPresetId(clouds: CloudsState): CloudsPresetId {
  return (
    CLOUDS_PRESETS.find(
      (preset) => JSON.stringify(clouds) === JSON.stringify(preset.params),
    )?.id ?? "custom"
  );
}

function formatNumber(value: number, step: number) {
  if (step < 0.0001) return value.toFixed(5);
  if (step < 0.001) return value.toFixed(4);
  if (step < 0.01) return value.toFixed(3);
  return value.toFixed(step >= 1 ? 0 : 2);
}

function NumericSlider({
  disabled = false,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number, options?: HistoryOptions) => void;
  step: number;
  value: number;
}) {
  const beginHistoryTransaction = useWorkspaceStore(
    (state) => state.beginHistoryTransaction,
  );
  const commitHistoryTransaction = useWorkspaceStore(
    (state) => state.commitHistoryTransaction,
  );

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
        disabled={disabled}
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

function SwitchRow({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span>{label}</span>
      <Switch
        aria-label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        size="sm"
      />
    </div>
  );
}

function directionToAngles(direction: VectorTuple) {
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
  const x = direction[0] / length;
  const y = direction[1] / length;
  const z = direction[2] / length;
  const elevation = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, y))));
  const rawAzimuth = THREE.MathUtils.radToDeg(Math.atan2(x, z));
  const azimuth = ((rawAzimuth % 360) + 360) % 360;
  return { azimuth, elevation };
}

function directionFromAngles(elevation: number, azimuth: number): VectorTuple {
  const elevationRad = THREE.MathUtils.degToRad(elevation);
  const azimuthRad = THREE.MathUtils.degToRad(azimuth);
  const horizontal = Math.cos(elevationRad);
  return [
    horizontal * Math.sin(azimuthRad),
    Math.sin(elevationRad),
    horizontal * Math.cos(azimuthRad),
  ];
}

function directionForReference(layer: { params: unknown; type: string }): VectorTuple | null {
  if (layer.type === "spot") {
    return [...(layer.params as SpotState).centerDirection] as VectorTuple;
  }

  if (layer.type === "image") {
    const direction = (layer.params as ImageState).placement?.centerDirection;
    return direction ? ([...direction] as VectorTuple) : null;
  }

  return null;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-medium text-foreground">{children}</h3>;
}

export function CloudsWidget() {
  const beginHistoryTransaction = useWorkspaceStore(
    (state) => state.beginHistoryTransaction,
  );
  const commitHistoryTransaction = useWorkspaceStore(
    (state) => state.commitHistoryTransaction,
  );
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const selectedLayerId = useWorkspaceStore((state) => state.selectedLayerId);
  const updateSelectedLayerParams = useWorkspaceStore(
    (state) => state.updateSelectedLayerParams,
  );
  const clouds =
    useSelectedLayerParams<CloudsState>("clouds") ?? createDefaultCloudsState();

  const update = (
    operation: (params: CloudsState) => CloudsState,
    options?: HistoryOptions,
  ) =>
    updateSelectedLayerParams(
      (params) => operation(params as CloudsState),
      options,
    );

  const references = effectLayers.filter(
    (layer) =>
      layer.id !== selectedLayerId &&
      (layer.type === "image" || layer.type === "spot"),
  );

  const effectiveLightDirection = (light: SkyboxCloudLightParams): VectorTuple => {
    const target = light.directionLayerId
      ? references.find((layer) => layer.id === light.directionLayerId)
      : null;
    return target
      ? directionForReference(target) ?? light.direction
      : light.direction;
  };

  const setLightAngle = (
    lightName: LightName,
    key: "azimuth" | "elevation",
    value: number,
    options?: HistoryOptions,
  ) => {
    const angles = directionToAngles(effectiveLightDirection(clouds[lightName]));
    update(
      (params) =>
        cloudsOps.setLightDirection(
          params,
          lightName,
          directionFromAngles(
            key === "elevation" ? value : angles.elevation,
            key === "azimuth" ? value : angles.azimuth,
          ),
        ),
      options,
    );
  };

  const renderLight = (lightName: LightName, label: string) => {
    const light = clouds[lightName];
    const effectiveDirection = effectiveLightDirection(light);
    const angles = directionToAngles(effectiveDirection);
    const linked = Boolean(light.directionLayerId);

    return (
      <div className="grid gap-3">
        <SectionTitle>{label}</SectionTitle>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Direction reference</span>
          <Select
            onValueChange={(value) => {
              const target = references.find((layer) => layer.id === value);
              update((params) =>
                cloudsOps.setLightReference(
                  params,
                  lightName,
                  value === "manual" ? null : value,
                  value === "manual"
                    ? effectiveDirection
                    : target
                      ? directionForReference(target) ?? undefined
                      : undefined,
                ),
              );
            }}
            value={light.directionLayerId ?? "manual"}
          >
            <SelectTrigger aria-label={`${label} direction reference`} className="w-full" size="xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="manual">Manual</SelectItem>
                {references.map((layer) => (
                  <SelectItem
                    disabled={!directionForReference(layer)}
                    key={layer.id}
                    value={layer.id}
                  >
                    {layer.name} ({layer.type})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <NumericSlider
          disabled={linked}
          label="Elevation"
          max={90}
          min={-20}
          onChange={(value, options) =>
            setLightAngle(lightName, "elevation", value, options)
          }
          step={0.1}
          value={angles.elevation}
        />
        <NumericSlider
          disabled={linked}
          label="Azimuth"
          max={360}
          min={0}
          onChange={(value, options) =>
            setLightAngle(lightName, "azimuth", value, options)
          }
          step={0.1}
          value={angles.azimuth}
        />
        <NumericSlider
          label="Intensity"
          max={100}
          min={0}
          onChange={(value, options) =>
            update(
              (params) => cloudsOps.setLightIntensity(params, lightName, value),
              options,
            )
          }
          step={0.05}
          value={light.intensity}
        />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Tint</span>
          <FloatingColorPicker
            onChange={(color) =>
              update(
                (params) => cloudsOps.setLightTint(params, lightName, color),
                { history: "skip" },
              )
            }
            onChangeEnd={commitHistoryTransaction}
            onChangeStart={beginHistoryTransaction}
            value={light.tint}
          />
        </div>
        <SwitchRow
          checked={light.disc}
          label="Disc"
          onCheckedChange={(checked) =>
            update((params) => cloudsOps.setLightDisc(params, lightName, checked))
          }
        />
      </div>
    );
  };

  const renderCloudLayer = (layerName: CloudLayerName, label: string) => {
    const layer = clouds[layerName];
    const controls: Array<{ key: CloudsLayerNumericKey; label: string }> = [
      { key: "altitude", label: "Altitude" },
      { key: "featureSize", label: "Feature size" },
      { key: "speed", label: "Speed" },
      { key: "morphBlend", label: "Morph blend" },
      { key: "morphScale", label: "Morph scale" },
      { key: "morphSpeed", label: "Morph speed" },
      { key: "coverage", label: "Coverage" },
      { key: "density", label: "Density" },
      { key: "phaseG", label: "Phase g" },
    ];

    return (
      <div className="grid gap-3">
        <SectionTitle>{label}</SectionTitle>
        <SwitchRow
          checked={layer.enabled}
          label="Enabled"
          onCheckedChange={(checked) =>
            update((params) =>
              cloudsOps.setCloudLayerEnabled(params, layerName, checked),
            )
          }
        />
        {controls.map(({ key, label: controlLabel }) => (
          <NumericSlider
            key={key}
            label={controlLabel}
            onChange={(value, options) =>
              update(
                (params) =>
                  cloudsOps.setCloudLayerParameter(
                    params,
                    layerName,
                    key,
                    value,
                  ),
                options,
              )
            }
            value={layer[key]}
            {...CLOUDS_LAYER_LIMITS[key]}
          />
        ))}
      </div>
    );
  };

  const atmosphereControls: Array<{
    key: CloudsRootNumericKey;
    label: string;
  }> = [
    { key: "kr", label: "Kr" },
    { key: "km", label: "Km" },
    { key: "mieDirectionalG", label: "Mie g" },
    { key: "samples", label: "Samples" },
    { key: "eyeHeight", label: "Eye height" },
    { key: "mistDensity", label: "Mist density" },
    { key: "mistHeight", label: "Mist height" },
    { key: "exposure", label: "HDR exposure" },
  ];

  const fieldControls: Array<{
    key: CloudsFieldNumericKey;
    label: string;
  }> = [
    { key: "size", label: "Resolution" },
    { key: "tiles", label: "Cells per tile" },
    { key: "octaves", label: "Octaves" },
    { key: "persistence", label: "Persistence" },
    { key: "seed", label: "Seed" },
  ];

  return (
    <Widget title="Clouds" contentClassName="grid min-h-0 gap-3 overflow-y-auto p-3">
      <div className="widget-inline-fields">
        <div className="widget-field widget-field-mode">
          <span className="text-xs">Preset</span>
          <Select
            onValueChange={(value) => {
              if (value === "custom") {
                return;
              }

              const preset = CLOUDS_PRESETS.find((entry) => entry.id === value);

              if (preset) {
                update((params) => cloudsOps.applyPreset(params, preset.params));
              }
            }}
            value={getMatchingCloudsPresetId(clouds)}
          >
            <SelectTrigger
              aria-label="Clouds preset"
              className="min-w-0 flex-1 bg-background text-xs"
              size="xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CLOUDS_PRESETS.map((preset) => (
                  <SelectItem className="text-xs" key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem className="text-xs" value="custom">
                  Custom
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="widget-field widget-field-mode">
          <span className="text-xs">Motion</span>
          <Select
            onValueChange={(value) =>
              update((params) =>
                cloudsOps.setMotionMode(params, value as CloudsState["motionMode"]),
              )
            }
            value={clouds.motionMode}
          >
            <SelectTrigger
              aria-label="Cloud motion"
              className="min-w-0 flex-1 bg-background text-xs"
              size="xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem className="text-xs" value="static">
                  Static
                </SelectItem>
                <SelectItem className="text-xs" value="dynamic">
                  Dynamic
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="atmosphere">
        <TabsList className="w-full">
          <TabsTrigger className="flex-1" value="atmosphere">
            Air
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="lights">
            Lights
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="clouds">
            Clouds
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="field">
            Field
          </TabsTrigger>
        </TabsList>

        <TabsContent className="grid gap-3" value="atmosphere">
          {atmosphereControls.map(({ key, label }) => (
            <NumericSlider
              key={key}
              label={label}
              onChange={(value, options) =>
                update(
                  (params) => cloudsOps.setRootParameter(params, key, value),
                  options,
                )
              }
              value={clouds[key]}
              {...CLOUDS_ROOT_LIMITS[key]}
            />
          ))}
        </TabsContent>

        <TabsContent className="grid gap-5" value="lights">
          {renderLight("sun", "Sun")}
          {renderLight("moon", "Moon")}
        </TabsContent>

        <TabsContent className="grid gap-5" value="clouds">
          {renderCloudLayer("cloudLow", "Low layer")}
          {renderCloudLayer("cloudHigh", "High layer")}
        </TabsContent>

        <TabsContent className="grid gap-3" value="field">
          {fieldControls.map(({ key, label }) => (
            <NumericSlider
              key={key}
              label={label}
              onChange={(value, options) =>
                update(
                  (params) => cloudsOps.setFieldParameter(params, key, value),
                  options,
                )
              }
              value={clouds.field[key]}
              {...CLOUDS_FIELD_LIMITS[key]}
            />
          ))}
          <SwitchRow
            checked={clouds.debugLayers}
            label="Debug layers"
            onCheckedChange={(checked) =>
              update((params) => cloudsOps.setDebugLayers(params, checked))
            }
          />
        </TabsContent>
      </Tabs>
    </Widget>
  );
}
