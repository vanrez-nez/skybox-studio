import * as THREE from "three/webgpu";

import type { SceneParams } from "@/scenarios/scene-params";

const SUN_DISTANCE = 1200;

// Owns everything a scenario needs to be lit: the sun, the ambient hemisphere term and fog. Shared
// across scenarios so the Preview sidebar shows one "Scene" section regardless of which is active.
//
// Only attached while Preview is active — attach()/detach() fully restore the Editor's look, which
// matters because the skybox is authored in display space and must render identically in both views.
//
// Deliberately does NOT touch renderer.toneMapping. ACES would be nicer for the lit terrain's
// highlights, but `material.toneMapped = false` is not honoured on the skybox's NodeMaterial under
// the WebGPU backend, so enabling it visibly shifts the authored sky (bright saturated colours
// desaturate). Preserving the sky wins — this is a sky previewer. Light intensities are tuned to
// stay in range without a filmic curve instead.
export class SceneEnvironment {
  readonly root = new THREE.Group();

  #scene: THREE.Scene;
  #renderer: THREE.WebGPURenderer;
  #sun = new THREE.DirectionalLight(0xffffff, 1);
  #ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  #fog = new THREE.Fog(0x000000, 1, 1000);
  #attached = false;
  #environment: THREE.Texture | null = null;
  #previousShadowMapEnabled = false;

  constructor(scene: THREE.Scene, renderer: THREE.WebGPURenderer) {
    this.#scene = scene;
    this.#renderer = renderer;
    this.#sun.castShadow = true;
    this.#sun.shadow.mapSize.set(2048, 2048);
    this.#sun.shadow.bias = -0.00015;
    this.#sun.shadow.normalBias = 0.5;

    const shadowCamera = this.#sun.shadow.camera;

    shadowCamera.left = -1600;
    shadowCamera.right = 1600;
    shadowCamera.top = 1600;
    shadowCamera.bottom = -1600;
    shadowCamera.near = 1;
    shadowCamera.far = 4000;
    shadowCamera.updateProjectionMatrix();
    this.root.add(this.#sun);
    this.root.add(this.#sun.target);
    this.root.add(this.#ambient);
  }

  attach(): void {
    if (this.#attached) {
      return;
    }

    this.#attached = true;
    this.#previousShadowMapEnabled = this.#renderer.shadowMap.enabled;
    this.#renderer.shadowMap.enabled = true;
    this.#scene.add(this.root);
    this.#scene.environment = this.#environment;
  }

  detach(): void {
    if (!this.#attached) {
      return;
    }

    this.#attached = false;
    this.#renderer.shadowMap.enabled = this.#previousShadowMapEnabled;
    this.#scene.remove(this.root);
    this.#scene.fog = null;
    this.#scene.environment = null;
  }

  // The baked sky, as an already-prefiltered PMREM texture. Held even while detached so switching
  // back to Preview doesn't need a rebake.
  setEnvironment(environment: THREE.Texture | null): void {
    this.#environment = environment;

    if (this.#attached) {
      this.#scene.environment = environment;
    }
  }

  apply(params: SceneParams, sun: { color: THREE.Color; direction: THREE.Vector3 }): void {
    this.#sun.color.copy(sun.color);
    this.#sun.intensity = params.sun.intensity;
    // `direction` points FROM the sun, so the light sits along it and targets the origin.
    this.#sun.position.copy(sun.direction).multiplyScalar(SUN_DISTANCE);
    this.#sun.target.position.set(0, 0, 0);
    this.#sun.target.updateMatrixWorld();

    this.#ambient.color.set(params.ambient.skyColor);
    this.#ambient.groundColor.set(params.ambient.groundColor);
    this.#ambient.intensity = params.ambient.intensity;

    if (this.#attached) {
      this.#scene.environmentIntensity = params.ambient.environmentIntensity;

      if (params.fog.enabled) {
        this.#fog.color.set(params.fog.color);
        this.#fog.near = params.fog.near;
        // Guard against far <= near, which makes three emit NaN fog factors.
        this.#fog.far = Math.max(params.fog.far, params.fog.near + 1);
        this.#scene.fog = this.#fog;
      } else {
        this.#scene.fog = null;
      }
    }
  }

  dispose(): void {
    this.detach();
    this.#sun.dispose();
    this.#ambient.dispose();
  }
}

// Converts azimuth/elevation in degrees to the unit direction the light comes FROM. Azimuth is
// measured from -Z (the camera's default forward) toward +X, matching how spot layers are authored.
export function sunDirectionFromAngles(azimuthDegrees: number, elevationDegrees: number) {
  const azimuth = THREE.MathUtils.degToRad(azimuthDegrees);
  const elevation = THREE.MathUtils.degToRad(elevationDegrees);
  const horizontal = Math.cos(elevation);

  return new THREE.Vector3(
    horizontal * Math.sin(azimuth),
    Math.sin(elevation),
    -horizontal * Math.cos(azimuth)
  ).normalize();
}
