import { FieldGradientWidget } from "@/components/sidebar/panels/FieldGradientWidget";
import { GradientWidget } from "@/components/sidebar/panels/GradientWidget";
import { ImageWidget } from "@/components/sidebar/panels/ImageWidget";
import { LayersWidget } from "@/components/sidebar/layers/LayersWidget";
import { SpotWidget } from "@/components/sidebar/panels/SpotWidget";
import { useWorkspaceStore } from "@/store/app";

export function WorkspaceSidebar() {
  const selectedLayer = useWorkspaceStore((state) =>
    state.effectLayers.find((layer) => layer.id === state.selectedLayerId)
  );

  return (
    <aside aria-label="Workspace sidebar" className="flex h-full w-full flex-col gap-2 bg-sidebar p-2">
      <LayersWidget />
      {selectedLayer?.type === "gradient" ? <GradientWidget /> : null}
      {selectedLayer?.type === "field-gradient" ? <FieldGradientWidget /> : null}
      {selectedLayer?.type === "image" ? <ImageWidget /> : null}
      {selectedLayer?.type === "spot" ? <SpotWidget /> : null}
    </aside>
  );
}
