import { generateTerrainMaps } from "@/scenarios/terrain/erosion";
import { generateTerrainSurfaceMaps } from "@/scenarios/terrain/surface";
import type {
  TerrainWorkerRequest,
  TerrainWorkerResponse,
  TerrainWorkerResult,
} from "@/scenarios/terrain/terrain-worker-protocol";

type TerrainWorkerScope = {
  onmessage: ((event: MessageEvent<TerrainWorkerRequest>) => void) | null;
  postMessage: (message: TerrainWorkerResponse, transfer: Transferable[]) => void;
};

const workerSelf = self as unknown as TerrainWorkerScope;

workerSelf.onmessage = (event) => {
  const request = event.data;

  if (request.type !== "generate") {
    return;
  }

  try {
    const maps = generateTerrainMaps(request.params, request.resolution);
    const surface = generateTerrainSurfaceMaps(maps);
    const response: TerrainWorkerResult = {
      breakup: maps.breakup.buffer as ArrayBuffer,
      erosion: maps.erosion.buffer as ArrayBuffer,
      height: maps.height.buffer as ArrayBuffer,
      resolution: maps.resolution,
      revision: request.revision,
      ridgeMap: maps.ridgeMap.buffer as ArrayBuffer,
      tint: surface.tint.buffer as ArrayBuffer,
      trees: maps.trees.buffer as ArrayBuffer,
      type: "result",
      weights: surface.weights.buffer as ArrayBuffer,
    };

    workerSelf.postMessage(response, [
      response.breakup,
      response.erosion,
      response.height,
      response.ridgeMap,
      response.tint,
      response.trees,
      response.weights,
    ]);
  } catch (error) {
    workerSelf.postMessage(
      {
        error: error instanceof Error ? error.message : "Terrain generation failed.",
        revision: request.revision,
        type: "error",
      },
      []
    );
  }
};
