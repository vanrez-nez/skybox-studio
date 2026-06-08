import { FloatType, HalfFloatType } from "three";
import {
  EXRExporter,
  NO_COMPRESSION,
  ZIP_COMPRESSION,
  ZIPS_COMPRESSION,
} from "three/addons/exporters/EXRExporter.js";

import type { SkyboxImageExporter } from "./types";

const exporter = new EXRExporter();

const COMPRESSION_BY_ID: Record<string, number> = {
  none: NO_COMPRESSION,
  zip: ZIP_COMPRESSION,
  zips: ZIPS_COMPRESSION,
};

export const exrExporter: SkyboxImageExporter = {
  extension: "exr",
  hdr: true,
  id: "exr",
  label: "EXR (HDR)",
  selects: [
    {
      default: "half",
      id: "dataType",
      label: "Data type",
      options: [
        { label: "Half (16-bit)", value: "half" },
        { label: "Full (32-bit)", value: "full" },
      ],
    },
    {
      default: "zip",
      id: "compression",
      label: "Compression",
      options: [
        { label: "ZIP (16-line blocks)", value: "zip" },
        { label: "ZIPS (single scanline)", value: "zips" },
        { label: "None", value: "none" },
      ],
    },
  ],
  encode: async (source, options) => {
    if (source.kind !== "hdr") {
      throw new Error("EXR export expects an HDR render target source.");
    }

    const useFloat = options?.selects?.dataType === "full";
    const compression = COMPRESSION_BY_ID[options?.selects?.compression ?? "zip"] ?? ZIP_COMPRESSION;
    // Bake at the requested precision so "Full" is a true 32-bit render, not an upcast half bake.
    const baked = source.createTarget({ float: useFloat });

    try {
      const bytes = await exporter.parse(source.renderer as never, baked.target as never, {
        compression,
        type: useFloat ? FloatType : HalfFloatType,
      });

      return new Blob([bytes], { type: "image/x-exr" });
    } finally {
      baked.dispose();
    }
  },
};
