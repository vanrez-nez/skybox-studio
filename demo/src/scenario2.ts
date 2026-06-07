// Scenario 2: load an editor project bundle (manifest.json + hashed assets) and
// render it with the runtime package in isolation. Live = original layers via the
// Skybox material; Baked = the whole manifest flattened to one equirect texture.
import * as THREE from "three/webgpu";
import { Skybox, createBakedSkyboxTexture } from "skybox-studio-runtime";

import { createLookControls } from "./look-controls";
import {
  collectImageLayers,
  loadBundleFromDirectory,
  loadBundleFromUrl,
  rehydrateImagePixels,
  type Bundle,
} from "./manifest-loader";

const BAKE_WIDTH = 1024;
const BUNDLE_BASE = new URL("sample-project/", window.location.href).href;

const app = document.getElementById("app") as HTMLDivElement;
const liveButton = document.getElementById("mode-live") as HTMLButtonElement;
const bakedButton = document.getElementById("mode-baked") as HTMLButtonElement;
const sphereButton = document.getElementById("geo-sphere") as HTMLButtonElement;
const boxButton = document.getElementById("geo-box") as HTMLButtonElement;
const openButton = document.getElementById("open") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;

const renderer = new THREE.WebGPURenderer({ antialias: true });

renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
const controls = createLookControls(camera, renderer.domElement);

let bundle: Bundle | null = null;
let skybox: Skybox | null = null;
let mode: "live" | "baked" = "live";
let geometry: "box" | "sphere" = "sphere";

function setStatus(message: string) {
  statusEl.textContent = message;
}

function syncButtons() {
  liveButton.dataset.active = String(mode === "live");
  bakedButton.dataset.active = String(mode === "baked");
  sphereButton.dataset.active = String(geometry === "sphere");
  boxButton.dataset.active = String(geometry === "box");
}

async function loadImageTextures(current: Bundle): Promise<Record<string, THREE.Texture>> {
  const loader = new THREE.TextureLoader();
  const textures: Record<string, THREE.Texture> = {};

  for (const layer of collectImageLayers(current.manifest)) {
    if (!layer.params.src) {
      continue;
    }

    const texture = await loader.loadAsync(current.resolveAssetUrl(layer.params.src));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.needsUpdate = true;
    textures[layer.id] = texture;
  }

  return textures;
}

function disposeSkybox() {
  if (skybox) {
    scene.remove(skybox);
    skybox.dispose();
    skybox = null;
  }
}

async function rebuild() {
  if (!bundle) {
    return;
  }

  setStatus(mode === "baked" ? "Baking…" : "");
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  disposeSkybox();

  if (mode === "live") {
    const next = new Skybox()
      .setRenderer(renderer)
      .fromManifest(bundle.manifest)
      .setGeometry({ type: geometry })
      .setRenderMode("auto");

    next.load();
    next.setImageTextures(await loadImageTextures(bundle));
    scene.add(next);
    skybox = next;
  } else {
    const rehydrated = await rehydrateImagePixels(bundle);
    const texture = createBakedSkyboxTexture(rehydrated, { width: BAKE_WIDTH });
    const next = new Skybox()
      .setRenderer(renderer)
      .fromManifest(bundle.manifest)
      .setGeometry({ type: geometry })
      .setRenderMode("baked-texture");

    next.load();
    next.setBakedTexture(texture);
    scene.add(next);
    skybox = next;
  }

  setStatus("");
}

liveButton.addEventListener("click", () => {
  mode = "live";
  syncButtons();
  void rebuild();
});

bakedButton.addEventListener("click", () => {
  mode = "baked";
  syncButtons();
  void rebuild();
});

sphereButton.addEventListener("click", () => {
  geometry = "sphere";
  syncButtons();
  void rebuild();
});

boxButton.addEventListener("click", () => {
  geometry = "box";
  syncButtons();
  void rebuild();
});

openButton.addEventListener("click", async () => {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<unknown> })
    .showDirectoryPicker;

  if (!picker) {
    setStatus("Folder picker unavailable in this browser.");
    return;
  }

  try {
    const directory = (await picker()) as Parameters<typeof loadBundleFromDirectory>[0];

    bundle = await loadBundleFromDirectory(directory);
    geometry = bundle.manifest.geometry?.type ?? "sphere";
    syncButtons();
    await rebuild();
  } catch (error) {
    if ((error as { name?: string }).name !== "AbortError") {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);

function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

async function main() {
  await renderer.init();
  resize();
  syncButtons();
  requestAnimationFrame(tick);

  try {
    bundle = await loadBundleFromUrl(BUNDLE_BASE);
    geometry = bundle.manifest.geometry?.type ?? "sphere";
    syncButtons();
    await rebuild();
  } catch (error) {
    setStatus(
      error instanceof Error
        ? `${error.message} Use "Open bundle folder" to load an exported project.`
        : String(error)
    );
  }
}

void main();
