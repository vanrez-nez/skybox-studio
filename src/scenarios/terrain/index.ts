import * as THREE from "three/webgpu";
import { texture as textureNode } from "three/tsl";

import {
  generateTerrainMaterialTiles,
  TERRAIN_MATERIAL_IDS,
  TERRAIN_TILE_WORLD_SIZE,
} from "@/scenarios/terrain/materials";
import { pickTerrainSamplingParams, type TerrainMaps } from "@/scenarios/terrain/erosion";
import { TERRAIN_TINT_RANGE } from "@/scenarios/terrain/surface";
import {
  createDefaultTerrainParams,
  resolveTerrainParams,
  type TerrainParams,
} from "@/scenarios/terrain/params";
import type { TerrainWorkerResult } from "@/scenarios/terrain/terrain-worker-protocol";
import {
  TerrainWorkerQueue,
  type TerrainWorkerPort,
} from "@/scenarios/terrain/terrain-worker-queue";
import { registerScenarioAddon, type ScenarioAddon } from "@/scenarios/scenario";

export const TERRAIN_SCENARIO_ID = "terrain";

const MAP_RESOLUTION = 512;
// Keep one mesh vertex per generated height sample. Downsampling the 512² filter output to 256²
// erased the smaller branching gullies before the renderer ever saw them.
const SEGMENTS = MAP_RESOLUTION - 1;
// The reference views the whole heightfield from well outside its surface. The preview must remain
// an environment view, but 25 units placed the camera close enough to magnify each 4.7-unit height
// texel into a broad smooth patch. This higher overlook retains a believable landscape horizon.
const EYE_HEIGHT = 80;

type TerrainRenderMaps = TerrainMaps & {
  tint: Uint8Array;
  weights: Uint8Array;
};

function samplingParamsEqual(previous: TerrainParams, next: TerrainParams): boolean {
  return (
    previous.creaseRounding === next.creaseRounding &&
    previous.erosionDetail === next.erosionDetail &&
    previous.erosionOctaves === next.erosionOctaves &&
    previous.erosionScale === next.erosionScale &&
    previous.erosionStrength === next.erosionStrength &&
    previous.frequency === next.frequency &&
    previous.gain === next.gain &&
    previous.gullyWeight === next.gullyWeight &&
    previous.octaves === next.octaves &&
    previous.ridgeRounding === next.ridgeRounding &&
    previous.seed === next.seed
  );
}

function terrainMapsFromResult(result: TerrainWorkerResult): TerrainRenderMaps {
  return {
    breakup: new Float32Array(result.breakup),
    erosion: new Float32Array(result.erosion),
    height: new Float32Array(result.height),
    resolution: result.resolution,
    ridgeMap: new Float32Array(result.ridgeMap),
    tint: new Uint8Array(result.tint),
    trees: new Float32Array(result.trees),
    weights: new Uint8Array(result.weights),
  };
}

function sampleTerrainMap(
  values: Float32Array,
  resolution: number,
  u: number,
  v: number
): number {
  const x = Math.min(resolution - 1, Math.max(0, u * (resolution - 1)));
  const y = Math.min(resolution - 1, Math.max(0, v * (resolution - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, resolution - 1);
  const y1 = Math.min(y0 + 1, resolution - 1);
  const tx = x - x0;
  const ty = y - y0;
  const top = (values[y0 * resolution + x0] ?? 0) * (1 - tx) +
    (values[y0 * resolution + x1] ?? 0) * tx;
  const bottom = (values[y1 * resolution + x0] ?? 0) * (1 - tx) +
    (values[y1 * resolution + x1] ?? 0) * tx;

  return top * (1 - ty) + bottom * ty;
}

function buildTerrainGeometry(params: TerrainParams, maps: TerrainMaps): THREE.BufferGeometry {
  if (maps.resolution !== MAP_RESOLUTION) {
    throw new Error(
      `Expected a ${MAP_RESOLUTION}x${MAP_RESOLUTION} terrain map, received ${maps.resolution}.`
    );
  }

  const geometry = new THREE.PlaneGeometry(params.extent, params.extent, SEGMENTS, SEGMENTS);

  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position as THREE.BufferAttribute;
  const originHeight = sampleTerrainMap(maps.height, maps.resolution, 0.5, 0.5);

  for (let index = 0; index < position.count; index += 1) {
    const column = index % (SEGMENTS + 1);
    const row = Math.floor(index / (SEGMENTS + 1));
    const height = sampleTerrainMap(
      maps.height,
      maps.resolution,
      column / SEGMENTS,
      row / SEGMENTS
    );

    position.setY(
      index,
      (height - originHeight) * params.reliefHeight - EYE_HEIGHT
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/** Feature map: one texel per ~5 m, deciding which material covers the ground. */
function buildTerrainFeatureTexture(
  data: Uint8Array,
  resolution: number,
  name: string,
  maxAnisotropy: number
): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    data,
    resolution,
    resolution,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );

  texture.name = name;
  // Coverage and tint are data, not colour: no sRGB decode.
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = maxAnisotropy;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

/** Material tile: repeats every TERRAIN_TILE_WORLD_SIZE metres. */
function buildTerrainTileTexture(
  data: Uint8Array,
  resolution: number,
  name: string,
  colorSpace: THREE.ColorSpace,
  maxAnisotropy: number
): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    data,
    resolution,
    resolution,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );

  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = maxAnisotropy;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  return texture;
}

function setTerrainTileWorldScale(textures: THREE.Texture[], extent: number): void {
  const repeat = extent / TERRAIN_TILE_WORLD_SIZE;

  for (const texture of textures) {
    texture.repeat.set(repeat, repeat);
    texture.updateMatrix();
  }
}

export const terrainScenarioAddon: ScenarioAddon<TerrainParams> = {
  id: TERRAIN_SCENARIO_ID,
  displayName: "Terrain",
  createDefaultParams: createDefaultTerrainParams,
  build: (context, initialParams) => {
    const params = resolveTerrainParams(initialParams);
    const maxAnisotropy = context.renderer.getMaxAnisotropy();
    const tileData = generateTerrainMaterialTiles();
    const tileTextures = TERRAIN_MATERIAL_IDS.map((id) =>
      buildTerrainTileTexture(
        tileData.color[id],
        tileData.resolution,
        `Terrain ${id} tile`,
        THREE.SRGBColorSpace,
        maxAnisotropy
      )
    );
    const tileNormalTexture = buildTerrainTileTexture(
      tileData.normal,
      tileData.resolution,
      "Terrain tile normal",
      THREE.NoColorSpace,
      maxAnisotropy
    );
    const material = new THREE.MeshStandardNodeMaterial({
      metalness: 0,
      normalMap: tileNormalTexture,
      roughness: params.roughness,
    });
    material.normalScale.set(0.35, 0.35);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const worker = new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" });
    let currentMaps: TerrainRenderMaps | null = null;
    let currentFeatureTextures: THREE.DataTexture[] = [];
    let currentParams = params;
    let disposed = false;

    setTerrainTileWorldScale([...tileTextures, tileNormalTexture], params.extent);

    const applyGeometry = (maps: TerrainMaps) => {
      const geometry = buildTerrainGeometry(currentParams, maps);

      mesh.geometry.dispose();
      mesh.geometry = geometry;
      mesh.visible = true;
    };

    // Paint the material tiles with exactly the coverage produced by the source classification.
    // Letting tile grain choose a winner created large material islands unrelated to height or
    // slope, which is why the previous colours visibly disagreed with the landform.
    const applyMaps = (maps: TerrainRenderMaps) => {
      const weightsTexture = buildTerrainFeatureTexture(
        maps.weights,
        maps.resolution,
        "Terrain material coverage",
        maxAnisotropy
      );
      const tintTexture = buildTerrainFeatureTexture(
        maps.tint,
        maps.resolution,
        "Terrain tint",
        maxAnisotropy
      );

      applyGeometry(maps);

      for (const texture of currentFeatureTextures) {
        texture.dispose();
      }
      currentFeatureTextures = [weightsTexture, tintTexture];

      const coverage = textureNode(weightsTexture);
      const tint = textureNode(tintTexture);
      const tiles = tileTextures.map((texture) => textureNode(texture));
      const total = coverage.r
        .add(coverage.g)
        .add(coverage.b)
        .add(coverage.a)
        .max(0.0001);
      // Rock alone carries the map's relief darkening; the other materials are
      // shaded only by the shared tint.
      const blended = tiles[0].rgb
        .mul(tint.a)
        .mul(coverage.r)
        .add(tiles[1].rgb.mul(coverage.g))
        .add(tiles[2].rgb.mul(coverage.b))
        .add(tiles[3].rgb.mul(coverage.a))
        .div(total);
      const surfaceColor = blended.mul(tint.rgb.mul(TERRAIN_TINT_RANGE));

      material.colorNode = surfaceColor as any;
      // Runevision's renderer always adds sky ambient, sun bounce and atmosphere. A small terrain-
      // only floor preserves that readability when the preview document has no sky layer yet.
      material.emissiveNode = surfaceColor.mul(0.1) as any;
      material.needsUpdate = true;
    };

    const queue = new TerrainWorkerQueue({
      worker: worker as unknown as TerrainWorkerPort,
      onError: (message) => {
        console.error(`[Terrain] ${message}`);
      },
      onResult: (result) => {
        if (disposed) {
          return;
        }

        currentMaps = terrainMapsFromResult(result);
        applyMaps(currentMaps);
        context.requestRender();
      },
    });

    mesh.name = "Terrain";
    mesh.visible = false;
    queue.request(
      pickTerrainSamplingParams(params),
      MAP_RESOLUTION,
      params.reliefHeight / params.extent
    );

    return {
      root: mesh,
      update: (value) => {
        const next = resolveTerrainParams(value);
        const requiresSampling = !samplingParamsEqual(currentParams, next);
        const requiresProjection =
          currentParams.extent !== next.extent ||
          currentParams.reliefHeight !== next.reliefHeight;
        const requiresSurfaceClassification =
          currentParams.reliefHeight / currentParams.extent !==
          next.reliefHeight / next.extent;
        const extentChanged = currentParams.extent !== next.extent;

        currentParams = next;
        material.roughness = next.roughness;

        if (extentChanged) {
          setTerrainTileWorldScale([...tileTextures, tileNormalTexture], next.extent);
        }

        if (requiresProjection && currentMaps) {
          applyGeometry(currentMaps);
        }

        if (requiresSampling || requiresSurfaceClassification) {
          queue.request(
            pickTerrainSamplingParams(next),
            MAP_RESOLUTION,
            next.reliefHeight / next.extent
          );
        }
      },
      dispose: () => {
        disposed = true;
        queue.dispose();
        mesh.geometry.dispose();

        for (const texture of currentFeatureTextures) {
          texture.dispose();
        }

        for (const texture of tileTextures) {
          texture.dispose();
        }

        tileNormalTexture.dispose();
        material.dispose();
      },
    };
  },
};

registerScenarioAddon(terrainScenarioAddon);
