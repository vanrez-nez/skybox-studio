import { strToU8, zipSync } from "fflate";

import { createSkyboxManifest } from "@/effects/skybox-manifest";
import type { EffectLayer } from "@/effects/effect-layer";
import type { ImageState } from "@/effects/layers/image/state";
import { getImageAsset } from "@/lib/image-assets";
import type {
  SkyboxManifestLayer,
  SkyboxManifestNode,
  SkyboxManifestV2,
} from "@/runtime/index";
import type { SkyGeometryType } from "@/store/modules/scene";

// A project bundle: a SkyboxManifestV2 whose image layers reference content-hashed
// PNG files under assets/, plus an `assets` index that preserves the editor's
// original asset ids for traceability. Standalone runtime consumers load
// manifest.json and resolve image textures by layer id (ids are preserved as-is).
export type ProjectBundleManifest = SkyboxManifestV2 & {
  assets: Record<string, { mimeType: string; sourceAssetId: string | null }>;
};

// Asset compression formats for the exported image layers. PNG is lossless (quality ignored); JPEG
// and WebP are lossy and honor `quality` (0..1). JPEG has no alpha channel — transparent decals
// composite onto black — so the UI warns before choosing it.
export type BundleAssetFormat = "png" | "jpeg" | "webp";

export type BuildProjectBundleOptions = {
  format?: BundleAssetFormat;
  onProgress?: (completed: number, total: number) => void;
  quality?: number;
  visibleOnly?: boolean;
};

const FORMAT_TO_MIME: Record<BundleAssetFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const FORMAT_TO_EXT: Record<BundleAssetFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};
const DEFAULT_BUNDLE_FORMAT: BundleAssetFormat = "png";

type ImageAssetEntry = {
  bytes: Uint8Array;
  hash: string;
  mimeType: string;
  path: string;
  sourceAssetId: string | null;
};

function formatTimestamp(date = new Date()) {
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

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function canvasToBytes(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Image asset encode failed."));
          return;
        }

        result
          .arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(reject);
      },
      mimeType,
      quality
    );
  });
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Image asset could not be encoded.");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return canvas;
}

function pixelsToCanvas(params: ImageState): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  canvas.width = params.width;
  canvas.height = params.height;

  const context = canvas.getContext("2d");

  if (!context || !params.pixels) {
    throw new Error("Image asset pixels could not be encoded.");
  }

  context.putImageData(
    new ImageData(new Uint8ClampedArray(params.pixels), params.width, params.height),
    0,
    0
  );

  return canvas;
}

// Encode an image layer to the requested format/quality. PNG ignores `quality`; canvas.toBlob
// drops alpha for JPEG. Source priority mirrors the layer's own fallback: stored blob → src → pixels.
async function encodeImageLayerBytes(
  params: ImageState,
  format: BundleAssetFormat,
  quality?: number
): Promise<Uint8Array | null> {
  let canvas: HTMLCanvasElement | null = null;

  if (params.assetId) {
    const blob = await getImageAsset(params.assetId);

    if (blob) {
      canvas = await blobToCanvas(blob);
    }
  }

  if (!canvas && params.src) {
    const response = await fetch(params.src);

    canvas = await blobToCanvas(await response.blob());
  }

  if (!canvas && params.pixels && params.width > 0 && params.height > 0) {
    canvas = pixelsToCanvas(params);
  }

  if (!canvas) {
    return null;
  }

  return canvasToBytes(canvas, FORMAT_TO_MIME[format], quality);
}

async function collectImageAssets(
  effectLayers: EffectLayer[],
  format: BundleAssetFormat,
  quality: number | undefined,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ImageAssetEntry>> {
  const byLayerId = new Map<string, ImageAssetEntry>();
  const byHash = new Map<string, ImageAssetEntry>();
  const imageLayers = effectLayers.filter((layer) => layer.type === "image");
  const extension = FORMAT_TO_EXT[format];
  const mimeType = FORMAT_TO_MIME[format];
  let completed = 0;

  for (const layer of imageLayers) {
    const params = layer.params as ImageState;
    const bytes = await encodeImageLayerBytes(params, format, quality);

    completed += 1;
    onProgress?.(completed, imageLayers.length);

    if (!bytes) {
      continue;
    }

    const hash = await sha256Hex(bytes);
    const existing = byHash.get(hash);
    const entry: ImageAssetEntry =
      existing ??
      {
        bytes,
        hash,
        mimeType,
        path: `assets/${hash}.${extension}`,
        sourceAssetId: params.assetId,
      };

    byHash.set(hash, entry);
    byLayerId.set(layer.id, entry);
  }

  return byLayerId;
}

function rewriteImageNode(
  node: SkyboxManifestLayer,
  assetsByLayerId: Map<string, ImageAssetEntry>
): SkyboxManifestLayer {
  if (node.type !== "image") {
    return node;
  }

  const entry = assetsByLayerId.get(node.id);

  return {
    ...node,
    params: {
      ...node.params,
      pixels: null,
      src: entry ? entry.path : null,
    },
  };
}

function rewriteNodes(
  nodes: SkyboxManifestNode[],
  assetsByLayerId: Map<string, ImageAssetEntry>
): SkyboxManifestNode[] {
  return nodes.map((node) => {
    if (node.type === "group") {
      return { ...node, children: rewriteNodes(node.children, assetsByLayerId) };
    }

    return rewriteImageNode(node, assetsByLayerId);
  });
}

export async function buildProjectBundle(
  effectLayers: EffectLayer[],
  skyGeometryType: SkyGeometryType,
  options: BuildProjectBundleOptions = {}
): Promise<{ blob: Blob; fileName: string }> {
  const format = options.format ?? DEFAULT_BUNDLE_FORMAT;
  const layers = options.visibleOnly
    ? effectLayers.filter((layer) => layer.enabled)
    : effectLayers;
  const assetsByLayerId = await collectImageAssets(
    layers,
    format,
    options.quality,
    options.onProgress
  );
  const baseManifest = createSkyboxManifest(layers, null, { type: skyGeometryType });

  const uniqueAssets = new Map<string, ImageAssetEntry>();

  assetsByLayerId.forEach((entry) => uniqueAssets.set(entry.path, entry));

  const assetsIndex: ProjectBundleManifest["assets"] = {};

  uniqueAssets.forEach((entry) => {
    assetsIndex[entry.path] = { mimeType: entry.mimeType, sourceAssetId: entry.sourceAssetId };
  });

  const manifest: ProjectBundleManifest = {
    ...baseManifest,
    assets: assetsIndex,
    nodes: rewriteNodes(baseManifest.nodes, assetsByLayerId),
  };

  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
  };

  uniqueAssets.forEach((entry) => {
    files[entry.path] = entry.bytes;
  });

  options.onProgress?.(1, 1);

  const zipped = zipSync(files);

  return {
    blob: new Blob([zipped as unknown as BlobPart], { type: "application/zip" }),
    fileName: `skybox-studio-${formatTimestamp()}.zip`,
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
