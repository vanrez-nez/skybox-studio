import { FieldGradientWidget } from "@/components/gradient/FieldGradientWidget";
import { GradientWidget } from "@/components/gradient/GradientWidget";
import { LayersWidget } from "@/components/layers/LayersWidget";
import { useWorkspaceStore } from "@/store/workspace-store";

export function WorkspaceSidebar() {
  const selectedLayer = useWorkspaceStore((state) =>
    state.effectLayers.find((layer) => layer.id === state.selectedLayerId)
  );

  return (
    <aside aria-label="Workspace sidebar" className="flex h-full w-full flex-col gap-2 bg-sidebar p-2">
      <LayersWidget />
      {selectedLayer?.type === "gradient" ? <GradientWidget /> : null}
      {selectedLayer?.type === "field-gradient" ? <FieldGradientWidget /> : null}
    </aside>
  );
}
