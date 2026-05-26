import { type MouseEvent, useEffect, useRef, useState } from "react";
import Coloris from "@melloware/coloris";

import { Button } from "@/components/ui/button";
import {
  Widget,
  type WidgetOwnerRect,
  type WidgetPosition,
} from "@/components/widgets/Widget";

type FloatingColorPickerProps = {
  onChange: (color: string) => void;
  onChangeEnd?: () => void;
  onChangeStart?: () => void;
  value: string;
};

const DEFAULT_PICKER_POSITION: WidgetPosition = { x: 12, y: 12 };

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

function ColorisInlinePicker({
  onChange,
  value,
}: Pick<FloatingColorPickerProps, "onChange" | "value">) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    const picker = pickerRef.current;

    if (!input || !picker) {
      return;
    }

    input.value = value;

    Coloris.init();
    Coloris({
      alpha: false,
      defaultColor: value,
      el: input,
      format: "hex",
      inline: true,
      parent: picker,
      swatches: ["#ff6a00", "#ffd000", "#ff8a00", "#ffffff", "#111820"],
      theme: "default",
      themeMode: "dark",
      wrap: false,
    });

    const handlePick = (event: Event) => {
      const color = (event as CustomEvent<{ color?: string }>).detail?.color;

      if (color) {
        onChangeRef.current(color);
      }
    };

    document.addEventListener("coloris:pick", handlePick);

    return () => {
      document.removeEventListener("coloris:pick", handlePick);
      Coloris.close();
    };
  }, []);

  return (
    <div className="coloris-panel-surface">
      <input ref={inputRef} aria-label="Gradient stop color" className="sr-only" type="text" />
      <div ref={pickerRef} />
    </div>
  );
}

export function FloatingColorPicker({
  onChange,
  onChangeEnd,
  onChangeStart,
  value,
}: FloatingColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerOwnerRect, setPickerOwnerRect] = useState<WidgetOwnerRect | null>(null);
  const [pickerPosition, setPickerPosition] = useState(DEFAULT_PICKER_POSITION);

  const togglePicker = (event: MouseEvent<HTMLButtonElement>) => {
    const triggerRect = event.currentTarget.getBoundingClientRect();

    if (!isOpen) {
      onChangeStart?.();
      setPickerPosition({
        x: triggerRect.left,
        y: triggerRect.bottom + 4,
      });
      setPickerOwnerRect(rectToWidgetOwnerRect(triggerRect));
    } else {
      onChangeEnd?.();
    }

    setIsOpen((open) => !open);
  };

  return (
    <>
      <Button
        aria-label="Select gradient stop color"
        className="size-7 overflow-hidden p-0"
        onClick={togglePicker}
        type="button"
        variant="outline"
      >
        <span
          aria-hidden="true"
          className="size-full rounded-[inherit]"
          style={{ backgroundColor: value }}
        />
      </Button>
      {isOpen ? (
        <Widget
          className="w-fit"
          contentClassName="min-h-0 p-0"
          floatingOwnerRect={pickerOwnerRect ?? undefined}
          floatingPosition={pickerPosition}
          ignoreFloatingDismissSelector=".clr-picker"
          onFloatingDismiss={() => {
            onChangeEnd?.();
            setIsOpen(false);
          }}
          showFloatingOwnerCallout
          title="Color"
          variant="floating"
        >
          <ColorisInlinePicker onChange={onChange} value={value} />
        </Widget>
      ) : null}
    </>
  );
}
