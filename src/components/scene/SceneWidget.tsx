import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Widget } from "@/components/widgets/Widget";
import { useWorkspaceStore } from "@/store/app";
import type { SceneRenderMode } from "@/store/modules/scene";

export function SceneWidget() {
  const sceneRenderMode = useWorkspaceStore((state) => state.sceneRenderMode);
  const setSceneRenderMode = useWorkspaceStore((state) => state.setSceneRenderMode);
  const setShowOrientationGizmo = useWorkspaceStore((state) => state.setShowOrientationGizmo);
  const showOrientationGizmo = useWorkspaceStore((state) => state.showOrientationGizmo);

  return (
    <Widget title="Scene" contentClassName="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs">Show orientation gizmo</span>
        <Switch
          aria-label="Show orientation gizmo"
          checked={showOrientationGizmo}
          onCheckedChange={setShowOrientationGizmo}
          size="sm"
        />
      </div>

      <div className="widget-field widget-field-mode">
        <span className="text-xs">Mode</span>
        <Select
          onValueChange={(value) => setSceneRenderMode(value as SceneRenderMode)}
          value={sceneRenderMode}
        >
          <SelectTrigger aria-label="Scene mode" className="h-8 w-full bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="text-xs" value="live">
              Live
            </SelectItem>
            <SelectItem className="text-xs" value="texture-baked">
              Texture baked
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Widget>
  );
}
