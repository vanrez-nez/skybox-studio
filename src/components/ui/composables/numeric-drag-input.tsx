import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/primitives/button";
import { Input } from "@/components/ui/primitives/input";
import { cn } from "@/lib/utils";

type NumericDragInputChangeOptions = {
  history?: "checkpoint" | "skip";
};

type NumericDragInputProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  dragPixelsPerStep?: number;
  formatValue?: (value: number) => string;
  inputClassName?: string;
  max?: number;
  min?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  onValueChange: (value: number, options?: NumericDragInputChangeOptions) => void;
  parseValue?: (value: string) => number | null;
  sizeMode?: "fixed" | "fluid";
  step?: number;
  value: number;
};

type ActiveDrag = {
  hasDragged: boolean;
  interactionStarted: boolean;
  pointerId: number;
  startValue: number;
  startX: number;
};

const DEFAULT_DRAG_PIXELS_PER_STEP = 8;
const DRAG_THRESHOLD_PX = 3;

function defaultFormatValue(value: number) {
  return `${value}`;
}

function defaultParseValue(value: string) {
  const parsedValue = Number.parseFloat(value.trim());

  return Number.isFinite(parsedValue) ? parsedValue : null;
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

function normalizeValue(value: number, min?: number, max?: number) {
  return clampValue(value, min, max);
}

export function NumericDragInput({
  ariaLabel,
  className,
  disabled = false,
  dragPixelsPerStep = DEFAULT_DRAG_PIXELS_PER_STEP,
  formatValue = defaultFormatValue,
  inputClassName,
  max,
  min,
  onBlur,
  onFocus,
  onInteractionEnd,
  onInteractionStart,
  onValueChange,
  parseValue = defaultParseValue,
  sizeMode = "fixed",
  step = 1,
  value,
}: NumericDragInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const [draftValue, setDraftValue] = useState(formatValue(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isEditing || activeDragRef.current) {
      return;
    }

    setDraftValue(formatValue(value));
  }, [formatValue, isEditing, value]);

  const commitDraftValue = () => {
    const parsedValue = parseValue(draftValue);

    if (parsedValue === null) {
      setDraftValue(formatValue(value));
      return;
    }

    const nextValue = normalizeValue(parsedValue, min, max);

    onValueChange(nextValue, { history: "checkpoint" });
    setDraftValue(formatValue(nextValue));
  };

  const resetDraftValue = () => {
    setDraftValue(formatValue(value));
  };

  const enterEditMode = () => {
    setIsEditing(true);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    onFocus?.();
  };

  const updateValueByStep = (direction: -1 | 1) => {
    const nextValue = normalizeValue(value + direction * step, min, max);

    onInteractionStart?.();
    onValueChange(nextValue, { history: "checkpoint" });
    onInteractionEnd?.();
  };

  const handleInputPointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (disabled || isEditing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDragRef.current = {
      hasDragged: false,
      interactionStarted: false,
      pointerId: event.pointerId,
      startValue: value,
      startX: event.clientX,
    };
  };

  const handleInputPointerMove = (event: PointerEvent<HTMLInputElement>) => {
    const activeDrag = activeDragRef.current;

    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - activeDrag.startX;

    if (!activeDrag.hasDragged && Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
      return;
    }

    if (!activeDrag.interactionStarted) {
      activeDrag.interactionStarted = true;
      onInteractionStart?.();
    }

    activeDrag.hasDragged = true;

    const stepDelta = Math.trunc(deltaX / Math.max(1, dragPixelsPerStep));
    const nextValue = normalizeValue(activeDrag.startValue + stepDelta * step, min, max);

    onValueChange(nextValue, { history: "skip" });
    setDraftValue(formatValue(nextValue));
  };

  const handleInputPointerEnd = (event: PointerEvent<HTMLInputElement>) => {
    const activeDrag = activeDragRef.current;

    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return;
    }

    activeDragRef.current = null;

    if (activeDrag.interactionStarted) {
      onInteractionEnd?.();
    }

    if (!activeDrag.hasDragged) {
      enterEditMode();
    }
  };

  const handleInputBlur = () => {
    if (!isEditing) {
      return;
    }

    commitDraftValue();
    setIsEditing(false);
    onBlur?.();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetDraftValue();
      event.currentTarget.blur();
    }
  };

  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      <Button
        aria-label={`Decrement ${ariaLabel}`}
        className="h-7 w-5 rounded-r-none border-r-0 px-0"
        disabled={disabled}
        onClick={() => updateValueByStep(-1)}
        size="icon-xs"
        type="button"
        variant="outline"
      >
        <ChevronLeft />
      </Button>
      <Input
        ref={inputRef}
        aria-label={ariaLabel}
        className={cn(
          "h-7 cursor-ew-resize rounded-none bg-background px-2 text-center font-mono text-xs",
          sizeMode === "fixed" ? "w-16" : "min-w-0 flex-1",
          isEditing && "cursor-text",
          inputClassName
        )}
        disabled={disabled}
        inputMode="numeric"
        onBlur={handleInputBlur}
        onChange={(event) => setDraftValue(event.target.value)}
        onKeyDown={handleInputKeyDown}
        onPointerCancel={handleInputPointerEnd}
        onPointerDown={handleInputPointerDown}
        onPointerMove={handleInputPointerMove}
        onPointerUp={handleInputPointerEnd}
        readOnly={!isEditing}
        type="text"
        value={draftValue}
      />
      <Button
        aria-label={`Increment ${ariaLabel}`}
        className="h-7 w-5 rounded-l-none border-l-0 px-0"
        disabled={disabled}
        onClick={() => updateValueByStep(1)}
        size="icon-xs"
        type="button"
        variant="outline"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
