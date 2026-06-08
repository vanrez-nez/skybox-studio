import { encodeLdrCanvasBlob } from "./canvas-encode";
import type { SkyboxImageExporter } from "./types";

export const jpegExporter: SkyboxImageExporter = {
  extension: "jpg",
  hdr: false,
  id: "jpeg",
  label: "JPEG",
  quality: { default: 0.92, max: 1, min: 0.1, step: 0.01 },
  encode: (source, options) => encodeLdrCanvasBlob(source, "image/jpeg", options?.quality),
};
