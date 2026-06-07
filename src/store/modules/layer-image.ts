import { cloneImageState, type EffectLayer } from "@/effects/effect-layer";
import type { SkyboxImagePlacement } from "@/runtime";
import type { LayersSlice } from "@/store/modules/layers";
import {
  getHistoryPatch,
  syncSelectedImageLayer,
  type LayersSet,
} from "@/store/modules/layer-utils";

export const IMAGE_PLACEMENT_TRANSACTION_SCOPE = "image-placement";

export type ImageState = {
  assetId: string | null;
  byteSize: number;
  fileName: string;
  height: number;
  loadedAt: number | null;
  mimeType: string;
  pixels: number[] | null;
  placement: ImagePlacement | null;
  src: string | null;
  width: number;
};

export type ImagePlacement = SkyboxImagePlacement;

export function createDefaultImageState(): ImageState {
  return {
    assetId: null,
    byteSize: 0,
    fileName: "",
    height: 0,
    loadedAt: null,
    mimeType: "",
    pixels: null,
    placement: null,
    src: null,
    width: 0,
  };
}

export function cloneImageStateForHistory(image: ImageState): ImageState {
  return {
    ...cloneImageState(image),
    pixels: null,
    src: null,
  };
}

export function createRuntimeImageLookup(state: LayersSlice) {
  const byAssetId = new Map<string, ImageState>();
  const byLayerId = new Map<string, ImageState>();

  state.effectLayers.forEach((layer) => {
    if (layer.type !== "image" || !layer.params.assetId) {
      return;
    }

    if (!layer.params.src && !layer.params.pixels) {
      return;
    }

    byLayerId.set(layer.id, layer.params);
    byAssetId.set(layer.params.assetId, layer.params);
  });

  return { byAssetId, byLayerId };
}

export function rehydrateImageRuntimeData(
  image: ImageState,
  runtimeImage: ImageState | undefined
): ImageState {
  if (!runtimeImage || !image.assetId || runtimeImage.assetId !== image.assetId) {
    return image;
  }

  return {
    ...image,
    pixels: runtimeImage.pixels ? [...runtimeImage.pixels] : image.pixels,
    src: runtimeImage.src ?? image.src,
  };
}

export function restoreImageLayerRuntimeData(
  layer: EffectLayer,
  runtimeLookup: ReturnType<typeof createRuntimeImageLookup>
): EffectLayer {
  if (layer.type !== "image" || !layer.params.assetId) {
    return layer;
  }

  const runtimeImage =
    runtimeLookup.byLayerId.get(layer.id) ?? runtimeLookup.byAssetId.get(layer.params.assetId);

  return {
    ...layer,
    params: rehydrateImageRuntimeData(layer.params, runtimeImage),
  };
}

type ImageLayerActions = Pick<
  LayersSlice,
  "clearImage" | "setImage" | "setImageAssetSource" | "setImagePlacement"
>;

export function createImageLayerActions(set: LayersSet): ImageLayerActions {
  return {
    clearImage: () =>
      set((state) => {
        const image = createDefaultImageState();

        if (!state.image.src && !state.image.assetId) {
          return state;
        }

        return {
          effectLayers: syncSelectedImageLayer(state, image),
          image,
          ...getHistoryPatch(state),
        };
      }),
    setImage: (image) =>
      set((state) => ({
        effectLayers: syncSelectedImageLayer(state, image),
        image: cloneImageState(image),
        ...getHistoryPatch(state),
      })),
    setImageAssetSource: (id, src) =>
      set((state) => {
        const layer = state.effectLayers.find((effectLayer) => effectLayer.id === id);

        if (layer?.type !== "image" || layer.params.src === src) {
          return state;
        }

        const image = {
          ...layer.params,
          src,
        };

        return {
          effectLayers: state.effectLayers.map((effectLayer) =>
            effectLayer.id === id && effectLayer.type === "image"
              ? { ...effectLayer, params: cloneImageState(image) }
              : effectLayer
          ),
          ...(state.selectedLayerId === id ? { image: cloneImageState(image) } : {}),
        };
      }),
    setImagePlacement: (id, placement, options) =>
      set((state) => {
        const layer = state.effectLayers.find((effectLayer) => effectLayer.id === id);

        if (layer?.type !== "image") {
          return state;
        }

        const image = {
          ...layer.params,
          placement,
        };

        return {
          effectLayers: state.effectLayers.map((effectLayer) =>
            effectLayer.id === id && effectLayer.type === "image"
              ? { ...effectLayer, params: cloneImageState(image) }
              : effectLayer
          ),
          ...(state.selectedLayerId === id ? { image: cloneImageState(image) } : {}),
          ...getHistoryPatch(state, options),
        };
      }),
  };
}
