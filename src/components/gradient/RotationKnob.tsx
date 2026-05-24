import { type KeyboardEvent, type PointerEvent, useRef } from "react";

type RotationKnobProps = {
  onChange: (rotation: number) => void;
  value: number;
};

function normalizeRotation(rotation: number) {
  return ((Math.round(rotation) % 360) + 360) % 360;
}

function getPointerRotation(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radians = Math.atan2(event.clientY - centerY, event.clientX - centerX);
  const degrees = radians * (180 / Math.PI);

  return normalizeRotation(degrees);
}

export function RotationKnob({ onChange, value }: RotationKnobProps) {
  const activePointerIdRef = useRef<number | null>(null);
  const normalizedValue = normalizeRotation(value);

  const setRotationFromPointer = (event: PointerEvent<HTMLButtonElement>) => {
    onChange(getPointerRotation(event));
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setRotationFromPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    setRotationFromPointer(event);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(normalizeRotation(normalizedValue + 1));
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(normalizeRotation(normalizedValue - 1));
    }

    if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      onChange(359);
    }
  };

  return (
    <button
      aria-label="Gradient rotation knob"
      aria-valuemax={359}
      aria-valuemin={0}
      aria-valuenow={normalizedValue}
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
        style={{ transform: `rotate(${normalizedValue}deg)` }}
      >
        <span className="absolute top-1/2 right-1 size-1.5 -translate-y-1/2 rounded-full bg-foreground" />
      </span>
    </button>
  );
}
