import { FieldGradientWidget } from "@/components/gradient/FieldGradientWidget";
import { GradientWidget } from "@/components/gradient/GradientWidget";
import { ImageWidget } from "@/components/image/ImageWidget";
import { LayersWidget } from "@/components/layers/LayersWidget";
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
    </aside>
  );
}
