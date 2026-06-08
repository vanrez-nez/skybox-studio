import { encodeLdrCanvasBlob } from "./canvas-encode";
import type { SkyboxImageExporter } from "./types";

export const pngExporter: SkyboxImageExporter = {
  extension: "png",
  hdr: false,
  id: "png",
  label: "PNG",
  encode: (source) => encodeLdrCanvasBlob(source, "image/png"),
};
