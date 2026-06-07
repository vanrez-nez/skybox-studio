import { normalizeImagePlacement } from "@/runtime/image-placement-transform";
import type { SkyboxImagePlacement } from "@/runtime";

export type ImagePlacement = SkyboxImagePlacement;

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

function cloneImagePlacement(placement: ImageState["placement"]): ImageState["placement"] {
  if (!placement) {
    return null;
  }

  return normalizeImagePlacement(placement);
}

export function cloneImageState(image: ImageState): ImageState {
  return {
    ...image,
    assetId: image.assetId ?? null,
    pixels: image.pixels ? [...image.pixels] : null,
    placement: cloneImagePlacement(image.placement),
    src: image.src ?? null,
  };
}
