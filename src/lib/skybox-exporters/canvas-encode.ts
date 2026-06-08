import type { SkyboxExportSource } from "./types";

/**
 * Shared LDR encoder for the canvas-based formats (PNG/JPEG/WebP). Draws the read-back RGBA bytes
 * into a 2D canvas and encodes via `toBlob`. No Y-flip: the GPU readback is already top-down.
 */
export function encodeLdrCanvasBlob(
  source: SkyboxExportSource,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    if (source.kind !== "ldr") {
      reject(new Error("This format expects LDR pixel data."));
      return;
    }

    const { data, height, width } = source;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("Export image could not be created."));
      return;
    }

    canvas.width = width;
    canvas.height = height;
    context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error(`Could not encode ${mimeType} image.`));
      },
      mimeType,
      quality
    );
  });
}
