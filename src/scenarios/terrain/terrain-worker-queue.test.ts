import { describe, expect, it, vi } from "vitest";

import { pickTerrainSamplingParams } from "@/scenarios/terrain/erosion";
import { createDefaultTerrainParams } from "@/scenarios/terrain/params";
import type {
  TerrainWorkerResponse,
  TerrainWorkerResult,
} from "@/scenarios/terrain/terrain-worker-protocol";
import {
  TerrainWorkerQueue,
  type TerrainWorkerPort,
} from "@/scenarios/terrain/terrain-worker-queue";

class FakeWorker implements TerrainWorkerPort {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent<TerrainWorkerResponse>) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  respond(response: TerrainWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<TerrainWorkerResponse>);
  }
}

function result(revision: number): TerrainWorkerResult {
  return {
    breakup: new ArrayBuffer(4),
    erosion: new ArrayBuffer(4),
    height: new ArrayBuffer(4),
    resolution: 1,
    revision,
    ridgeMap: new ArrayBuffer(4),
    tint: new ArrayBuffer(4),
    trees: new ArrayBuffer(4),
    type: "result",
    weights: new ArrayBuffer(4),
  };
}

describe("TerrainWorkerQueue", () => {
  it("runs one request at a time and retains only the latest pending revision", () => {
    const worker = new FakeWorker();
    const onResult = vi.fn();
    const queue = new TerrainWorkerQueue({ worker, onResult, onError: vi.fn() });
    const params = pickTerrainSamplingParams(createDefaultTerrainParams());
    const first = queue.request(params, 257);

    queue.request({ ...params, seed: 2 }, 257);
    const latest = queue.request({ ...params, seed: 3 }, 257);

    expect(worker.postMessage).toHaveBeenCalledTimes(1);

    worker.respond(result(first));

    expect(onResult).not.toHaveBeenCalled();
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage.mock.calls[1]?.[0]).toMatchObject({ revision: latest });

    worker.respond(result(latest));

    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ revision: latest }));
  });

  it("terminates the worker and ignores late results on disposal", () => {
    const worker = new FakeWorker();
    const onResult = vi.fn();
    const queue = new TerrainWorkerQueue({ worker, onResult, onError: vi.fn() });
    const revision = queue.request(
      pickTerrainSamplingParams(createDefaultTerrainParams()),
      257
    );

    queue.dispose();
    worker.respond(result(revision));

    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();
  });
});
