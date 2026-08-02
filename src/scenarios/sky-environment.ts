import * as THREE from "three/webgpu";

import {
  createSkyboxGpuBakeService,
  evaluateSkyboxDirection,
  migrateManifestToV2,
  type SkyboxGpuBakeService,
  type SkyboxManifest,
  type SkyboxManifestLayer,
  type SkyboxManifestNode,
} from "@/runtime/index";
import {
  createStarfieldGpuBakeService,
  type StarfieldGpuBakeService,
} from "@/runtime/starfield";

const ENV_WIDTH = 1024;
const ENV_HEIGHT = 512;
// Matches the cadence the runtime already uses to debounce starfield texture regeneration.
const REBAKE_DEBOUNCE_MS = 150;

function collectLayers(
  nodes: SkyboxManifestNode[],
  predicate: (node: SkyboxManifestNode) => boolean,
  found: SkyboxManifestNode[] = []
): SkyboxManifestNode[] {
  nodes.forEach((node) => {
    if (node.type === "group") {
      if (node.enabled) {
        collectLayers(node.children, predicate, found);
      }

      return;
    }

    if (node.enabled && predicate(node)) {
      found.push(node);
    }
  });

  return found;
}

// Bakes the live sky to an equirect env map and prefilters it into a PMREM for image-based
// lighting. Runs on the MAIN viewport renderer — unlike the image-export path in BakePreview, which
// has to stand up its own offscreen renderer because it runs outside the scene.
export class SkyEnvironment {
  #renderer: THREE.WebGPURenderer;
  #skyboxService: SkyboxGpuBakeService | null;
  #starfieldService: StarfieldGpuBakeService | null;
  #pmrem: THREE.PMREMGenerator | null = null;
  #target: { dispose: () => void } | null = null;
  #prefiltered: THREE.Texture | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #disposed = false;
  #generation = 0;
  #onChange: (environment: THREE.Texture | null) => void;

  constructor(
    renderer: THREE.WebGPURenderer,
    onChange: (environment: THREE.Texture | null) => void
  ) {
    this.#renderer = renderer;
    this.#onChange = onChange;
    this.#skyboxService = createSkyboxGpuBakeService(renderer);
    this.#starfieldService = createStarfieldGpuBakeService(renderer);
  }

  get available(): boolean {
    return this.#skyboxService !== null;
  }

  // Debounced so dragging a gradient stop doesn't queue a bake per frame.
  requestRebake(manifest: SkyboxManifest, imageTextures?: Map<string, THREE.Texture>): void {
    if (this.#disposed || !this.#skyboxService) {
      return;
    }

    if (this.#timer !== null) {
      clearTimeout(this.#timer);
    }

    const generation = ++this.#generation;

    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#bake(manifest, imageTextures, generation);
    }, REBAKE_DEBOUNCE_MS);
  }

  async #bake(
    manifest: SkyboxManifest,
    imageTextures: Map<string, THREE.Texture> | undefined,
    generation: number,
  ): Promise<void> {
    if (this.#disposed || !this.#skyboxService) {
      return;
    }

    try {
      // Starfield layers are procedural at render time; the composition bake samples them as plain
      // textures, so they have to be baked first. The service owns and caches these — do not dispose.
      const starfieldTextures = new Map<string, THREE.Texture>();

      if (this.#starfieldService) {
        const service = this.#starfieldService;

        collectLayers(
          migrateManifestToV2(manifest).nodes,
          (node) => node.type === "starfield"
        ).forEach((layer) => {
          const params = (layer as { params: Parameters<typeof service.createBakeKey>[0] }).params;
          const key = service.createBakeKey(params, ENV_WIDTH);

          starfieldTextures.set(layer.id, service.bakeTexture(params, key, ENV_WIDTH));
        });
      }

      const moonTextures = await this.#skyboxService.prepareMoonTextures(manifest, ENV_HEIGHT);

      if (this.#disposed || generation !== this.#generation) {
        return;
      }

      const baked = this.#skyboxService.bakeRenderTarget(manifest, {
        height: ENV_HEIGHT,
        // Linear half-float so the PMREM has real range to work with.
        hdr: true,
        imageTextures,
        moonTextures,
        starfieldTextures,
        width: ENV_WIDTH,
        // No flipY: that option exists only to cancel the EXR exporter's scanline flip, and would
        // put the env map upside down here.
      });

      // The bake service leaves `mapping` at the default; equirect env maps must say so explicitly.
      baked.target.texture.mapping = THREE.EquirectangularReflectionMapping;

      const pmrem = this.#pmrem ?? new THREE.PMREMGenerator(this.#renderer);

      this.#pmrem = pmrem;
      pmrem.compileEquirectangularShader();

      const prefiltered = pmrem.fromEquirectangular(baked.target.texture).texture;

      this.#prefiltered?.dispose();
      this.#target?.dispose();
      this.#prefiltered = prefiltered;
      this.#target = baked;
      this.#onChange(prefiltered);
    } catch (error) {
      // Never let a bake failure take the viewport down — the scenario just stays lit by the
      // explicit sun/ambient.
      console.warn("[scenario] Sky environment bake failed:", error);
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#generation += 1;

    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }

    this.#prefiltered?.dispose();
    this.#prefiltered = null;
    this.#target?.dispose();
    this.#target = null;
    this.#pmrem?.dispose();
    this.#pmrem = null;
    this.#skyboxService?.dispose();
    this.#starfieldService?.dispose?.();
  }
}

type SkyLightLayer = Extract<SkyboxManifestLayer, { type: "moon" | "sun" }>;

export type SkyLightReference = {
  direction: THREE.Vector3;
  id: string;
  name: string;
  type: SkyLightLayer["type"];
};

// The layer list is already in the same top-to-bottom order shown by the editor. Pick one enabled
// celestial reference from that order so Preview never tries to represent both a sun and a moon.
// Spots remain artistic sky layers; only an authored Sun or Moon can own the terrain key light.
export function findSkyLightReference(manifest: SkyboxManifest): SkyLightReference | null {
  const [layer] = collectLayers(
    migrateManifestToV2(manifest).nodes,
    (node) => node.type === "sun" || node.type === "moon"
  ) as SkyLightLayer[];

  if (!layer) {
    return null;
  }

  const [x, y, z] =
    layer.type === "sun"
      ? layer.params.centerDirection
      : layer.params.placement.centerDirection;
  const direction = new THREE.Vector3(x, y, z);
  const lengthSquared = direction.lengthSq();

  if (!Number.isFinite(lengthSquared) || lengthSquared === 0) {
    return null;
  }

  direction.normalize();

  return {
    direction,
    id: layer.id,
    name: layer.name,
    type: layer.type,
  };
}

// Reads Preview's key light straight off the first Sun/Moon reference. The composited sky colour in
// that direction supplies its tint; the caller retains manual direction/colour as the no-reference
// fallback.
export function lightFromSky(
  manifest: SkyboxManifest
): (SkyLightReference & { color: THREE.Color }) | null {
  const reference = findSkyLightReference(manifest);

  if (!reference) {
    return null;
  }

  const { direction } = reference;
  const [r, g, b] = evaluateSkyboxDirection(manifest, [direction.x, direction.y, direction.z]);
  // evaluateSkyboxDirection returns LINEAR rgb, which is what THREE.Color wants internally.
  const color = new THREE.Color();

  color.setRGB(r, g, b, THREE.LinearSRGBColorSpace);

  // The sampled source can be arbitrarily bright; normalise so intensity stays the user's control.
  const peak = Math.max(color.r, color.g, color.b, 1);

  color.multiplyScalar(1 / peak);

  return { ...reference, color };
}
