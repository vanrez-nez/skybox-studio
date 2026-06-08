import { exrExporter } from "./exr";
import { jpegExporter } from "./jpeg";
import { pngExporter } from "./png";
import { registerSkyboxExporter } from "./registry";
import { webpExporter } from "./webp";

// Register built-in export formats (order = dropdown order; first is the default).
registerSkyboxExporter(pngExporter);
registerSkyboxExporter(jpegExporter);
registerSkyboxExporter(webpExporter);
registerSkyboxExporter(exrExporter);

export const DEFAULT_EXPORTER_ID = pngExporter.id;

export { getSkyboxExporter, listSkyboxExporters } from "./registry";
export type {
  SkyboxExportSource,
  SkyboxExportOptions,
  SkyboxImageExporter,
} from "./types";
