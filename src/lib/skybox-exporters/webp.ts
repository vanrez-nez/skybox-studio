import { encodeLdrCanvasBlob } from "./canvas-encode";
import type { SkyboxImageExporter } from "./types";

export const webpExporter: SkyboxImageExporter = {
  extension: "webp",
  hdr: false,
  id: "webp",
  label: "WebP",
  quality: { default: 0.9, max: 1, min: 0.1, step: 0.01 },
  encode: (source, options) => encodeLdrCanvasBlob(source, "image/webp", options?.quality),
};
