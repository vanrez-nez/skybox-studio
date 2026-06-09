// Scenario 2: load an editor project bundle (manifest.json + hashed assets) and
// render it with the runtime package in isolation. Live = original layers via the
// Skybox material; Baked = the whole manifest flattened to one equirect texture.
import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  Skybox,
  createBakedSkyboxTexture,
  loadBundleFromDirectory,
  loadBundleFromUrl,
  loadBundleFromZip,
  loadSkyboxImageTextures,
  rehydrateImagePixels,
  type Bundle,
  type LoadProgress,
} from "skybox-studio-runtime";
// Enable starfield generation: importing this entry registers the GPU bake-service factory + CPU
// sampler so loaded bundles that contain a starfield layer render (it's split out of the core so
// consumers that never use starfields don't pay for it).
import "skybox-studio-runtime/starfield";

const BAKE_WIDTH = 1024;
const BUNDLE_BASE = new URL("sample-project/", window.location.href).href;

const app = document.getElementById("app") as HTMLDivElement;
const liveButton = document.getElementById("mode-live") as HTMLButtonElement;
const bakedButton = document.getElementById("mode-baked") as HTMLButtonElement;
const sphereButton = document.getElementById("geo-sphere") as HTMLButtonElement;
const boxButton = document.getElementById("geo-box") as HTMLButtonElement;
const openButton = document.getElementById("open") as HTMLButtonElement;
const openZipButton = document.getElementById("open-zip") as HTMLButtonElement;
const zipInput = document.getElementById("zip-input") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;

const renderer = new THREE.WebGPURenderer({ antialias: true });

renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
camera.position.set(0, 0, 1);

// Standard three.js OrbitControls, set up for looking around from inside the skybox.
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.enableZoom = false; // scroll rotates instead of zooming (see wheel handler below)
controls.rotateSpeed = -0.4; // invert so dragging feels like grabbing the sky from inside
controls.minPolarAngle = 0.01; // keep just shy of the poles to avoid flipping over the top
controls.maxPolarAngle = Math.PI - 0.01;

// Scroll rotates both axes: horizontal delta → azimuth, vertical delta → polar.
// rotateLeft/rotateUp are OrbitControls' public programmatic-rotation API (each calls update()).
renderer.domElement.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();

    const rotateSpeed = 0.0025;

    controls.rotateLeft(event.deltaX * rotateSpeed);
    controls.rotateUp(event.deltaY * rotateSpeed);
  },
  { passive: false }
);

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

function reportProgress(event: LoadProgress) {
  if (event.total > 0) {
    setStatus(`Loading assets ${event.loaded}/${event.total}…`);
  }
}

async function loadImageTextures(current: Bundle): Promise<Record<string, THREE.Texture>> {
  // Reuse the runtime loader (wraps THREE.TextureLoader) so progress is reported for every source.
  const textures = await loadSkyboxImageTextures(current, { onProgress: reportProgress });

  return Object.fromEntries(textures) as Record<string, THREE.Texture>;
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

openZipButton.addEventListener("click", () => {
  zipInput.click();
});

zipInput.addEventListener("change", async () => {
  const file = zipInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    setStatus("Unzipping…");
    bundle?.dispose();
    bundle = await loadBundleFromZip(file);
    geometry = bundle.manifest.geometry?.type ?? "sphere";
    syncButtons();
    await rebuild();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    zipInput.value = "";
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
  // Keep the skydome centered on the camera so it always surrounds us — OrbitControls orbits the
  // camera at a radius around the origin, which would otherwise leave it sitting on/outside the
  // unit-sphere dome (rendering it as a ball with black corners).
  skybox?.position.copy(camera.position);
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
