import { Knob } from "@/components/ui/knob";

type RotationKnobProps = {
  onChange: (rotation: number) => void;
  onChangeEnd?: () => void;
  onChangeStart?: () => void;
  value: number;
};

function normalizeRotation(rotation: number) {
  return ((Math.round(rotation) % 360) + 360) % 360;
}

export function RotationKnob({
  onChange,
  onChangeEnd,
  onChangeStart,
  value,
}: RotationKnobProps) {
  return (
    <Knob
      ariaLabel="Gradient rotation knob"
      max={360}
      min={0}
      onChange={(rotation) => onChange(normalizeRotation(rotation))}
      onChangeEnd={onChangeEnd}
      onChangeStart={onChangeStart}
      step={1}
      value={normalizeRotation(value)}
    />
  );
}
