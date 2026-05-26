import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSkyboxManifest } from "@/effects/skybox-manifest";
import type { TextureBakeWorkerResponse } from "@/processes/texture-baking.worker";
import { useWorkspaceStore } from "@/store/app";

const DEFAULT_EXPORT_WIDTH = 2048;
const MIN_EXPORT_WIDTH = 256;
const MAX_EXPORT_WIDTH = 8192;

type BakeStatus = "idle" | "loading" | "ready" | "error";

function clampExportWidth(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_EXPORT_WIDTH;
  }

  return Math.min(MAX_EXPORT_WIDTH, Math.max(MIN_EXPORT_WIDTH, Math.round(value)));
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

function encodeImageDataAsPng(data: ArrayBuffer, width: number, height: number) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const sourceData = new Uint8ClampedArray(data);
    const flippedData = new Uint8ClampedArray(sourceData.length);

    if (!context) {
      reject(new Error("Export preview could not be created."));
      return;
    }

    for (let y = 0; y < height; y += 1) {
      const sourceOffset = y * width * 4;
      const targetOffset = (height - y - 1) * width * 4;

      flippedData.set(sourceData.subarray(sourceOffset, sourceOffset + width * 4), targetOffset);
    }

    canvas.width = width;
    canvas.height = height;
    context.putImageData(new ImageData(flippedData, width, height), 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("PNG export could not be created."));
    }, "image/png");
  });
}

export function BakePreview() {
  const [error, setError] = useState("");
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<BakeStatus>("idle");
  const [widthInput, setWidthInput] = useState(String(DEFAULT_EXPORT_WIDTH));
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const exportWidth = clampExportWidth(Number.parseInt(widthInput, 10));
  const exportHeight = Math.floor(exportWidth / 2);
  const manifest = useMemo(
    () => createSkyboxManifest(effectLayers, null, { type: skyGeometryType }),
    [effectLayers, skyGeometryType]
  );

  const clearPreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  useEffect(() => {
    const worker = new Worker(
      new URL("../../processes/texture-baking.worker.ts", import.meta.url),
      { type: "module" }
    );

    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<TextureBakeWorkerResponse>) => {
      const response = event.data;

      if (response.id !== requestIdRef.current) {
        return;
      }

      if (response.error || !response.data || !response.width || !response.height) {
        clearPreviewUrl();
        setPngBlob(null);
        setPreviewUrl(null);
        setError(response.error ?? "Skybox export failed.");
        setStatus("error");
        return;
      }

      void encodeImageDataAsPng(response.data, response.width, response.height)
        .then((blob) => {
          if (response.id !== requestIdRef.current) {
            return;
          }

          clearPreviewUrl();
          const nextPreviewUrl = URL.createObjectURL(blob);

          previewUrlRef.current = nextPreviewUrl;
          setError("");
          setPngBlob(blob);
          setPreviewUrl(nextPreviewUrl);
          setStatus("ready");
        })
        .catch((nextError: unknown) => {
          if (response.id !== requestIdRef.current) {
            return;
          }

          clearPreviewUrl();
          setPngBlob(null);
          setPreviewUrl(null);
          setError(nextError instanceof Error ? nextError.message : "PNG export failed.");
          setStatus("error");
        });
    };
    worker.onerror = () => {
      clearPreviewUrl();
      setPngBlob(null);
      setPreviewUrl(null);
      setError("Skybox export worker failed.");
      setStatus("error");
    };

    return () => {
      requestIdRef.current += 1;
      worker.terminate();
      workerRef.current = null;
      clearPreviewUrl();
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;

    if (!worker) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const id = requestIdRef.current + 1;

      requestIdRef.current = id;
      clearPreviewUrl();
      setError("");
      setPngBlob(null);
      setPreviewUrl(null);
      setStatus("loading");
      worker.postMessage({
        id,
        manifest,
        width: exportWidth,
      });
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [exportWidth, manifest]);

  function handleSave() {
    if (!pngBlob) {
      return;
    }

    const url = URL.createObjectURL(pngBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `skybox-studio-${formatExportTimestamp()}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="flex min-w-[min(720px,calc(100vw-4rem))] flex-col gap-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="export-width">
          Width
        </label>
        <Input
          className="h-8 w-28 text-xs"
          id="export-width"
          inputMode="numeric"
          max={MAX_EXPORT_WIDTH}
          min={MIN_EXPORT_WIDTH}
          onBlur={() => setWidthInput(String(exportWidth))}
          onChange={(event) => setWidthInput(event.target.value)}
          type="number"
          value={widthInput}
        />
        <span className="text-xs text-muted-foreground">Height {exportHeight}</span>
      </div>

      <div className="transparent-checker flex aspect-[2/1] max-h-[55vh] min-h-48 items-center justify-center overflow-hidden rounded-md border">
        {status === "loading" ? (
          <Loader2 className="animate-spin text-muted-foreground" />
        ) : previewUrl ? (
          <img
            alt="Baked skybox export preview"
            className="size-full object-contain"
            src={previewUrl}
          />
        ) : (
          <span className="text-xs text-muted-foreground">No preview</span>
        )}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button disabled={!pngBlob || status !== "ready"} onClick={handleSave} type="button">
          Save
        </Button>
      </div>
    </div>
  );
}
