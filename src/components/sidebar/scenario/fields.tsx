import { FloatingColorPicker } from "@/components/ui/composables/FloatingColorPicker";
import { Slider } from "@/components/ui/primitives/slider";
import { Switch } from "@/components/ui/primitives/switch";

// Small shared field rows for the Preview panels. The layer panels each hand-roll these; the two
// scenario panels need the same three shapes, so they live here instead of being copied twice.
// A toggle row is genuinely new — no layer panel uses Switch or Checkbox today.

export function SliderRow({
  format = (value: number) => value.toFixed(2),
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  format?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
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
        onValueChange={(next) => onChange(next[0] ?? value)}
        step={step}
        value={[value]}
      />
    </div>
  );
}

export function ColorRow({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (color: string) => void;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground/70">
      <span>{label}</span>
      <FloatingColorPicker onChange={onChange} value={value} />
    </div>
  );
}

export function ToggleRow({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (checked: boolean) => void;
  value: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground/70">
      <span>{label}</span>
      <Switch aria-label={label} checked={value} onCheckedChange={onChange} size="sm" />
    </div>
  );
}
