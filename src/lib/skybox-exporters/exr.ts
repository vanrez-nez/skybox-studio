import { HalfFloatType } from "three";
import { EXRExporter } from "three/addons/exporters/EXRExporter.js";

import type { SkyboxImageExporter } from "./types";

const exporter = new EXRExporter();

export const exrExporter: SkyboxImageExporter = {
  extension: "exr",
  hdr: true,
  id: "exr",
  label: "EXR (HDR)",
  encode: async (source) => {
    if (source.kind !== "hdr") {
      throw new Error("EXR export expects an HDR float render target.");
    }

    // three 0.184's EXRExporter accepts (renderer, renderTarget, options) for WebGLRenderer or
    // WebGPURenderer; the float render target carries the linear HDR pixels.
    const bytes = await exporter.parse(source.renderer as never, source.renderTarget as never, {
      type: HalfFloatType,
    });

    return new Blob([bytes], { type: "image/x-exr" });
  },
};
