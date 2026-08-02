import { useRef } from "react";

import { Button } from "@/components/ui/primitives/button";
import { FieldGroup } from "@/components/ui/primitives/field-group";
import { NumericDragField } from "@/components/ui/composables/numeric-drag-input";
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
import { Widget } from "./Widget";
import { IMAGE_PLACEMENT_ELEVATION_LIMIT } from "@/runtime/image-placement-transform";
import { positionFromSun, radiusScaleFromSun, sunFromPosition } from "@/runtime/sun-transform";
import {
  getEffectLayerAddon,
  type EffectLayer,
  type EffectLayerLightSource,
} from "@/effects/effect-layer";
import * as sunOps from "@/effects/layers/sun/operations";
import {
  createDefaultSunState,
  SUN_PARAMETER_LIMITS,
  type SunNumericParameterKey,
  type SunState,
} from "@/effects/layers/sun/state";
import { useWorkspaceStore } from "@/store/app";
import { useSelectedLayerParams } from "@/store/use-selected-layer";

type HistoryOptions = { history?: "checkpoint" | "skip" };

type SunControl = {
  label: string;
  parameterKey: SunNumericParameterKey;
};

const SUN_CONTROL_GROUPS: Array<{ controls: SunControl[]; label: string }> = [
  {
    label: "Aureole",
    controls: [
      { parameterKey: "aureoleStrength", label: "Strength" },
      { parameterKey: "aureoleReach", label: "Reach" },
    ],
  },
  {
    label: "Corona",
    controls: [
      { parameterKey: "coronaGain", label: "Gain" },
      { parameterKey: "coronaStructure", label: "Structure" },
    ],
  },
];

function formatPositionValue(value: number) {
  const roundedValue = Number(value.toFixed(1));

  return Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : `${roundedValue}`;
}

function formatUnitValue(value: number) {
  const roundedValue = Number(value.toFixed(2));

  return Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : `${roundedValue}`;
}

function mergeChangedPointValue(
  currentValue: Point2Value,
  nextValue: Point2Value,
  options?: PointInputChangeOptions,
): Point2Value {
  const changedAxes = options?.changedAxes?.length
    ? new Set(options.changedAxes)
    : new Set(["x", "y"]);

  return {
    x: changedAxes.has("x") ? nextValue.x : currentValue.x,
    y: changedAxes.has("y") ? nextValue.y : currentValue.y,
  };
}

/**
 * A layer qualifies as an eclipse occluder when its addon exposes a
 * light-source descriptor with a real disc (angularRadius > 0) — the
 * occlusion model is meaningless for point sources. Registry-driven: any
 * future disc-bearing layer becomes an occluder for free.
 */
function occluderSourceForLayer(layer: EffectLayer): EffectLayerLightSource | null {
  const source = getEffectLayerAddon(layer.type).getLightSource?.(layer) ?? null;

  return source && source.angularRadius > 0 ? source : null;
}

function SunSlider({
  label,
  onInteractionEnd,
  onInteractionStart,
  onValueChange,
  parameterKey,
  value,
}: SunControl & {
  onInteractionEnd: () => void;
  onInteractionStart: () => void;
  onValueChange: (
    parameterKey: SunNumericParameterKey,
    value: number,
    options?: HistoryOptions,
  ) => void;
  value: number;
}) {
  const limits = SUN_PARAMETER_LIMITS[parameterKey];
  const isAdjustingRef = useRef(false);

  const beginAdjustment = () => {
    if (isAdjustingRef.current) {
      return;
    }

    isAdjustingRef.current = true;
    onInteractionStart();
  };

  const endAdjustment = () => {
    if (!isAdjustingRef.current) {
      return;
    }

    isAdjustingRef.current = false;
    onInteractionEnd();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground/70">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatUnitValue(value)}</span>
      </div>
      <Slider
        aria-label={`Sun ${label.toLowerCase()}`}
        max={limits.max}
        min={limits.min}
        onBlur={endAdjustment}
        onKeyDown={beginAdjustment}
        onPointerCancel={endAdjustment}
        onPointerDown={beginAdjustment}
        onValueChange={(nextValue) =>
          onValueChange(parameterKey, nextValue[0] ?? value, {
            history: isAdjustingRef.current ? "skip" : "checkpoint",
          })
        }
        onValueCommit={endAdjustment}
        step={limits.step}
        value={[value]}
      />
    </div>
  );
}

export function SunWidget() {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const selectedLayerId = useWorkspaceStore((state) => state.selectedLayerId);
  const updateSelectedLayerParams = useWorkspaceStore((state) => state.updateSelectedLayerParams);
  const sun = useSelectedLayerParams<SunState>("sun") ?? createDefaultSunState();

  const getLatestSun = (): SunState | null => {
    const state = useWorkspaceStore.getState();
    const layer = state.effectLayers.find(
      (effectLayer) => effectLayer.id === state.selectedLayerId,
    );

    return layer?.type === "sun" ? (layer.params as SunState) : null;
  };

  const setSunNumericParameter = (
    parameter: SunNumericParameterKey,
    value: number,
    options?: HistoryOptions,
  ) =>
    updateSelectedLayerParams(
      (params) => sunOps.setSunNumericParameter(params as SunState, parameter, value),
      options,
    );
  const setSunPosition = (centerDirection: [number, number, number]) =>
    updateSelectedLayerParams((params) =>
      sunOps.setSunPosition(params as SunState, centerDirection),
    );
  const setSunRadiusScale = (radiusScale: number) =>
    updateSelectedLayerParams((params) =>
      sunOps.setSunRadiusScale(params as SunState, radiusScale),
    );
  const rerollCorona = () =>
    updateSelectedLayerParams((params) =>
      sunOps.setSunCorona(params as SunState, Math.random() * 100, Math.random() * Math.PI),
    );
  const setSunOccluderReference = (occluderLayerId: string | null) =>
    updateSelectedLayerParams((params) =>
      sunOps.setSunOccluderReference(params as SunState, occluderLayerId),
    );

  const occluderCandidates = effectLayers.filter(
    (layer) =>
      layer.id !== selectedLayerId &&
      Boolean(getEffectLayerAddon(layer.type).getLightSource),
  );

  const updatePosition = (position: Point2Value, options?: PointInputChangeOptions) => {
    const latestSun = getLatestSun();

    if (!latestSun) {
      return;
    }

    const currentPosition = positionFromSun(latestSun);
    const nextPosition = mergeChangedPointValue(currentPosition, position, options);

    setSunPosition(sunFromPosition(latestSun, nextPosition).centerDirection);
  };

  return (
    <Widget title="Sun" contentClassName="space-y-5">
      <div className="widget-point-groups">
        <Point2Input
          fields={{
            x: { label: "X", min: -180, max: 180, step: 1 },
            y: {
              label: "Y",
              min: -IMAGE_PLACEMENT_ELEVATION_LIMIT,
              max: IMAGE_PLACEMENT_ELEVATION_LIMIT,
              step: 1,
            },
          }}
          formatValue={formatPositionValue}
          label="Position"
          layout="vertical"
          onBlur={commitHistoryTransaction}
          onFocus={beginHistoryTransaction}
          onInteractionEnd={commitHistoryTransaction}
          onInteractionStart={beginHistoryTransaction}
          onValueChange={updatePosition}
          value={positionFromSun(sun)}
        />
        <NumericDragField
          ariaLabel="Sun radius"
          fieldLabel="R"
          formatValue={formatUnitValue}
          label="Radius"
          min={0.01}
          onBlur={commitHistoryTransaction}
          onFocus={beginHistoryTransaction}
          onInteractionEnd={commitHistoryTransaction}
          onInteractionStart={beginHistoryTransaction}
          onValueChange={setSunRadiusScale}
          step={0.1}
          value={radiusScaleFromSun(sun)}
        />
      </div>

      <SunSlider
        label="Exposure"
        onInteractionEnd={commitHistoryTransaction}
        onInteractionStart={beginHistoryTransaction}
        onValueChange={setSunNumericParameter}
        parameterKey="exposure"
        value={sun.exposure}
      />

      <div className="grid gap-1">
        {SUN_CONTROL_GROUPS.map((group) => (
          <FieldGroup
            collapsible
            contentClassName="grid gap-2"
            indent
            key={group.label}
            label={group.label}
          >
            {group.controls.map((control) => (
              <SunSlider
                key={control.parameterKey}
                label={control.label}
                onInteractionEnd={commitHistoryTransaction}
                onInteractionStart={beginHistoryTransaction}
                onValueChange={setSunNumericParameter}
                parameterKey={control.parameterKey}
                value={sun[control.parameterKey]}
              />
            ))}
            {group.label === "Corona" ? (
              <Button onClick={rerollCorona} size="sm" variant="outline">
                New corona
              </Button>
            ) : null}
          </FieldGroup>
        ))}
        <FieldGroup collapsible contentClassName="grid gap-2" indent label="Eclipse">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Occluder</span>
            <Select
              onValueChange={(value) =>
                setSunOccluderReference(value === "none" ? null : value)
              }
              value={sun.occluderLayerId ?? "none"}
            >
              <SelectTrigger aria-label="Eclipse occluder" className="w-full" size="xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">None</SelectItem>
                  {occluderCandidates.map((layer) => (
                    <SelectItem
                      disabled={!occluderSourceForLayer(layer)}
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
        </FieldGroup>
      </div>
    </Widget>
  );
}
