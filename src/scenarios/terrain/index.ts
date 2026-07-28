import * as THREE from "three/webgpu";

import { registerScenarioAddon, type ScenarioAddon } from "@/scenarios/scenario";
import { fbm2 } from "@/scenarios/terrain/noise";
import { createDefaultTerrainParams, type TerrainParams } from "@/scenarios/terrain/params";

export const TERRAIN_SCENARIO_ID = "terrain";

// Grid resolution. 200x200 is ~40k verts / 80k tris — regenerating it synchronously on a param
// change costs a couple of milliseconds, which keeps slider dragging responsive without needing an
// async rebuild.
const SEGMENTS = 200;
// The camera is pinned at the origin, so the surface directly beneath it is placed this far below —
// you always stand ON the terrain at a consistent eye height, whatever the noise does there.
// Offsetting from the heightfield's base instead would let a tall hill swallow the camera.
const EYE_HEIGHT = 25;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));

  return t * t * (3 - 2 * t);
}

// Displaces a flat grid into a heightfield and tints it low→high. Vertex colours rather than a TSL
// colorNode: the displacement is already CPU-side, so this keeps the whole surface definition in one
// place and leaves the material a stock lit PBR one.
function buildTerrainGeometry(params: TerrainParams): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(params.extent, params.extent, SEGMENTS, SEGMENTS);

  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position as THREE.BufferAttribute;
  const count = position.count;
  const colors = new Float32Array(count * 3);
  const halfExtent = params.extent / 2;
  const low = new THREE.Color(params.colorLow);
  const high = new THREE.Color(params.colorHigh);
  const color = new THREE.Color();
  // Ground level under the camera, so the eye height is honoured wherever the noise happens to put
  // the surface at the origin.
  const originHeight =
    fbm2(0, 0, {
      frequency: params.frequency,
      gain: params.gain,
      octaves: params.octaves,
      seed: params.seed,
    }) * params.height;

  for (let index = 0; index < count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const noise = fbm2(x / params.extent, z / params.extent, {
      frequency: params.frequency,
      gain: params.gain,
      octaves: params.octaves,
      seed: params.seed,
    });
    // Flatten toward the rim so the square boundary reads as a distant plain rather than a cliff.
    // Fog then swallows whatever is left of it.
    const radial = Math.hypot(x, z) / halfExtent;
    const falloff = smoothstep(1, 0.45, radial);
    const height = noise * params.height * falloff;

    position.setY(index, height - originHeight - EYE_HEIGHT);

    color.copy(low).lerp(high, smoothstep(0, 1, noise * falloff));
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  position.needsUpdate = true;
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // Real normals from the displaced surface — this is why the heightfield is built on the CPU.
  geometry.computeVertexNormals();

  return geometry;
}

// Params that only touch the material can be applied without rebuilding 40k vertices.
function isGeometryDirty(previous: TerrainParams, next: TerrainParams): boolean {
  return (
    previous.colorHigh !== next.colorHigh ||
    previous.colorLow !== next.colorLow ||
    previous.extent !== next.extent ||
    previous.frequency !== next.frequency ||
    previous.gain !== next.gain ||
    previous.height !== next.height ||
    previous.octaves !== next.octaves ||
    previous.seed !== next.seed
  );
}

export const terrainScenarioAddon: ScenarioAddon<TerrainParams> = {
  id: TERRAIN_SCENARIO_ID,
  displayName: "Terrain",
  createDefaultParams: createDefaultTerrainParams,
  build: (_context, initialParams) => {
    const material = new THREE.MeshStandardNodeMaterial({
      metalness: 0,
      roughness: initialParams.roughness,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(buildTerrainGeometry(initialParams), material);

    let current = initialParams;

    mesh.name = "Terrain";

    return {
      root: mesh,
      update: (params) => {
        if (isGeometryDirty(current, params)) {
          mesh.geometry.dispose();
          mesh.geometry = buildTerrainGeometry(params);
        }

        material.roughness = params.roughness;
        current = params;
      },
      dispose: () => {
        mesh.geometry.dispose();
        material.dispose();
      },
    };
  },
};

registerScenarioAddon(terrainScenarioAddon);
