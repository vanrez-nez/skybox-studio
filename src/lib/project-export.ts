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

type ImageAssetEntry = {
  bytes: Uint8Array;
  hash: string;
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

async function blobToPngBytes(blob: Blob): Promise<Uint8Array> {
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

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }

      reject(new Error("Image asset PNG encode failed."));
    }, "image/png");
  });

  return new Uint8Array(await pngBlob.arrayBuffer());
}

function pixelsToPngBytes(params: ImageState): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");

  canvas.width = params.width;
  canvas.height = params.height;

  const context = canvas.getContext("2d");

  if (!context || !params.pixels) {
    return Promise.reject(new Error("Image asset pixels could not be encoded."));
  }

  context.putImageData(
    new ImageData(
      new Uint8ClampedArray(params.pixels),
      params.width,
      params.height
    ),
    0,
    0
  );

  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("Image asset PNG encode failed."));
        return;
      }

      result
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, "image/png");
  });
}

async function readImageLayerPngBytes(params: ImageState): Promise<Uint8Array | null> {
  if (params.assetId) {
    const blob = await getImageAsset(params.assetId);

    if (blob) {
      return blobToPngBytes(blob);
    }
  }

  if (params.src) {
    const response = await fetch(params.src);

    return blobToPngBytes(await response.blob());
  }

  if (params.pixels && params.width > 0 && params.height > 0) {
    return pixelsToPngBytes(params);
  }

  return null;
}

async function collectImageAssets(
  effectLayers: EffectLayer[]
): Promise<Map<string, ImageAssetEntry>> {
  const byLayerId = new Map<string, ImageAssetEntry>();
  const byHash = new Map<string, ImageAssetEntry>();

  for (const layer of effectLayers) {
    if (layer.type !== "image") {
      continue;
    }

    const params = layer.params as ImageState;
    const bytes = await readImageLayerPngBytes(params);

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
        path: `assets/${hash}.png`,
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
  skyGeometryType: SkyGeometryType
): Promise<{ blob: Blob; fileName: string }> {
  const assetsByLayerId = await collectImageAssets(effectLayers);
  const baseManifest = createSkyboxManifest(effectLayers, null, { type: skyGeometryType });

  const uniqueAssets = new Map<string, ImageAssetEntry>();

  assetsByLayerId.forEach((entry) => uniqueAssets.set(entry.path, entry));

  const assetsIndex: ProjectBundleManifest["assets"] = {};

  uniqueAssets.forEach((entry) => {
    assetsIndex[entry.path] = { mimeType: "image/png", sourceAssetId: entry.sourceAssetId };
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
