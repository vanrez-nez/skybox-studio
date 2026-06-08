import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";

import { Button } from "@/components/ui/primitives/button";
import { DialogClose, DialogFooter } from "@/components/ui/primitives/dialog";
import { FieldGroup } from "@/components/ui/primitives/field-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { Slider } from "@/components/ui/primitives/slider";
import { ImagePreview } from "@/components/ui/composables/image-preview";
import {
  Point2Input,
  type LockPair,
  type Point2Value,
  type PointInputChangeOptions,
} from "@/components/ui/composables/point-input";
import { createSkyboxManifest } from "@/effects/skybox-manifest";
import {
  disposeSkyboxImageTextures,
  loadSkyboxImageTextures,
} from "@/lib/skybox-image-textures";
import {
  DEFAULT_EXPORTER_ID,
  getSkyboxExporter,
  listSkyboxExporters,
} from "@/lib/skybox-exporters";
import type { TextureBakeWorkerResponse } from "@/processes/texture-baking.worker";
import {
  createSkyboxGpuBakeService,
  createStarfieldGpuBakeService,
  migrateManifestToV2,
  type BakedSkyboxImageData,
  type SkyboxGpuBakeService,
  type SkyboxManifest,
  type SkyboxManifestNode,
  type SkyboxStarfieldQuality,
  type StarfieldGpuBakeService,
} from "@/runtime/index";
import { useWorkspaceStore } from "@/store/app";

const MIN_EXPORT_WIDTH = 256;
const MAX_EXPORT_WIDTH = 8192;
const MIN_EXPORT_HEIGHT = 128;
const MAX_EXPORT_HEIGHT = 4096;
const DIMENSIONS_LOCK_PAIR: LockPair = ["x", "y"];
// Image export flattens the starfield to a static texture, so the quality setting (a runtime memory
// budget) no longer applies — always bake at the highest quality for the sharpest result.
const IMAGE_EXPORT_STARFIELD_QUALITY: SkyboxStarfieldQuality = "high";

type ExportPreset = {
  height: number;
  label: string;
  value: string;
  width: number;
};

const EXPORT_PRESETS: ExportPreset[] = [
  { height: 960, label: "1080p · 1920×960", value: "1080p", width: 1920 },
  { height: 1024, label: "2K · 2048×1024", value: "2K", width: 2048 },
  { height: 2048, label: "4K · 4096×2048", value: "4K", width: 4096 },
  { height: 4096, label: "8K · 8192×4096", value: "8K", width: 8192 },
];
const DEFAULT_PRESET = EXPORT_PRESETS[1];
const CUSTOM_PRESET_VALUE = "custom";

type BakeStatus = "idle" | "loading" | "ready" | "error";

function clampWidth(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PRESET.width;
  }

  return Math.min(MAX_EXPORT_WIDTH, Math.max(MIN_EXPORT_WIDTH, Math.round(value)));
}

function clampHeight(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PRESET.height;
  }

  return Math.min(MAX_EXPORT_HEIGHT, Math.max(MIN_EXPORT_HEIGHT, Math.round(value)));
}

function matchPresetValue(width: number, height: number) {
  const preset = EXPORT_PRESETS.find((entry) => entry.width === width && entry.height === height);

  return preset?.value ?? CUSTOM_PRESET_VALUE;
}

function isDimensionsLocked(lockedPairs: LockPair[]) {
  return lockedPairs.some((pair) => pair[0] === "x" && pair[1] === "y");
}

function formatExportTimestamp(date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

// The CPU worker bake produces bottom-up rows (legacy convention); flip to top-down so the stored
// bytes match the GPU readback and the canvas exporters (which never flip).
function flipRowsTopDown(data: Uint8ClampedArray, width: number, height: number) {
  const flipped = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * width * 4;
    const targetOffset = (height - y - 1) * width * 4;

    flipped.set(data.subarray(sourceOffset, sourceOffset + width * 4), targetOffset);
  }

  return flipped;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function collectStarfieldLayers(
  nodes: SkyboxManifestNode[],
  layers: Extract<SkyboxManifestNode, { type: "starfield" }>[] = []
) {
  nodes.forEach((node) => {
    if (!node.enabled) {
      return;
    }

    if (node.type === "group") {
      collectStarfieldLayers(node.children, layers);
      return;
    }

    if (node.type === "starfield") {
      layers.push(node);
    }
  });

  return layers;
}

type GpuBakeContext = {
  renderer: THREE.WebGPURenderer;
  skyboxService: SkyboxGpuBakeService;
  starfieldService: StarfieldGpuBakeService;
};

type LdrBake = { data: Uint8ClampedArray; height: number; width: number };

const EXPORTERS = listSkyboxExporters();

function defaultExporterSelects(formatId: string): Record<string, string> {
  return Object.fromEntries(
    (getSkyboxExporter(formatId)?.selects ?? []).map((select) => [select.id, select.default])
  );
}

export function BakePreview() {
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<BakeStatus>("idle");
  const [dimensions, setDimensions] = useState({
    height: DEFAULT_PRESET.height,
    width: DEFAULT_PRESET.width,
  });
  const [lockedPairs, setLockedPairs] = useState<LockPair[]>([DIMENSIONS_LOCK_PAIR]);
  const [preset, setPreset] = useState(DEFAULT_PRESET.value);
  const [format, setFormat] = useState(DEFAULT_EXPORTER_ID);
  const [quality, setQuality] = useState(1);
  const [exporterSelects, setExporterSelects] = useState<Record<string, string>>(() =>
    defaultExporterSelects(DEFAULT_EXPORTER_ID)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [gpuReady, setGpuReady] = useState(true);
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const gpuRef = useRef<GpuBakeContext | null>(null);
  const bakedRef = useRef<LdrBake | null>(null);
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const exportWidth = clampWidth(dimensions.width);
  const exportHeight = clampHeight(dimensions.height);
  const manifest = useMemo(
    () => createSkyboxManifest(effectLayers, null, { type: skyGeometryType }),
    [effectLayers, skyGeometryType]
  );
  const currentExporter = getSkyboxExporter(format);

  const clearPreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const applyPreviewBlob = (blob: Blob) => {
    clearPreviewUrl();
    const nextPreviewUrl = URL.createObjectURL(blob);

    previewUrlRef.current = nextPreviewUrl;
    setError("");
    setPreviewUrl(nextPreviewUrl);
    setStatus("ready");
  };

  const failPreview = (message: string) => {
    clearPreviewUrl();
    bakedRef.current = null;
    setPreviewUrl(null);
    setError(message);
    setStatus("error");
  };

  // Encode the canonical (top-down) baked bytes to an SDR PNG for on-screen preview, regardless of
  // the selected output format (EXR can't be shown in an <img>). Reuses the PNG baker extension.
  const encodePreview = (baked: LdrBake) => {
    const pngExporter = getSkyboxExporter(DEFAULT_EXPORTER_ID);

    if (!pngExporter) {
      return Promise.reject(new Error("PNG exporter is not registered."));
    }

    return pngExporter.encode({
      data: baked.data,
      height: baked.height,
      kind: "ldr",
      width: baked.width,
    });
  };

  // Lazily create a single WebGPU renderer + bake services and reuse them across every bake.
  // The starfield service caches per (params, width), and re-init of the renderer is the dominant
  // cost, so persisting both keeps re-bakes (preset switches) cheap.
  const ensureGpuContext = async (): Promise<GpuBakeContext> => {
    if (gpuRef.current) {
      return gpuRef.current;
    }

    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGPURenderer({ alpha: true, antialias: false, canvas });

    await renderer.init();

    const starfieldService = createStarfieldGpuBakeService(renderer);
    const skyboxService = createSkyboxGpuBakeService(renderer);

    if (!starfieldService || !skyboxService) {
      renderer.dispose();
      throw new Error("GPU skybox export bake is not available.");
    }

    gpuRef.current = { renderer, skyboxService, starfieldService };

    return gpuRef.current;
  };

  // Bake every enabled starfield layer to a full-equirect texture at export width. The composition
  // bake samples these as plain textures (`getStarfieldTexture`), so we hand back the service's
  // cached textures directly — they must NOT be disposed here (the service owns them).
  //
  // Image export always bakes starfields at the highest quality regardless of the layer's selected
  // quality: that setting only governs the procedural runtime's memory budget, which is irrelevant
  // once the field is flattened to a static texture here.
  const bakeStarfieldTextures = (
    starfieldService: StarfieldGpuBakeService,
    bakeManifest: SkyboxManifest,
    width: number
  ) => {
    const starfieldLayers = collectStarfieldLayers(migrateManifestToV2(bakeManifest).nodes);
    const textures = new Map<string, THREE.Texture>();

    starfieldLayers.forEach((layer) => {
      const params = { ...layer.params, quality: IMAGE_EXPORT_STARFIELD_QUALITY };
      const key = starfieldService.createBakeKey(params, width);
      const texture = starfieldService.bakeTexture(params, key, width);

      textures.set(layer.id, texture);
    });

    return textures;
  };

  // Single-pass GPU composition bake → top-down RGBA bytes. Throws if WebGPU is unavailable so the
  // caller can fall back to the CPU worker.
  const runGpuBake = async (
    bakeManifest: SkyboxManifest,
    width: number,
    height: number
  ): Promise<BakedSkyboxImageData> => {
    const { skyboxService, starfieldService } = await ensureGpuContext();
    const starfieldTextures = bakeStarfieldTextures(starfieldService, bakeManifest, width);
    const imageTextures = await loadSkyboxImageTextures(bakeManifest);

    try {
      return await skyboxService.bakeImageData(bakeManifest, {
        height,
        imageTextures,
        starfieldTextures,
        width,
      });
    } finally {
      disposeSkyboxImageTextures(imageTextures);
    }
  };

  useEffect(() => {
    const worker = new Worker(
      new URL("../../../processes/texture-baking.worker.ts", import.meta.url),
      { type: "module" }
    );

    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<TextureBakeWorkerResponse>) => {
      const response = event.data;

      if (response.id !== requestIdRef.current) {
        return;
      }

      if (response.error || !response.data || !response.width || !response.height) {
        failPreview(response.error ?? "Skybox export failed.");
        return;
      }

      const baked: LdrBake = {
        data: flipRowsTopDown(new Uint8ClampedArray(response.data), response.width, response.height),
        height: response.height,
        width: response.width,
      };

      bakedRef.current = baked;
      void encodePreview(baked)
        .then((blob) => {
          if (response.id !== requestIdRef.current) {
            return;
          }

          applyPreviewBlob(blob);
        })
        .catch((nextError: unknown) => {
          if (response.id !== requestIdRef.current) {
            return;
          }

          failPreview(nextError instanceof Error ? nextError.message : "Preview encode failed.");
        });
    };
    worker.onerror = () => {
      failPreview("Skybox export worker failed.");
    };

    return () => {
      requestIdRef.current += 1;
      worker.terminate();
      workerRef.current = null;
      clearPreviewUrl();

      if (gpuRef.current) {
        gpuRef.current.skyboxService.dispose();
        gpuRef.current.starfieldService.dispose();
        gpuRef.current.renderer.dispose();
        gpuRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const id = requestIdRef.current + 1;

      requestIdRef.current = id;
      clearPreviewUrl();
      bakedRef.current = null;
      setError("");
      setPreviewUrl(null);
      setStatus("loading");

      void (async () => {
        try {
          const baked = await runGpuBake(manifest, exportWidth, exportHeight);

          if (id !== requestIdRef.current) {
            return;
          }

          setGpuReady(true);
          bakedRef.current = baked;
          const blob = await encodePreview(baked);

          if (id !== requestIdRef.current) {
            return;
          }

          applyPreviewBlob(blob);
        } catch {
          // GPU unavailable or failed — fall back to the CPU worker bake (which CPU-bakes
          // starfield itself when no GPU bakes are supplied). EXR export needs WebGPU, so disable it.
          if (id !== requestIdRef.current) {
            return;
          }

          setGpuReady(false);

          const worker = workerRef.current;

          if (!worker) {
            failPreview("Skybox export failed.");
            return;
          }

          worker.postMessage({ height: exportHeight, id, manifest, width: exportWidth }, []);
        }
      })();
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [exportWidth, exportHeight, manifest]);

  function applyDimensions(width: number, height: number) {
    const nextWidth = clampWidth(width);
    const nextHeight = clampHeight(height);

    setDimensions({ height: nextHeight, width: nextWidth });
    setPreset(matchPresetValue(nextWidth, nextHeight));
  }

  function handleDimensionsChange(next: Point2Value, options?: PointInputChangeOptions) {
    if (isDimensionsLocked(lockedPairs)) {
      if (options?.sourceAxis === "y") {
        const nextWidth = clampWidth(clampHeight(next.y) * 2);

        applyDimensions(nextWidth, Math.round(nextWidth / 2));
        return;
      }

      const nextWidth = clampWidth(next.x);

      applyDimensions(nextWidth, Math.round(nextWidth / 2));
      return;
    }

    applyDimensions(next.x, next.y);
  }

  function handlePresetChange(value: string) {
    if (value === CUSTOM_PRESET_VALUE) {
      return;
    }

    const nextPreset = EXPORT_PRESETS.find((entry) => entry.value === value);

    if (!nextPreset) {
      return;
    }

    setLockedPairs([DIMENSIONS_LOCK_PAIR]);
    setDimensions({ height: nextPreset.height, width: nextPreset.width });
    setPreset(nextPreset.value);
  }

  function handleFormatChange(value: string) {
    setFormat(value);
    setQuality(getSkyboxExporter(value)?.quality?.default ?? 1);
    setExporterSelects(defaultExporterSelects(value));
  }

  async function handleSave() {
    const exporter = currentExporter;

    if (!exporter || status !== "ready") {
      return;
    }

    setError("");

    try {
      if (exporter.hdr) {
        const gpu = gpuRef.current;

        if (!gpu) {
          throw new Error("EXR export requires WebGPU.");
        }

        const starfieldTextures = bakeStarfieldTextures(gpu.starfieldService, manifest, exportWidth);
        const imageTextures = await loadSkyboxImageTextures(manifest);

        setIsSaving(true);

        try {
          // The exporter decides the target precision (half/full) from its own options and disposes
          // the target it requests. We just supply the bake closure + texture inputs.
          const blob = await exporter.encode(
            {
              kind: "hdr",
              renderer: gpu.renderer,
              createTarget: ({ float }) =>
                gpu.skyboxService.bakeRenderTarget(manifest, {
                  // EXRExporter flips scanlines unconditionally (assumes WebGL bottom-up readback);
                  // our WebGPU readback is top-down, so pre-flip here to keep the EXR upright.
                  flipY: true,
                  float,
                  hdr: true,
                  height: exportHeight,
                  imageTextures,
                  starfieldTextures,
                  width: exportWidth,
                }),
            },
            { selects: exporterSelects }
          );

          downloadBlob(blob, `skybox-studio-${formatExportTimestamp()}.${exporter.extension}`);
        } finally {
          disposeSkyboxImageTextures(imageTextures);
          setIsSaving(false);
        }

        return;
      }

      const baked = bakedRef.current;

      if (!baked) {
        return;
      }

      const blob = await exporter.encode(
        { data: baked.data, height: baked.height, kind: "ldr", width: baked.width },
        { quality }
      );

      downloadBlob(blob, `skybox-studio-${formatExportTimestamp()}.${exporter.extension}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Export failed.");
    }
  }

  const exrUnavailable = Boolean(currentExporter?.hdr) && !gpuReady;
  const canSave = status === "ready" && !isSaving && !exrUnavailable;

  return (
    <div className="flex min-w-[min(860px,calc(100vw-4rem))] flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-start">
        <div className="flex w-full flex-col gap-4 sm:w-64 sm:shrink-0">
      <FieldGroup contentClassName="flex flex-col gap-2" label="Resolution">
        <Select onValueChange={handlePresetChange} value={preset}>
          <SelectTrigger
            aria-label="Export resolution preset"
            className="w-full bg-background text-xs"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPORT_PRESETS.map((entry) => (
              <SelectItem className="text-xs" key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
            {preset === CUSTOM_PRESET_VALUE ? (
              <SelectItem className="text-xs" value={CUSTOM_PRESET_VALUE}>
                Custom · {exportWidth}×{exportHeight}
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>

        <Point2Input
          fields={{
            x: { label: "W", max: MAX_EXPORT_WIDTH, min: MIN_EXPORT_WIDTH, step: 2 },
            y: { label: "H", max: MAX_EXPORT_HEIGHT, min: MIN_EXPORT_HEIGHT, step: 1 },
          }}
          formatValue={(value) => String(Math.round(value))}
          label="Size"
          layout="vertical"
          locks={[{ defaultLocked: true, optional: true, pair: DIMENSIONS_LOCK_PAIR }]}
          lockedPairs={lockedPairs}
          onLockedPairsChange={setLockedPairs}
          onValueChange={handleDimensionsChange}
          value={{ x: exportWidth, y: exportHeight }}
        />
      </FieldGroup>

      <FieldGroup contentClassName="flex flex-col gap-2" label="Format">
        <Select onValueChange={handleFormatChange} value={format}>
          <SelectTrigger aria-label="Export format" className="w-full bg-background text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPORTERS.map((exporter) => (
              <SelectItem
                className="text-xs"
                disabled={exporter.hdr && !gpuReady}
                key={exporter.id}
                value={exporter.id}
              >
                {exporter.label}
                {exporter.hdr && !gpuReady ? " · needs WebGPU" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentExporter?.quality ? (
          <div className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-xs text-muted-foreground">Quality</span>
            <Slider
              aria-label="Export quality"
              className="flex-1"
              max={currentExporter.quality.max}
              min={currentExporter.quality.min}
              onValueChange={([value]) => setQuality(value)}
              step={currentExporter.quality.step}
              value={[quality]}
            />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(quality * 100)}%
            </span>
          </div>
        ) : null}

        {currentExporter?.selects?.map((select) => (
          <div className="flex items-center gap-3" key={select.id}>
            <span className="w-20 shrink-0 text-xs text-muted-foreground">{select.label}</span>
            <Select
              onValueChange={(value) =>
                setExporterSelects((current) => ({ ...current, [select.id]: value }))
              }
              value={exporterSelects[select.id] ?? select.default}
            >
              <SelectTrigger
                aria-label={`EXR ${select.label}`}
                className="flex-1 bg-background text-xs"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {select.options.map((option) => (
                  <SelectItem className="text-xs" key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        {currentExporter?.hdr ? (
          <span className="text-[0.6875rem] text-muted-foreground">
            HDR · linear float. Preview shown in SDR.
          </span>
        ) : null}
      </FieldGroup>
        </div>

        <ImagePreview
          alt="Baked skybox export preview"
          className="aspect-[2/1] max-h-[55vh] min-h-48 w-full sm:w-auto sm:flex-1"
          emptyState={<span className="text-xs text-muted-foreground">No preview</span>}
          naturalHeight={exportHeight}
          naturalWidth={exportWidth}
          src={previewUrl}
          status={status === "loading" ? "loading" : "ready"}
        />
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={!canSave} onClick={() => void handleSave()} type="button">
          {isSaving ? "Saving…" : `Save ${currentExporter?.extension.toUpperCase() ?? ""}`.trim()}
        </Button>
      </DialogFooter>
    </div>
  );
}
