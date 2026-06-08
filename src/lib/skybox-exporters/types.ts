import type { SkyboxGpuBakeTarget } from "@/runtime/index";

/**
 * The pixel source handed to an exporter. LDR formats (PNG/JPEG/WebP) encode from the read-back
 * 8-bit RGBA bytes; HDR (EXR) bakes a linear float render target on demand — the exporter requests
 * the precision it needs (`float` → 32-bit, else 16-bit half) and owns disposing the target.
 */
export type SkyboxExportSource =
  | { kind: "ldr"; data: Uint8ClampedArray; height: number; width: number }
  | {
      kind: "hdr";
      renderer: unknown;
      createTarget: (options: { float: boolean }) => SkyboxGpuBakeTarget;
    };

export type SkyboxExportQuality = {
  default: number;
  max: number;
  min: number;
  step: number;
};

export type SkyboxExportSelectOption = { label: string; value: string };

/** A dropdown control a format exposes (e.g. EXR compression / data type), rendered generically. */
export type SkyboxExportSelect = {
  default: string;
  id: string;
  label: string;
  options: SkyboxExportSelectOption[];
};

export type SkyboxExportOptions = {
  /** 0..1 quality for lossy formats (JPEG/WebP). Ignored by others. */
  quality?: number;
  /** Selected values for the exporter's `selects`, keyed by select id. */
  selects?: Record<string, string>;
};

/**
 * A self-contained "baker extension" for one output format. New formats register one of these and
 * never touch the export dialog core. `hdr` decides which `SkyboxExportSource` kind it receives.
 */
export type SkyboxImageExporter = {
  /** File extension without the dot, e.g. "png", "jpg", "webp", "exr". */
  extension: string;
  /** True → bakes a linear float render target (HDR). False → 8-bit RGBA bytes (LDR). */
  hdr: boolean;
  /** Stable id used as the select value, e.g. "png". */
  id: string;
  /** Human label for the format dropdown. */
  label: string;
  /** Quality controls for lossy formats; omit for lossless/HDR. */
  quality?: SkyboxExportQuality;
  /** Extra dropdown controls (e.g. EXR compression / data type); rendered generically by the UI. */
  selects?: SkyboxExportSelect[];
  encode(source: SkyboxExportSource, options?: SkyboxExportOptions): Promise<Blob>;
};
