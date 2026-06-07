import { describe, expect, it } from "vitest";

import {
  getEffectLayerAddon,
  getEffectLayerAddons,
  registerEffectLayerAddon,
  registerEffectLayerUi,
  type EffectLayer,
  type EffectLayerAddon,
} from "@/effects/effect-layer";
import { readEffectLayerInterface } from "@/effects/effect-layer-interfaces";
import { createSkyboxManifest } from "@/effects/skybox-manifest";
import {
  evaluateSkyboxDirection,
  registerLayerRuntimeAdapter,
  type LayerRuntimeAdapter,
} from "@/runtime";

// Acceptance test for the layer-addon decoupling: adding a brand-new layer must
// require ONLY (a) one app addon registration, (b) one runtime adapter
// registration, and (c) one UI registration — with zero edits to the runtime
// core, the store core, or the sidebar. This test registers a throwaway "noise"
// layer through those public seams and proves it composes end-to-end.

type NoiseParams = {
  color: [number, number, number];
  scale: number;
};

function createDefaultNoiseParams(): NoiseParams {
  return { color: [1, 0, 0], scale: 1 };
}

const noiseAddon = {
  cloneParams: (params: NoiseParams) => ({ ...params, color: [...params.color] }),
  createDefaultParams: createDefaultNoiseParams,
  defaultBlendMode: "normal",
  displayName: "Noise",
  getDefaultName: () => "Noise",
  load: (serialized: { params: NoiseParams }) => serialized.params,
  serialize: (params: NoiseParams) => ({ params, type: "noise" }),
  // Manifest params are a plain serializable record; a brand-new type is not in
  // the built-in manifest union, hence the structural cast at registration.
  toManifestParams: (params: NoiseParams) => params,
  runtime: {
    // Structural only — never depends on color/scale, so a param drag stays on
    // the Direct pipeline (no Manifest rebuild).
    getTopologyKey: (layer: EffectLayer<NoiseParams>) => ({
      enabled: layer.enabled,
      id: layer.id,
      type: layer.type,
    }),
    updateLayerParams: () => {},
  },
  type: "noise",
} as unknown as EffectLayerAddon;

const noiseRuntimeAdapter: LayerRuntimeAdapter = {
  type: "noise",
  sampleCpu: (_direction, params) => {
    const { color } = params as NoiseParams;

    return [color[0], color[1], color[2], 1];
  },
};

function NoisePanel() {
  return null;
}

// One folder's worth of registration — no core edits.
registerEffectLayerAddon(noiseAddon);
registerLayerRuntimeAdapter(noiseRuntimeAdapter);
registerEffectLayerUi("noise", { Panel: NoisePanel });

function createNoiseLayer(params: NoiseParams): EffectLayer {
  return {
    blendMode: "normal",
    enabled: true,
    id: "noise-1",
    locked: false,
    name: "Noise",
    opacity: 100,
    params,
    type: "noise",
  };
}

describe("adding a layer via registration only", () => {
  it("exposes the new layer through the addon registry + UI registry", () => {
    expect(getEffectLayerAddons().map((addon) => addon.type)).toContain("noise");
    expect(getEffectLayerAddon("noise").Panel).toBe(NoisePanel);
    expect(getEffectLayerAddon("noise").createDefaultParams()).toEqual({
      color: [1, 0, 0],
      scale: 1,
    });
  });

  it("composes through the manifest + CPU evaluator with no core edits", () => {
    const manifest = createSkyboxManifest([createNoiseLayer({ color: [1, 0, 0], scale: 1 })]);
    const node = manifest.nodes[0];

    expect(node.type).toBe("noise");

    const composed = evaluateSkyboxDirection(manifest, [0, 0, -1]);

    expect(composed[0]).toBeCloseTo(1);
    expect(composed[1]).toBeCloseTo(0);
    expect(composed[2]).toBeCloseTo(0);
  });

  it("keeps the topology key stable across a param tweak (Direct pipeline)", () => {
    const addon = getEffectLayerAddon("noise");
    const before = addon.runtime.getTopologyKey(
      createNoiseLayer({ color: [1, 0, 0], scale: 1 }) as never
    );
    const after = addon.runtime.getTopologyKey(
      createNoiseLayer({ color: [0, 1, 0], scale: 8 }) as never
    );

    expect(JSON.stringify(before)).toBe(JSON.stringify(after));
  });

  it("supports no transform interfaces by default", () => {
    expect(readEffectLayerInterface(createNoiseLayer(createDefaultNoiseParams()), "rotation")).toBeNull();
  });
});
