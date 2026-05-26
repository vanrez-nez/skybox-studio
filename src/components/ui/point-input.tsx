import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Link2, Link2Off } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumericDragInput } from "@/components/ui/numeric-drag-input";
import { cn } from "@/lib/utils";

export type PointAxis2 = "x" | "y";
export type PointAxis3 = PointAxis2 | "z";
export type PointAxis = PointAxis3;
export type Point2Value = Record<PointAxis2, number>;
export type Point3Value = Record<PointAxis3, number>;
export type PointValue = Partial<Record<PointAxis, number>>;
export type LockPair = ["x", "y"] | ["y", "z"] | ["x", "z"];
export type PointInputLayout = "inline" | "vertical";

export type PointInputChangeOptions = {
  history?: "checkpoint" | "skip";
};

export type PointFieldConfig = {
  dragPixelsPerStep?: number;
  formatValue?: (value: number) => string;
  label?: string;
  max?: number;
  min?: number;
  parseValue?: (value: string) => number | null;
  readOnly?: boolean;
  step?: number;
};

export type LockConfig = {
  defaultLocked?: boolean;
  optional?: boolean;
  pair: LockPair;
};

type PointInputBaseProps<TValue extends PointValue, TAxis extends PointAxis> = {
  className?: string;
  collapsible?: boolean;
  disabled?: boolean;
  dragPixelsPerStep?: number;
  expanded?: boolean;
  fields?: Partial<Record<TAxis, PointFieldConfig>>;
  formatValue?: (value: number) => string;
  label: string;
  layout?: PointInputLayout;
  lockedPairs?: LockPair[];
  locks?: LockConfig[];
  max?: number;
  min?: number;
  onBlur?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
  onFocus?: () => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  onLockedPairsChange?: (lockedPairs: LockPair[]) => void;
  onValueChange: (value: TValue, options?: PointInputChangeOptions) => void;
  parseValue?: (value: string) => number | null;
  step?: number;
  value: TValue;
};

export type Point2InputProps = Omit<PointInputBaseProps<Point2Value, PointAxis2>, "axes">;
export type Point3InputProps = Omit<PointInputBaseProps<Point3Value, PointAxis3>, "axes">;

const AXIS_ORDER: PointAxis[] = ["x", "y", "z"];
const DEFAULT_AXIS_LABELS: Record<PointAxis, string> = {
  x: "X",
  y: "Y",
  z: "Z",
};

function getAxisIndex(axis: PointAxis) {
  return AXIS_ORDER.indexOf(axis);
}

function normalizePair(pair: LockPair): LockPair {
  return pair;
}

function getPairKey(pair: LockPair) {
  const [firstAxis, secondAxis] = normalizePair(pair);

  return `${firstAxis}-${secondAxis}`;
}

function getPairFromKey(key: string): LockPair | null {
  const [firstAxis, secondAxis] = key.split("-") as [PointAxis | undefined, PointAxis | undefined];

  if (!firstAxis || !secondAxis) {
    return null;
  }

  if (firstAxis === "x" && secondAxis === "y") {
    return ["x", "y"];
  }

  if (firstAxis === "y" && secondAxis === "z") {
    return ["y", "z"];
  }

  if (firstAxis === "x" && secondAxis === "z") {
    return ["x", "z"];
  }

  return null;
}

function getConfiguredLocks(locks: LockConfig[] | undefined, axes: PointAxis[]) {
  const axisSet = new Set(axes);

  return (locks ?? []).filter(({ pair }) => {
    const [firstAxis, secondAxis] = normalizePair(pair);

    return axisSet.has(firstAxis) && axisSet.has(secondAxis);
  });
}

function getDefaultOptionalLockKeys(locks: LockConfig[]) {
  return new Set(
    locks
      .filter((lock) => lock.optional !== false && lock.defaultLocked)
      .map((lock) => getPairKey(lock.pair))
  );
}

function getFixedLockKeys(locks: LockConfig[]) {
  return new Set(
    locks
      .filter((lock) => lock.optional === false)
      .map((lock) => getPairKey(lock.pair))
  );
}

function getLockSignature(locks: LockConfig[]) {
  return locks
    .map((lock) => `${getPairKey(lock.pair)}:${lock.optional === false ? "fixed" : "optional"}:${lock.defaultLocked ? "1" : "0"}`)
    .join("|");
}

function clampValue(value: number, min?: number, max?: number) {
  let nextValue = value;

  if (typeof min === "number") {
    nextValue = Math.max(min, nextValue);
  }

  if (typeof max === "number") {
    nextValue = Math.min(max, nextValue);
  }

  return nextValue;
}

function getStepPrecision(step: number) {
  const stepText = `${step}`;

  if (stepText.includes("e-")) {
    return Number.parseInt(stepText.split("e-")[1] ?? "0", 10);
  }

  return stepText.includes(".") ? stepText.split(".")[1]?.length ?? 0 : 0;
}

function normalizeValue(value: number, step = 1, min?: number, max?: number) {
  const precision = getStepPrecision(step);

  return clampValue(Number(value.toFixed(precision)), min, max);
}

function getConnectedAxes(axis: PointAxis, activePairs: Set<string>, axes: PointAxis[]) {
  const axisSet = new Set(axes);
  const visitedAxes = new Set<PointAxis>([axis]);
  const pendingAxes = [axis];

  while (pendingAxes.length > 0) {
    const currentAxis = pendingAxes.pop();

    if (!currentAxis) {
      continue;
    }

    for (const pairKey of activePairs) {
      const pair = getPairFromKey(pairKey);

      if (!pair) {
        continue;
      }

      const [firstAxis, secondAxis] = pair;

      if (!axisSet.has(firstAxis) || !axisSet.has(secondAxis)) {
        continue;
      }

      if (firstAxis === currentAxis && !visitedAxes.has(secondAxis)) {
        visitedAxes.add(secondAxis);
        pendingAxes.push(secondAxis);
      }

      if (secondAxis === currentAxis && !visitedAxes.has(firstAxis)) {
        visitedAxes.add(firstAxis);
        pendingAxes.push(firstAxis);
      }
    }
  }

  return visitedAxes;
}

function hasPairAxis(pair: LockPair, axis: PointAxis) {
  return pair[0] === axis || pair[1] === axis;
}

function getPairOtherAxis(pair: LockPair, axis: PointAxis) {
  if (pair[0] === axis) {
    return pair[1];
  }

  if (pair[1] === axis) {
    return pair[0];
  }

  return null;
}

function sortPairs(pairs: LockPair[]) {
  return [...pairs].sort((firstPair, secondPair) =>
    getPairKey(firstPair).localeCompare(getPairKey(secondPair))
  );
}

function PointInputBase<TValue extends PointValue, TAxis extends PointAxis>({
  axes,
  className,
  collapsible = false,
  disabled = false,
  dragPixelsPerStep,
  expanded,
  fields,
  formatValue,
  label,
  layout = "inline",
  lockedPairs,
  locks,
  max,
  min,
  onBlur,
  onExpandedChange,
  onFocus,
  onInteractionEnd,
  onInteractionStart,
  onLockedPairsChange,
  onValueChange,
  parseValue,
  step = 1,
  value,
}: PointInputBaseProps<TValue, TAxis> & { axes: TAxis[] }) {
  const configuredLocks = useMemo(() => getConfiguredLocks(locks, axes), [axes, locks]);
  const lockSignature = useMemo(() => getLockSignature(configuredLocks), [configuredLocks]);
  const fixedLockKeys = useMemo(() => getFixedLockKeys(configuredLocks), [configuredLocks]);
  const [internalExpanded, setInternalExpanded] = useState(true);
  const [internalOptionalLockKeys, setInternalOptionalLockKeys] = useState(() =>
    getDefaultOptionalLockKeys(configuredLocks)
  );
  const isExpanded = expanded ?? internalExpanded;
  const isLockStateControlled = lockedPairs !== undefined;
  const optionalLockKeys = useMemo(
    () => isLockStateControlled
      ? new Set(lockedPairs.map((pair) => getPairKey(pair)))
      : internalOptionalLockKeys,
    [internalOptionalLockKeys, isLockStateControlled, lockedPairs]
  );
  const activeLockKeys = useMemo(
    () => new Set([...fixedLockKeys, ...optionalLockKeys]),
    [fixedLockKeys, optionalLockKeys]
  );

  useEffect(() => {
    setInternalOptionalLockKeys(getDefaultOptionalLockKeys(configuredLocks));
  }, [configuredLocks, lockSignature]);

  const getFieldConfig = (axis: TAxis) => fields?.[axis] ?? {};
  const getAxisLabel = (axis: TAxis) => getFieldConfig(axis).label ?? DEFAULT_AXIS_LABELS[axis];
  const getAxisStep = (axis: TAxis) => getFieldConfig(axis).step ?? step;
  const getAxisMin = (axis: TAxis) => getFieldConfig(axis).min ?? min;
  const getAxisMax = (axis: TAxis) => getFieldConfig(axis).max ?? max;
  const getAxisFormatValue = (axis: TAxis) => getFieldConfig(axis).formatValue ?? formatValue;
  const getAxisParseValue = (axis: TAxis) => getFieldConfig(axis).parseValue ?? parseValue;
  const getAxisDragPixelsPerStep = (axis: TAxis) =>
    getFieldConfig(axis).dragPixelsPerStep ?? dragPixelsPerStep;
  const isAxisReadOnly = (axis: TAxis) => Boolean(getFieldConfig(axis).readOnly);
  const formatAxisValue = (axis: TAxis, axisValue: number) => {
    const axisFormatValue = getAxisFormatValue(axis);

    return axisFormatValue ? axisFormatValue(axisValue) : `${axisValue}`;
  };

  const emitOptionalLockChange = (nextOptionalLockKeys: Set<string>) => {
    const nextOptionalPairs = sortPairs(
      [...nextOptionalLockKeys]
        .map((key) => getPairFromKey(key))
        .filter((pair): pair is LockPair => Boolean(pair))
    );

    if (isLockStateControlled) {
      onLockedPairsChange?.(nextOptionalPairs);
      return;
    }

    setInternalOptionalLockKeys(nextOptionalLockKeys);
    onLockedPairsChange?.(nextOptionalPairs);
  };

  const toggleLock = (lock: LockConfig) => {
    if (disabled || lock.optional === false) {
      return;
    }

    const lockKey = getPairKey(lock.pair);
    const nextOptionalLockKeys = new Set(optionalLockKeys);

    if (nextOptionalLockKeys.has(lockKey)) {
      nextOptionalLockKeys.delete(lockKey);
    } else {
      nextOptionalLockKeys.add(lockKey);
    }

    emitOptionalLockChange(nextOptionalLockKeys);
  };

  const updateAxisValue = (axis: TAxis, nextAxisValue: number, options?: PointInputChangeOptions) => {
    if (isAxisReadOnly(axis)) {
      return;
    }

    const currentAxisValue = value[axis] ?? 0;
    const delta = nextAxisValue - currentAxisValue;
    const connectedAxes = getConnectedAxes(axis, activeLockKeys, axes);
    const nextValue = { ...value } as TValue;

    for (const connectedAxis of connectedAxes) {
      const typedAxis = connectedAxis as TAxis;

      if (isAxisReadOnly(typedAxis)) {
        continue;
      }

      const axisValue = typedAxis === axis
        ? nextAxisValue
        : (value[typedAxis] ?? 0) + delta;

      nextValue[typedAxis] = normalizeValue(
        axisValue,
        getAxisStep(typedAxis),
        getAxisMin(typedAxis),
        getAxisMax(typedAxis)
      ) as TValue[TAxis];
    }

    onValueChange(nextValue, options);
  };

  const setExpanded = (nextExpanded: boolean) => {
    if (expanded === undefined) {
      setInternalExpanded(nextExpanded);
    }

    onExpandedChange?.(nextExpanded);
  };

  const renderLockButton = (lock: LockConfig) => {
    const lockKey = getPairKey(lock.pair);
    const isLocked = activeLockKeys.has(lockKey);
    const isFixed = lock.optional === false;
    const Icon = isLocked ? Link2 : Link2Off;

    return (
      <Button
        aria-label={`${isLocked ? "Unlock" : "Lock"} ${getPairKey(lock.pair)}`}
        aria-pressed={isLocked}
        disabled={disabled || isFixed}
        key={lockKey}
        onClick={() => toggleLock(lock)}
        size="icon-xs"
        type="button"
        variant={isLocked ? "secondary" : "outline"}
      >
        <Icon />
      </Button>
    );
  };

  const renderAxisField = (axis: TAxis) => (
    <div className="flex min-w-0 items-center gap-2" key={axis}>
      <span className="text-xs text-muted-foreground">{getAxisLabel(axis)}</span>
      <NumericDragInput
        ariaLabel={`${label} ${getAxisLabel(axis)}`}
        disabled={disabled || isAxisReadOnly(axis)}
        dragPixelsPerStep={getAxisDragPixelsPerStep(axis)}
        formatValue={getAxisFormatValue(axis)}
        max={getAxisMax(axis)}
        min={getAxisMin(axis)}
        onBlur={onBlur}
        onFocus={onFocus}
        onInteractionEnd={onInteractionEnd}
        onInteractionStart={onInteractionStart}
        onValueChange={(nextAxisValue, options) => updateAxisValue(axis, nextAxisValue, options)}
        parseValue={getAxisParseValue(axis)}
        step={getAxisStep(axis)}
        value={value[axis] ?? 0}
      />
    </div>
  );

  const renderInlineControls = () => (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {axes.map((axis, axisIndex) => {
        const nextAxis = axes[axisIndex + 1];
        const lockAfterAxis = configuredLocks.find((lock) => {
          const pair = normalizePair(lock.pair);

          return pair[0] === axis && pair[1] === nextAxis;
        });

        return (
          <div className="flex min-w-0 items-center gap-2" key={axis}>
            {renderAxisField(axis)}
            {lockAfterAxis ? renderLockButton(lockAfterAxis) : null}
          </div>
        );
      })}
      {configuredLocks
        .filter((lock) => {
          const pair = normalizePair(lock.pair);

          return Math.abs(getAxisIndex(pair[0]) - getAxisIndex(pair[1])) > 1;
        })
        .map(renderLockButton)}
    </div>
  );

  const renderVerticalControls = () => (
    <div className="flex flex-col gap-2">
      {axes.map((axis) => {
        const axisLocks = configuredLocks.filter((lock) => hasPairAxis(normalizePair(lock.pair), axis));

        return (
          <div className="flex min-w-0 items-center gap-2" key={axis}>
            {renderAxisField(axis)}
            {axisLocks.map((lock) => {
              const otherAxis = getPairOtherAxis(normalizePair(lock.pair), axis);

              return otherAxis && getAxisIndex(axis) < getAxisIndex(otherAxis)
                ? renderLockButton(lock)
                : null;
            })}
          </div>
        );
      })}
    </div>
  );

  const summary = axes
    .map((axis) => `${getAxisLabel(axis)}: ${formatAxisValue(axis, value[axis] ?? 0)}`)
    .join(", ");

  if (layout === "vertical") {
    const canCollapse = collapsible;

    return (
      <div className={cn("flex min-w-0 flex-col gap-2", className)}>
        <div className="flex min-w-0 items-center gap-2">
          {canCollapse ? (
            <Button
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label}`}
              onClick={() => setExpanded(!isExpanded)}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              {isExpanded ? <ChevronDown /> : <ChevronRight />}
            </Button>
          ) : null}
          <span className="shrink-0 text-xs">{label}</span>
          {canCollapse && !isExpanded ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>
          ) : null}
        </div>
        {!canCollapse || isExpanded ? renderVerticalControls() : null}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-3", className)}>
      <span className="shrink-0 text-xs">{label}</span>
      {renderInlineControls()}
    </div>
  );
}

export function Point2Input(props: Point2InputProps) {
  return <PointInputBase {...props} axes={["x", "y"]} />;
}

export function Point3Input(props: Point3InputProps) {
  return <PointInputBase {...props} axes={["x", "y", "z"]} />;
}
