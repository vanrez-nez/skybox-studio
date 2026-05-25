import * as THREE from "three";

import type { GradientState } from "@/store/modules/layers";
import {
  type BakedGradientImage,
  bakeDirectionSpaceGradientData,
  drawBakedGradientToCanvas,
} from "@/processes/texture-baking-core";

export const TEXTURE_BAKING_CONVENTION = {
  colorEncoding: "linear-rgb-buffer-to-srgb-canvas",
  equirectRow0: "nadir",
  heightFromWidth: "height = width / 2",
  textureFlipY: false,
} as const;

export type BakedSkyboxTexture = THREE.CanvasTexture & {
  image: HTMLCanvasElement;
};

export function bakeDirectionSpaceGradient(
  canvas: HTMLCanvasElement,
  gradient: GradientState,
  options: { width?: number } = {}
) {
  drawBakedGradientToCanvas(canvas, bakeDirectionSpaceGradientData(gradient, options));
}

export function createTextureBakingSkyboxTexture(
  gradient?: GradientState,
  bakedImage?: BakedGradientImage
): BakedSkyboxTexture {
  const canvas = document.createElement("canvas");
  const texture = new THREE.CanvasTexture(canvas) as BakedSkyboxTexture;

  if (bakedImage) {
    drawBakedGradientToCanvas(canvas, bakedImage);
  } else if (gradient) {
    bakeDirectionSpaceGradient(canvas, gradient);
  } else {
    canvas.width = 1;
    canvas.height = 1;
    canvas.getContext("2d")?.fillRect(0, 0, 1, 1);
  }

  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = TEXTURE_BAKING_CONVENTION.textureFlipY;
  texture.needsUpdate = true;

  return texture;
}

export function updateTextureBakingSkyboxTexture(
  texture: BakedSkyboxTexture,
  bakedImage: BakedGradientImage
) {
  drawBakedGradientToCanvas(texture.image, bakedImage);
  texture.needsUpdate = true;
}
