import * as THREE from "three";

import {
  migrateManifestToV2,
  type SkyboxManifest,
  type SkyboxManifestNode,
} from "@/runtime/index";

type ImageLayerParams = {
  height?: number;
  pixels?: number[] | null;
  src?: string | null;
  width?: number;
};

/**
 * Shared texture configuration for skybox image layers — kept in one place so the live viewport
 * (ThreeWorkspaceScene) and the offscreen export bake produce identical sampling.
 */
export function configureSkyboxImageTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
}

function collectImageLayers(
  nodes: SkyboxManifestNode[],
  layers: Extract<SkyboxManifestNode, { type: "image" }>[] = []
) {
  nodes.forEach((node) => {
    if (!node.enabled) {
      return;
    }

    if (node.type === "group") {
      collectImageLayers(node.children, layers);
      return;
    }

    if (node.type === "image") {
      layers.push(node);
    }
  });

  return layers;
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();

    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Image layer could not be loaded for export bake."))
    );
    image.src = src;
  });
}

function createTextureFromPixels(params: ImageLayerParams) {
  if (!params.pixels || !params.width || !params.height) {
    return null;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  canvas.width = params.width;
  canvas.height = params.height;
  context.putImageData(
    new ImageData(new Uint8ClampedArray(params.pixels), params.width, params.height),
    0,
    0
  );

  return new THREE.CanvasTexture(canvas);
}

/**
 * Builds a `layerId -> THREE.Texture` map for every enabled image layer in the manifest, ready to
 * feed into the GPU composition bake. Prefers the layer's `src` (data/blob URL); falls back to raw
 * `pixels`. The caller owns disposal via `disposeSkyboxImageTextures`.
 */
export async function loadSkyboxImageTextures(
  manifest: SkyboxManifest
): Promise<Map<string, THREE.Texture>> {
  const layers = collectImageLayers(migrateManifestToV2(manifest).nodes);
  const textures = new Map<string, THREE.Texture>();

  await Promise.all(
    layers.map(async (layer) => {
      const params = layer.params as ImageLayerParams;
      let texture: THREE.Texture | null = null;

      if (params.src) {
        texture = new THREE.Texture(await loadImageElement(params.src));
      } else {
        texture = createTextureFromPixels(params);
      }

      if (!texture) {
        return;
      }

      configureSkyboxImageTexture(texture);
      textures.set(layer.id, texture);
    })
  );

  return textures;
}

export function disposeSkyboxImageTextures(textures: Map<string, THREE.Texture>) {
  textures.forEach((texture) => texture.dispose());
  textures.clear();
}
