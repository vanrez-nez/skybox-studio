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

// Five erosion octaves reach much finer scales than the old FBM. A 256-segment grid is a practical
// compromise: 66k vertices resolve the reference features while the expensive sampling stays in a
// worker and the WebGPU draw remains comfortably below a million triangles.
const SEGMENTS = 256;
const MAP_RESOLUTION = 512;
const EYE_HEIGHT = 25;

type TerrainRenderMaps = TerrainMaps & {
  tint: Uint8Array;
  weights: Uint8Array;
};

// Height-blend controls. `DEPTH` is how far a material's own grain can push it
// past its coverage, `BAND` the width of the transition once it wins — a
// narrow band gives an interlocking edge instead of a linear cross-fade.
const HEIGHT_BLEND_DEPTH = 0.35;
const HEIGHT_BLEND_BAND = 0.12;

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

    position.setY(index, (height - originHeight) * params.height - EYE_HEIGHT);
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
    material.normalScale.set(0.65, 0.65);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
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

    /*
     * Paint the tiled material textures with the feature coverage.
     *
     * Each material contributes its own tile, and the winner at a texel is
     * decided by coverage plus that tile's own grain (alpha), so the boundary
     * follows the material's texture rather than the feature map's ~5 m
     * bilinear ramp. Only the tint and the rock shade come from the map.
     */
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
      const scores = tiles.map((tile, index) => {
        const weight = [coverage.r, coverage.g, coverage.b, coverage.a][index];

        return weight.add(tile.a.mul(HEIGHT_BLEND_DEPTH));
      });
      const peak = scores[0].max(scores[1]).max(scores[2]).max(scores[3]);
      const threshold = peak.sub(HEIGHT_BLEND_BAND);
      const banded = scores.map((score) => score.sub(threshold).max(0));
      const total = banded[0].add(banded[1]).add(banded[2]).add(banded[3]).max(0.0001);
      // Rock alone carries the map's relief darkening; the other materials are
      // shaded only by the shared tint.
      const blended = tiles[0].rgb
        .mul(tint.a)
        .mul(banded[0])
        .add(tiles[1].rgb.mul(banded[1]))
        .add(tiles[2].rgb.mul(banded[2]))
        .add(tiles[3].rgb.mul(banded[3]))
        .div(total);

      material.colorNode = blended.mul(tint.rgb.mul(TERRAIN_TINT_RANGE)) as any;
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
    queue.request(pickTerrainSamplingParams(params), MAP_RESOLUTION);

    return {
      root: mesh,
      update: (value) => {
        const next = resolveTerrainParams(value);
        const requiresSampling = !samplingParamsEqual(currentParams, next);
        const requiresProjection =
          currentParams.extent !== next.extent || currentParams.height !== next.height;
        const extentChanged = currentParams.extent !== next.extent;

        currentParams = next;
        material.roughness = next.roughness;

        if (extentChanged) {
          setTerrainTileWorldScale([...tileTextures, tileNormalTexture], next.extent);
        }

        if (requiresSampling) {
          queue.request(pickTerrainSamplingParams(next), MAP_RESOLUTION);
        } else if (requiresProjection && currentMaps) {
          applyGeometry(currentMaps);
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
