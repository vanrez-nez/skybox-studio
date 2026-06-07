// Loads an editor-produced project bundle (manifest.json + assets/<hash>.png).
// Works from a served URL (the bundled sample) or a picked directory (an unzipped
// export). Resolves image-asset URLs by layer and can rehydrate image pixels for
// the CPU baked path.
import {
  migrateManifestToV2,
  type SkyboxManifestLayer,
  type SkyboxManifestNode,
  type SkyboxManifestV2,
} from "skybox-studio-runtime";

export type ImageManifestLayer = Extract<SkyboxManifestLayer, { type: "image" }>;

export type Bundle = {
  manifest: SkyboxManifestV2;
  resolveAssetUrl: (src: string) => string;
};

export function collectImageLayers(manifest: SkyboxManifestV2): ImageManifestLayer[] {
  const layers: ImageManifestLayer[] = [];

  const walk = (nodes: SkyboxManifestNode[]) => {
    for (const node of nodes) {
      if (node.type === "group") {
        walk(node.children);
      } else if (node.type === "image") {
        layers.push(node);
      }
    }
  };

  walk(manifest.nodes);

  return layers;
}

export async function loadBundleFromUrl(baseUrl: string): Promise<Bundle> {
  const response = await fetch(new URL("manifest.json", baseUrl).href);

  if (!response.ok) {
    throw new Error(`Could not load manifest.json (${response.status}).`);
  }

  const manifest = migrateManifestToV2(await response.json());

  return { manifest, resolveAssetUrl: (src) => new URL(src, baseUrl).href };
}

type DirectoryHandle = {
  getFileHandle: (name: string) => Promise<{ getFile: () => Promise<File> }>;
  getDirectoryHandle: (name: string) => Promise<DirectoryHandle>;
};

async function readDirectoryFileUrl(dir: DirectoryHandle, path: string): Promise<string> {
  const segments = path.split("/").filter(Boolean);
  let handle: DirectoryHandle = dir;

  for (let index = 0; index < segments.length - 1; index += 1) {
    handle = await handle.getDirectoryHandle(segments[index]);
  }

  const fileHandle = await handle.getFileHandle(segments[segments.length - 1]);

  return URL.createObjectURL(await fileHandle.getFile());
}

export async function loadBundleFromDirectory(dir: DirectoryHandle): Promise<Bundle> {
  const manifestFile = await (await dir.getFileHandle("manifest.json")).getFile();
  const manifest = migrateManifestToV2(JSON.parse(await manifestFile.text()));
  const urls = new Map<string, string>();

  for (const layer of collectImageLayers(manifest)) {
    if (layer.params.src) {
      urls.set(layer.params.src, await readDirectoryFileUrl(dir, layer.params.src));
    }
  }

  return { manifest, resolveAssetUrl: (src) => urls.get(src) ?? src };
}

// CPU baking samples image layers from `pixels`, so decode each referenced PNG
// back into the manifest before baking.
export async function rehydrateImagePixels(bundle: Bundle): Promise<SkyboxManifestV2> {
  const manifest = structuredClone(bundle.manifest);

  for (const layer of collectImageLayers(manifest)) {
    if (!layer.params.src) {
      continue;
    }

    const blob = await (await fetch(bundle.resolveAssetUrl(layer.params.src))).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      continue;
    }

    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    layer.params.pixels = Array.from(
      context.getImageData(0, 0, canvas.width, canvas.height).data
    );
    layer.params.width = canvas.width;
    layer.params.height = canvas.height;
  }

  return manifest;
}
