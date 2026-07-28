import { LayersWidget } from "@/components/sidebar/layers/LayersWidget";
import { ScenarioWidget } from "@/components/sidebar/scenario/ScenarioWidget";
import { SceneWidget } from "@/components/sidebar/scenario/SceneWidget";
import { getEffectLayerAddon } from "@/effects/effect-layer";
import { useWorkspaceStore } from "@/store/app";

export function WorkspaceSidebar() {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const selectedLayer = useWorkspaceStore((state) =>
    state.effectLayers.find((layer) => layer.id === state.selectedLayerId)
  );

  const SelectedPanel = selectedLayer ? getEffectLayerAddon(selectedLayer.type).Panel : undefined;

  return (
    <aside
      aria-label="Workspace sidebar"
      className="flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto overflow-x-hidden bg-sidebar p-2"
    >
      {activeView === "preview" ? (
        <>
          <ScenarioWidget />
          <SceneWidget />
        </>
      ) : (
        <>
          <LayersWidget />
          {SelectedPanel ? (
            <div className="min-h-0 flex-1 overflow-hidden [&>.widget-panel]:h-full">
              <SelectedPanel />
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}
