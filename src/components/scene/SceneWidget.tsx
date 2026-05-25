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
import type { SceneRenderMode, SkyGeometryType } from "@/store/modules/scene";

export function SceneWidget() {
  const sceneRenderMode = useWorkspaceStore((state) => state.sceneRenderMode);
  const setSceneRenderMode = useWorkspaceStore((state) => state.setSceneRenderMode);
  const setSkyGeometryType = useWorkspaceStore((state) => state.setSkyGeometryType);
  const setShowOrientationGizmo = useWorkspaceStore((state) => state.setShowOrientationGizmo);
  const setShowSkyGeometry = useWorkspaceStore((state) => state.setShowSkyGeometry);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const showOrientationGizmo = useWorkspaceStore((state) => state.showOrientationGizmo);
  const showSkyGeometry = useWorkspaceStore((state) => state.showSkyGeometry);

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

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs">Sky geometry visible</span>
        <Switch
          aria-label="Sky geometry visible"
          checked={showSkyGeometry}
          onCheckedChange={setShowSkyGeometry}
          size="sm"
        />
      </div>

      <div className="widget-field widget-field-mode">
        <span className="text-xs">Sky geometry</span>
        <Select
          onValueChange={(value) => setSkyGeometryType(value as SkyGeometryType)}
          value={skyGeometryType}
        >
          <SelectTrigger aria-label="Sky geometry" className="h-8 w-full bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="text-xs" value="box">
              Box
            </SelectItem>
            <SelectItem className="text-xs" value="sphere">
              Spherical
            </SelectItem>
          </SelectContent>
        </Select>
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
