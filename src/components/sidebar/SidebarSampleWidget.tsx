import { type MouseEvent, useState } from "react";
import { PanelTopOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Widget, type WidgetPosition } from "@/components/widgets/Widget";

const DEFAULT_FLOATING_SAMPLE_POSITION: WidgetPosition = { x: 12, y: 12 };

export function SidebarSampleWidget() {
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState(DEFAULT_FLOATING_SAMPLE_POSITION);

  const toggleFloating = (event: MouseEvent<HTMLButtonElement>) => {
    const triggerRect = event.currentTarget.getBoundingClientRect();

    if (!isFloatingOpen) {
      setFloatingPosition({
        x: triggerRect.left,
        y: triggerRect.bottom + 4,
      });
    }

    setIsFloatingOpen((open) => !open);
  };

  return (
    <>
      <Widget title="Properties">
        <Button
          className="text-xs"
          onClick={toggleFloating}
          size="sm"
          type="button"
          variant="secondary"
        >
          <PanelTopOpen />
          {isFloatingOpen ? "Hide floating" : "Show floating"}
        </Button>
      </Widget>
      {isFloatingOpen ? (
        <Widget
          className="w-64"
          floatingPosition={floatingPosition}
          onFloatingDismiss={() => setIsFloatingOpen(false)}
          title="Floating sample"
          variant="floating"
        >
          <Button className="text-xs" size="sm" type="button" variant="outline">
            Sample action
          </Button>
        </Widget>
      ) : null}
    </>
  );
}
