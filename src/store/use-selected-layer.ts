import { useWorkspaceStore } from "@/store/app";

// Reads the params of the currently selected layer when it matches `type`.
// Returns a stable reference (the layer's params object) so panels re-render
// only when the selected layer's params actually change.
export function useSelectedLayerParams<TParams>(type: string): TParams | null {
  return useWorkspaceStore((state) => {
    const layer = state.effectLayers.find((effectLayer) => effectLayer.id === state.selectedLayerId);

    return layer && layer.type === type ? (layer.params as TParams) : null;
  });
}
