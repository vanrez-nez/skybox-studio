import { type KeyboardEvent, type PointerEvent, useRef } from "react";

type KnobProps = {
  ariaLabel: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
};

const FULL_TURN = 360;

function normalizeAngle(angle: number) {
  return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPointerAngle(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radians = Math.atan2(event.clientY - centerY, event.clientX - centerX);

  return normalizeAngle(radians * (180 / Math.PI));
}

function getShortestAngleDelta(fromAngle: number, toAngle: number) {
  return ((toAngle - fromAngle + 540) % FULL_TURN) - 180;
}

function applyStep(value: number, step: number) {
  return Math.round(value / step) * step;
}

function isBounded(min: number | undefined, max: number | undefined) {
  return Number.isFinite(min) && Number.isFinite(max) && min !== max;
}

function angleToBoundedValue(angle: number, min: number, max: number, step: number) {
  const value = min + (normalizeAngle(angle) / FULL_TURN) * (max - min);

  return clamp(applyStep(value, step), min, max);
}

function valueToAngle(value: number, min: number | undefined, max: number | undefined) {
  if (!isBounded(min, max)) {
    return value;
  }

  return ((value - min!) / (max! - min!)) * FULL_TURN;
}

export function Knob({ ariaLabel, max, min, onChange, step = 1, value }: KnobProps) {
  const activePointerIdRef = useRef<number | null>(null);
  const previousPointerAngleRef = useRef(0);
  const currentValueRef = useRef(value);
  const bounded = isBounded(min, max);
  const visualAngle = valueToAngle(value, min, max);

  currentValueRef.current = value;

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const pointerAngle = getPointerAngle(event);

    activePointerIdRef.current = event.pointerId;
    previousPointerAngleRef.current = pointerAngle;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (bounded) {
      onChange(angleToBoundedValue(pointerAngle, min!, max!, step));
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    const pointerAngle = getPointerAngle(event);

    if (bounded) {
      onChange(angleToBoundedValue(pointerAngle, min!, max!, step));
      previousPointerAngleRef.current = pointerAngle;
      return;
    }

    const delta = getShortestAngleDelta(previousPointerAngleRef.current, pointerAngle);
    const nextValue = applyStep(currentValueRef.current + delta, step);

    previousPointerAngleRef.current = pointerAngle;
    currentValueRef.current = nextValue;
    onChange(nextValue);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextStep = step || 1;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(bounded ? clamp(value + nextStep, min!, max!) : value + nextStep);
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(bounded ? clamp(value - nextStep, min!, max!) : value - nextStep);
    }

    if (bounded && event.key === "Home") {
      event.preventDefault();
      onChange(min!);
    }

    if (bounded && event.key === "End") {
      event.preventDefault();
      onChange(max!);
    }
  };

  return (
    <button
      aria-label={ariaLabel}
      aria-valuemax={bounded ? max : undefined}
      aria-valuemin={bounded ? min : undefined}
      aria-valuenow={value}
      className="grid size-9 touch-none place-items-center rounded-full border bg-muted outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onKeyDown={handleKeyDown}
      onLostPointerCapture={() => {
        activePointerIdRef.current = null;
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      role="slider"
      type="button"
    >
      <span
        className="relative size-7 rounded-full"
        style={{ transform: `rotate(${visualAngle}deg)` }}
      >
        <span className="absolute top-1/2 right-1 size-1.5 -translate-y-1/2 rounded-full bg-foreground" />
      </span>
    </button>
  );
}
