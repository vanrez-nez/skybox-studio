import { NumericDragInput } from "@/components/ui/numeric-drag-input";
import { cn } from "@/lib/utils";

type RotationFieldChangeOptions = {
  history?: "checkpoint" | "skip";
};

type RotationFieldProps = {
  ariaLabel: string;
  className?: string;
  inputAriaLabel: string;
  label: string;
  layout?: "inline" | "stacked";
  onBlur?: () => void;
  onFocus?: () => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  onValueChange: (rotation: number, options?: RotationFieldChangeOptions) => void;
  sizeMode?: "fixed" | "fluid";
  value: number;
};

function normalizeRotation(rotation: number) {
  return ((Math.round(rotation) % 360) + 360) % 360;
}

function parseNumericInput(value: string) {
  const parsedValue = Number.parseFloat(value.replace("%", "").trim());

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function RotationField({
  ariaLabel,
  className = "",
  inputAriaLabel,
  label,
  layout = "inline",
  onBlur,
  onFocus,
  onInteractionEnd,
  onInteractionStart,
  onValueChange,
  sizeMode = "fixed",
  value,
}: RotationFieldProps) {
  const normalizedValue = normalizeRotation(value);
  const formatRotationValue = (rotation: number) => `${normalizeRotation(rotation)} °`;
  const controls = (
    <div className="widget-field-rotation-controls">
      <span className="w-4 shrink-0 text-right text-[10px] text-muted-foreground/70">θ</span>
      <NumericDragInput
        ariaLabel={inputAriaLabel}
        className={cn(sizeMode === "fluid" && "min-w-0 flex-1")}
        formatValue={formatRotationValue}
        onBlur={onBlur}
        onFocus={onFocus}
        onInteractionEnd={onInteractionEnd}
        onInteractionStart={onInteractionStart}
        onValueChange={(rotation, options) => onValueChange(normalizeRotation(rotation), options)}
        parseValue={(text) => {
          const parsedValue = parseNumericInput(text);

          return parsedValue;
        }}
        sizeMode={sizeMode}
        step={1}
        value={normalizedValue}
      />
    </div>
  );

  if (layout === "stacked") {
    return (
      <div
        aria-label={ariaLabel}
        className={cn("widget-field widget-field-rotation-stacked", className)}
      >
        <span className="text-xs">{label}</span>
        {controls}
      </div>
    );
  }

  return (
    <div aria-label={ariaLabel} className={cn("widget-field widget-field-rotation", className)}>
      <span className="text-xs">{label}</span>
      {controls}
    </div>
  );
}
