import type { SkyboxImageExporter } from "./types";

const registry = new Map<string, SkyboxImageExporter>();

/** Register (or replace) an export-format baker extension. */
export function registerSkyboxExporter(exporter: SkyboxImageExporter) {
  registry.set(exporter.id, exporter);
}

export function getSkyboxExporter(id: string) {
  return registry.get(id) ?? null;
}

/** All registered exporters, in registration order. */
export function listSkyboxExporters() {
  return [...registry.values()];
}
