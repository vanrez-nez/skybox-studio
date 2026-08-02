import type { TerrainSamplingParams } from "@/scenarios/terrain/erosion";
import type {
  TerrainWorkerRequest,
  TerrainWorkerResponse,
  TerrainWorkerResult,
} from "@/scenarios/terrain/terrain-worker-protocol";

export type TerrainWorkerPort = {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent<TerrainWorkerResponse>) => void) | null;
  postMessage: (message: TerrainWorkerRequest) => void;
  terminate: () => void;
};

type TerrainWorkerQueueOptions = {
  onError: (message: string) => void;
  onResult: (result: TerrainWorkerResult) => void;
  worker: TerrainWorkerPort;
};

// Workers cannot interrupt a running sample pass. Keep only one undispatched request so dragging a
// slider never builds an ever-growing queue of already-obsolete terrain revisions.
export class TerrainWorkerQueue {
  #active = false;
  #disposed = false;
  #latestRevision = 0;
  #nextRevision = 0;
  #onError: (message: string) => void;
  #onResult: (result: TerrainWorkerResult) => void;
  #pending: TerrainWorkerRequest | null = null;
  #worker: TerrainWorkerPort;

  constructor({ onError, onResult, worker }: TerrainWorkerQueueOptions) {
    this.#onError = onError;
    this.#onResult = onResult;
    this.#worker = worker;
    this.#worker.onerror = (event) => {
      if (!this.#disposed) {
        this.#active = false;
        this.#pending = null;
        this.#onError(event.message || "Terrain worker failed.");
      }
    };
    this.#worker.onmessage = (event) => this.#handleResponse(event.data);
  }

  request(
    params: TerrainSamplingParams,
    resolution: number,
    surfaceSlopeScale: number
  ): number {
    if (this.#disposed) {
      throw new Error("Cannot request terrain from a disposed worker queue.");
    }

    const revision = ++this.#nextRevision;

    this.#latestRevision = revision;
    this.#pending = {
      params,
      resolution,
      revision,
      surfaceSlopeScale,
      type: "generate",
    };
    this.#dispatch();

    return revision;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#pending = null;
    this.#worker.onerror = null;
    this.#worker.onmessage = null;
    this.#worker.terminate();
  }

  #dispatch(): void {
    if (this.#active || !this.#pending || this.#disposed) {
      return;
    }

    const request = this.#pending;

    this.#pending = null;
    this.#active = true;
    this.#worker.postMessage(request);
  }

  #handleResponse(response: TerrainWorkerResponse): void {
    if (this.#disposed) {
      return;
    }

    this.#active = false;

    if (response.revision === this.#latestRevision) {
      if (response.type === "result") {
        this.#onResult(response);
      } else {
        this.#onError(response.error);
      }
    }

    this.#dispatch();
  }
}
