import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/primitives/button";
import { Input } from "@/components/ui/primitives/input";
import { Slider } from "@/components/ui/primitives/slider";
import { Widget, type WidgetOwnerRect, type WidgetPosition } from "@/components/sidebar/panels/Widget";
import { cn } from "@/lib/utils";

type SliderInputHistoryOptions = {
  history?: "checkpoint" | "skip";
};

type SliderInputProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  inputClassName?: string;
  max?: number;
  min?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  onPanelOpen?: () => void;
  onValueChange: (value: number, options?: SliderInputHistoryOptions) => void;
  panelClassName?: string;
  parseValue?: (value: string) => number | null;
  sizeMode?: "fixed" | "fluid";
  sliderAriaLabel: string;
  step?: number;
  value: number;
};

const DEFAULT_PANEL_POSITION: WidgetPosition = { x: 12, y: 12 };

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function defaultFormatValue(value: number) {
  return `${Math.round(value)} %`;
}

function defaultParseValue(value: string) {
  const parsedValue = Number.parseFloat(value.replace("%", "").trim());

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function rectToWidgetOwnerRect(rect: DOMRect): WidgetOwnerRect {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

export function SliderInput({
  ariaLabel,
  className,
  disabled = false,
  formatValue = defaultFormatValue,
  inputClassName,
  max = 100,
  min = 0,
  onBlur,
  onFocus,
  onInteractionEnd,
  onInteractionStart,
  onPanelOpen,
  onValueChange,
  panelClassName,
  parseValue = defaultParseValue,
  sizeMode = "fixed",
  sliderAriaLabel,
  step = 1,
  value,
}: SliderInputProps) {
  const triggerId = useId().replace(/:/g, "");
  const [draftValue, setDraftValue] = useState(formatValue(value));
  const [isEditing, setIsEditing] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState(DEFAULT_PANEL_POSITION);
  const [panelOwnerRect, setPanelOwnerRect] = useState<WidgetOwnerRect | null>(null);
  const isAdjustingByPointerRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
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

    const nextValue = clampValue(parsedValue, min, max);

    onValueChange(nextValue);
    setDraftValue(formatValue(nextValue));
  };

  const resetDraftValue = () => {
    setDraftValue(formatValue(value));
  };

  const handleInputFocus = (event: FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    event.currentTarget.select();
    onFocus?.();
  };

  const handleInputBlur = () => {
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

  const togglePanel = (event: MouseEvent<HTMLButtonElement>) => {
    const triggerRect = event.currentTarget.getBoundingClientRect();

    onPanelOpen?.();
    setPanelPosition({
      x: triggerRect.left - 128,
      y: triggerRect.bottom + 6,
    });
    setPanelOwnerRect(rectToWidgetOwnerRect(triggerRect));
    setIsPanelOpen((open) => !open);
  };

  return (
    <>
      <div className={cn("flex min-w-0 items-center", sizeMode === "fluid" && "w-full", className)}>
        <Input
          aria-label={ariaLabel}
          className={cn(
            "h-7 rounded-r-none border-r-0 bg-background px-2 font-mono text-xs",
            sizeMode === "fixed" ? "w-16" : "min-w-0 flex-1",
            inputClassName
          )}
          disabled={disabled}
          inputMode="numeric"
          onBlur={handleInputBlur}
          onChange={(event) => setDraftValue(event.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          type="text"
          value={draftValue}
        />
        <Button
          aria-expanded={isPanelOpen}
          aria-label={`Open ${ariaLabel} slider`}
          className="h-7 w-5 rounded-l-none px-0"
          data-slider-input-trigger={triggerId}
          disabled={disabled}
          onClick={togglePanel}
          size="icon-xs"
          type="button"
          variant="outline"
        >
          <ChevronDown />
        </Button>
      </div>

      {!disabled && isPanelOpen ? (
        <Widget
          className={cn("w-56", panelClassName)}
          contentClassName="min-h-0 p-3"
          floatingOwnerRect={panelOwnerRect ?? undefined}
          floatingPosition={panelPosition}
          ignoreFloatingDismissSelector={`[data-slider-input-trigger="${triggerId}"]`}
          onFloatingDismiss={() => setIsPanelOpen(false)}
          showFloatingOwnerCallout
          variant="floating"
        >
          <Slider
            aria-label={sliderAriaLabel}
            max={max}
            min={min}
            onPointerCancel={() => {
              isAdjustingByPointerRef.current = false;
              onInteractionEnd?.();
            }}
            onPointerDown={() => {
              isAdjustingByPointerRef.current = true;
              onInteractionStart?.();
            }}
            onValueChange={(sliderValue) =>
              onValueChange(sliderValue[0] ?? value, {
                history: isAdjustingByPointerRef.current ? "skip" : "checkpoint",
              })
            }
            onValueCommit={() => {
              isAdjustingByPointerRef.current = false;
              onInteractionEnd?.();
            }}
            step={step}
            value={[value]}
          />
        </Widget>
      ) : null}
    </>
  );
}
