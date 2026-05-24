import { RotateCcw, RotateCw } from "lucide-react";

import { FloatingActionPanel } from "@/components/panels/FloatingActionPanel";
import { Button } from "@/components/ui/button";

export function EditorActionPanel() {
  return (
    <FloatingActionPanel aria-label="Editor actions" placement="top-left">
      <Button className="text-xs" size="sm" variant="ghost">
        <RotateCcw />
        Undo
      </Button>
      <Button className="text-xs" size="sm" variant="ghost">
        <RotateCw />
        Redo
      </Button>
    </FloatingActionPanel>
  );
}
