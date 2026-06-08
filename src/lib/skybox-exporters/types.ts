import type * as THREE from "three";

/**
 * The pixel source handed to an exporter. LDR formats (PNG/JPEG/WebP) encode from the read-back
 * 8-bit RGBA bytes; HDR (EXR) encodes straight from a linear float render target via the renderer.
 */
export type SkyboxExportSource =
  | { kind: "ldr"; data: Uint8ClampedArray; height: number; width: number }
  | { kind: "hdr"; renderer: unknown; renderTarget: THREE.RenderTarget };

export type SkyboxExportQuality = {
  default: number;
  max: number;
  min: number;
  step: number;
};

export type SkyboxExportOptions = {
  /** 0..1 quality for lossy formats (JPEG/WebP). Ignored by others. */
  quality?: number;
};

/**
 * A self-contained "baker extension" for one output format. New formats register one of these and
 * never touch the export dialog core. `hdr` decides which `SkyboxExportSource` kind it receives.
 */
export type SkyboxImageExporter = {
  /** File extension without the dot, e.g. "png", "jpg", "webp", "exr". */
  extension: string;
  /** True → needs a linear float render target (HDR). False → 8-bit RGBA bytes (LDR). */
  hdr: boolean;
  /** Stable id used as the select value, e.g. "png". */
  id: string;
  /** Human label for the format dropdown. */
  label: string;
  /** Quality controls for lossy formats; omit for lossless/HDR. */
  quality?: SkyboxExportQuality;
  encode(source: SkyboxExportSource, options?: SkyboxExportOptions): Promise<Blob>;
};
