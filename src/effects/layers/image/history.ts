import type { EffectLayer } from "@/effects/effect-layer";
import { cloneImageState, type ImageState } from "@/effects/layers/image/state";

export function cloneImageStateForHistory(image: ImageState): ImageState {
  return {
    ...cloneImageState(image),
    pixels: null,
    src: null,
  };
}

export function createRuntimeImageLookup(effectLayers: EffectLayer[]) {
  const byAssetId = new Map<string, ImageState>();
  const byLayerId = new Map<string, ImageState>();

  effectLayers.forEach((layer) => {
    if (layer.type !== "image") {
      return;
    }

    const params = layer.params as ImageState;

    if (!params.assetId) {
      return;
    }

    if (!params.src && !params.pixels) {
      return;
    }

    byLayerId.set(layer.id, params);
    byAssetId.set(params.assetId, params);
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
  if (layer.type !== "image") {
    return layer;
  }

  const params = layer.params as ImageState;

  if (!params.assetId) {
    return layer;
  }

  const runtimeImage =
    runtimeLookup.byLayerId.get(layer.id) ?? runtimeLookup.byAssetId.get(params.assetId);

  return {
    ...layer,
    params: rehydrateImageRuntimeData(params, runtimeImage),
  };
}
