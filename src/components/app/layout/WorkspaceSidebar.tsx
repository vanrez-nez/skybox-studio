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

  const selectedPanel = (() => {
    if (selectedLayer?.type === "gradient") {
      return <GradientWidget />;
    }

    if (selectedLayer?.type === "field-gradient") {
      return <FieldGradientWidget />;
    }

    if (selectedLayer?.type === "image") {
      return <ImageWidget />;
    }

    if (selectedLayer?.type === "spot") {
      return <SpotWidget />;
    }

    return null;
  })();

  return (
    <aside
      aria-label="Workspace sidebar"
      className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden bg-sidebar p-2"
    >
      <LayersWidget />
      {selectedPanel ? (
        <div className="min-h-0 flex-1 overflow-hidden [&>.widget-panel]:h-full">
          {selectedPanel}
        </div>
      ) : null}
    </aside>
  );
}
