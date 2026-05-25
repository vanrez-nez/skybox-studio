import type { GradientState } from "@/store/modules/layers";
import {
  bakeSkyboxImageData,
  DEFAULT_BAKE_WIDTH,
  type BakedSkyboxImageData,
  type SkyboxManifest,
} from "@/runtime/index";

export { DEFAULT_BAKE_WIDTH };

export type BakedGradientImage = BakedSkyboxImageData;

export function bakeSkyboxManifestData(
  manifest: SkyboxManifest,
  options: { width?: number } = {}
): BakedGradientImage {
  return bakeSkyboxImageData(manifest, options);
}

export function bakeDirectionSpaceGradientData(
  gradient: GradientState,
  options: { width?: number } = {}
): BakedGradientImage {
  return bakeSkyboxManifestData(
    {
      composition: { mode: "alpha-over", order: "bottom-to-top" },
      layers: [
        {
          blendMode: "normal",
          enabled: true,
          id: "gradient",
          name: "Gradient",
          opacity: 100,
          params: gradient,
          type: "gradient",
        },
      ],
      version: 1,
    },
    options
  );
}

export function drawBakedGradientToCanvas(
  canvas: HTMLCanvasElement,
  bakedImage: BakedGradientImage
) {
  const context = canvas.getContext("2d");

  canvas.width = bakedImage.width;
  canvas.height = bakedImage.height;

  if (!context) {
    return;
  }

  context.putImageData(
    new ImageData(bakedImage.data, bakedImage.width, bakedImage.height),
    0,
    0
  );
}
