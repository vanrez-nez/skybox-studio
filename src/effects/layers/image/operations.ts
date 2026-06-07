import {
  cloneImageState,
  createDefaultImageState,
  type ImagePlacement,
  type ImageState,
} from "@/effects/layers/image/state";

export function replaceImageState(next: ImageState): ImageState {
  return cloneImageState(next);
}

export function clearImageState(params: ImageState): ImageState {
  if (!params.src && !params.assetId) {
    return params;
  }

  return createDefaultImageState();
}

export function setImageSource(params: ImageState, src: string | null): ImageState {
  if (params.src === src) {
    return params;
  }

  return { ...params, src };
}

export function setImagePlacement(
  params: ImageState,
  placement: ImagePlacement | null
): ImageState {
  return { ...params, placement };
}
