import { FloatingColorPicker } from "@/components/ui/composables/FloatingColorPicker";
import { Point3Input } from "@/components/ui/composables/point-input";
import { Slider } from "@/components/ui/primitives/slider";
import * as cloudsOps from "@/effects/layers/clouds/operations";
import {
  CLOUDS_PARAMETER_LIMITS,
  createDefaultCloudsState,
  type CloudsNumericParameterKey,
  type CloudsState,
} from "@/effects/layers/clouds/state";
import type { VectorTuple } from "@/runtime";
import { useWorkspaceStore } from "@/store/app";
import { useSelectedLayerParams } from "@/store/use-selected-layer";
import { Widget } from "./Widget";

type HistoryOptions = { history?: "checkpoint" | "skip" };

// `scale` and `speed` are tiny in their natural units (~0.0002), which makes for a useless slider.
// The panel works in a 0..100 range and converts at the boundary.
const SCALE_UI_FACTOR = 1000;
const SPEED_UI_FACTOR = 10000;

const CLOUD_CONTROLS: Array<{
  format?: (value: number) => string;
  label: string;
  parameter: CloudsNumericParameterKey;
  step: number;
  toDisplay?: (value: number) => number;
  toParam?: (value: number) => number;
}> = [
  { parameter: "coverage", label: "Coverage", step: 0.01 },
  { parameter: "density", label: "Density", step: 0.01 },
  { parameter: "elevation", label: "Elevation", step: 0.01 },
  {
    parameter: "scale",
    label: "Scale",
    step: 0.01,
    toDisplay: (value) => value * SCALE_UI_FACTOR,
    toParam: (value) => value / SCALE_UI_FACTOR,
  },
  {
    parameter: "speed",
    label: "Speed",
    step: 0.01,
    toDisplay: (value) => value * SPEED_UI_FACTOR,
    toParam: (value) => value / SPEED_UI_FACTOR,
  },
  { parameter: "phase", label: "Phase", step: 0.5, format: (value) => value.toFixed(1) },
];

function CloudSlider({
  format,
  label,
  onChange,
  parameter,
  step,
  toDisplay,
  toParam,
  value,
}: {
  format?: (value: number) => string;
  label: string;
  onChange: (parameter: CloudsNumericParameterKey, value: number, options?: HistoryOptions) => void;
  parameter: CloudsNumericParameterKey;
  step: number;
  toDisplay?: (value: number) => number;
  toParam?: (value: number) => number;
  value: number;
}) {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const limits = CLOUDS_PARAMETER_LIMITS[parameter];
  const display = toDisplay ? toDisplay(value) : value;
  const min = toDisplay ? toDisplay(limits.min) : limits.min;
  const max = toDisplay ? toDisplay(limits.max) : limits.max;
  const commit = (next: number, options?: HistoryOptions) =>
    onChange(parameter, toParam ? toParam(next) : next, options);

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground/70">
        <span>{label}</span>
        <span className="font-mono text-foreground">
          {(format ?? ((next: number) => next.toFixed(2)))(display)}
        </span>
      </div>
      <Slider
        aria-label={label}
        max={max}
        min={min}
        onPointerCancel={() => commitHistoryTransaction()}
        onPointerDown={() => beginHistoryTransaction()}
        onValueChange={(next) => commit(next[0] ?? display, { history: "skip" })}
        onValueCommit={(next) => {
          commit(next[0] ?? display, { history: "skip" });
          commitHistoryTransaction();
        }}
        step={step}
        value={[display]}
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
  onChange: (color: string, options?: HistoryOptions) => void;
  value: string;
}) {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground/70">
      <span>{label}</span>
      <FloatingColorPicker
        onChange={(color) => onChange(color, { history: "skip" })}
        onChangeEnd={commitHistoryTransaction}
        onChangeStart={beginHistoryTransaction}
        value={value}
      />
    </div>
  );
}

export function CloudsWidget() {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const updateSelectedLayerParams = useWorkspaceStore((state) => state.updateSelectedLayerParams);
  const clouds = useSelectedLayerParams<CloudsState>("clouds") ?? createDefaultCloudsState();

  const setParameter = (
    parameter: CloudsNumericParameterKey,
    value: number,
    options?: HistoryOptions
  ) =>
    updateSelectedLayerParams(
      (params) => cloudsOps.setCloudsParameter(params as CloudsState, parameter, value),
      options
    );
  const setColor = (color: string, options?: HistoryOptions) =>
    updateSelectedLayerParams(
      (params) => cloudsOps.setCloudsColor(params as CloudsState, color),
      options
    );
  const setShadowColor = (color: string, options?: HistoryOptions) =>
    updateSelectedLayerParams(
      (params) => cloudsOps.setCloudsShadowColor(params as CloudsState, color),
      options
    );
  const setSunDirection = (direction: VectorTuple, options?: HistoryOptions) =>
    updateSelectedLayerParams(
      (params) => cloudsOps.setCloudsSunDirection(params as CloudsState, direction),
      options
    );

  const [sunX, sunY, sunZ] = clouds.sunDirection;

  return (
    <Widget title="Clouds" contentClassName="grid min-h-0 gap-3 overflow-y-auto p-3">
      {CLOUD_CONTROLS.map((control) => (
        <CloudSlider
          key={control.parameter}
          format={control.format}
          label={control.label}
          onChange={setParameter}
          parameter={control.parameter}
          step={control.step}
          toDisplay={control.toDisplay}
          toParam={control.toParam}
          value={clouds[control.parameter]}
        />
      ))}

      <div className="grid gap-2">
        <ColorField label="Lit" onChange={setColor} value={clouds.color} />
        <ColorField label="Shadow" onChange={setShadowColor} value={clouds.shadowColor} />
      </div>

      <Point3Input
        label="Sun direction"
        layout="vertical"
        max={1}
        min={-1}
        onBlur={commitHistoryTransaction}
        onFocus={beginHistoryTransaction}
        onInteractionEnd={commitHistoryTransaction}
        onInteractionStart={beginHistoryTransaction}
        onValueChange={(value, options) =>
          setSunDirection([value.x, value.y, value.z] as VectorTuple, options)
        }
        step={0.05}
        value={{ x: sunX, y: sunY, z: sunZ }}
      />
    </Widget>
  );
}
