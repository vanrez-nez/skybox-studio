import {
  bakeSkyboxImageData,
  migrateManifestToV2,
  type SkyboxImageParams,
  type SkyboxManifest,
  type SkyboxManifestLayer,
  type SkyboxManifestNode,
  type SkyboxManifestV2,
} from "@/runtime/index";
// CPU-baking a starfield needs the starfield CPU sampler registered (it lives in the generation
// entry now). This import wires that side effect; the type comes from the same entry.
import { type StarfieldBakeData } from "@/runtime/starfield";
import "@/runtime/starfield";

export type TextureBakeStarfieldBake = {
  data: ArrayBuffer;
  height: number;
  layerId: string;
  width: number;
};

export type TextureBakeWorkerRequest = {
  height?: number;
  id: number;
  manifest: SkyboxManifest;
  starfieldBakes?: TextureBakeStarfieldBake[];
  width?: number;
};

export type TextureBakeWorkerResponse = {
  data?: ArrayBuffer;
  error?: string;
  height?: number;
  id: number;
  width?: number;
};

type TextureBakeWorkerScope = {
  onmessage: ((event: MessageEvent<TextureBakeWorkerRequest>) => void) | null;
  postMessage: (message: TextureBakeWorkerResponse, transfer: Transferable[]) => void;
};

const workerSelf = self as unknown as TextureBakeWorkerScope;

async function decodeImageParams(params: SkyboxImageParams): Promise<SkyboxImageParams> {
  if (params.pixels || !params.src) {
    return params;
  }

  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
    throw new Error("Image decoding is not available in this worker.");
  }

  const response = await fetch(params.src);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);
  const width = params.width || imageBitmap.width;
  const height = params.height || imageBitmap.height;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    imageBitmap.close();
    throw new Error("Image pixels could not be decoded.");
  }

  context.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  return {
    ...params,
    height,
    pixels: context.getImageData(0, 0, width, height).data as unknown as number[],
    width,
  };
}

async function resolveNodeImages(node: SkyboxManifestNode): Promise<SkyboxManifestNode> {
  if (node.type === "group") {
    return {
      ...node,
      children: await Promise.all(node.children.map(resolveNodeImages)),
    };
  }

  if (node.type !== "image") {
    return node;
  }

  const layer: SkyboxManifestLayer = {
    ...node,
    params: await decodeImageParams(node.params),
  };

  return layer;
}

async function resolveManifestImages(manifest: SkyboxManifest): Promise<SkyboxManifestV2> {
  const migratedManifest = migrateManifestToV2(manifest);

  return {
    ...migratedManifest,
    nodes: await Promise.all(migratedManifest.nodes.map(resolveNodeImages)),
  };
}

workerSelf.onmessage = (event: MessageEvent<TextureBakeWorkerRequest>) => {
  void (async () => {
    try {
      const manifest = await resolveManifestImages(event.data.manifest);
      const bakedImage = bakeSkyboxImageData(manifest, {
        cache: false,
        height: event.data.height,
        starfieldBakes: event.data.starfieldBakes
          ? new Map<string, StarfieldBakeData>(
              event.data.starfieldBakes.map((bake) => [
                bake.layerId,
                {
                  data: new Uint8ClampedArray(bake.data) as Uint8ClampedArray<ArrayBuffer>,
                  height: bake.height,
                  width: bake.width,
                },
              ])
            )
          : undefined,
        width: event.data.width,
      });
      const data = bakedImage.data.buffer;
      const response: TextureBakeWorkerResponse = {
        data,
        height: bakedImage.height,
        id: event.data.id,
        width: bakedImage.width,
      };

      workerSelf.postMessage(response, [data]);
    } catch (error) {
      workerSelf.postMessage(
        {
          error: error instanceof Error ? error.message : "Skybox export failed.",
          id: event.data.id,
        },
        []
      );
    }
  })();
};
