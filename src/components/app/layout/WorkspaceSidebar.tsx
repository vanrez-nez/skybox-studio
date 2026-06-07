import { LayersWidget } from "@/components/sidebar/layers/LayersWidget";
import { getEffectLayerAddon } from "@/effects/effect-layer";
import { useWorkspaceStore } from "@/store/app";

export function WorkspaceSidebar() {
  const selectedLayer = useWorkspaceStore((state) =>
    state.effectLayers.find((layer) => layer.id === state.selectedLayerId)
  );

  const SelectedPanel = selectedLayer ? getEffectLayerAddon(selectedLayer.type).Panel : undefined;

  return (
    <aside
      aria-label="Workspace sidebar"
      className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden bg-sidebar p-2"
    >
      <LayersWidget />
      {SelectedPanel ? (
        <div className="min-h-0 flex-1 overflow-hidden [&>.widget-panel]:h-full">
          <SelectedPanel />
        </div>
      ) : null}
    </aside>
  );
}
