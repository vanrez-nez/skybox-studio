// Scenario 1: display an exported equirect image on a Cube Skybox and a Skydome,
// using ONLY plain three.js (no runtime package). The image is the editor's baked
// equirect PNG export, chosen via the file picker.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";

type SkyMode = "cube" | "dome";

const app = document.getElementById("app") as HTMLDivElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const cubeButton = document.getElementById("mode-cube") as HTMLButtonElement;
const domeButton = document.getElementById("mode-dome") as HTMLButtonElement;
const fovInput = document.getElementById("fov") as HTMLInputElement;
const fovValue = document.getElementById("fov-value") as HTMLSpanElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
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

// Inside-out sphere used for "Skydome" mode.
const domeMesh = new THREE.Mesh(
  new THREE.SphereGeometry(10, 64, 32),
  new THREE.MeshBasicMaterial({ side: THREE.BackSide })
);
domeMesh.visible = false;
scene.add(domeMesh);

let texture: THREE.Texture | null = null;
let mode: SkyMode = "cube";

function applyMode() {
  cubeButton.dataset.active = String(mode === "cube");
  domeButton.dataset.active = String(mode === "dome");

  if (mode === "cube") {
    domeMesh.visible = false;
    scene.background = texture;
    return;
  }

  scene.background = null;
  domeMesh.visible = true;
}

function setTexture(next: THREE.Texture, isHdr: boolean) {
  texture?.dispose();
  texture = next;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  // EXR is linear HDR (EXRLoader already tags it linear); LDR images are sRGB. Tone-map HDR down
  // to the SDR display, leave LDR untouched.
  texture.colorSpace = isHdr ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  renderer.toneMapping = isHdr ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;

  const material = domeMesh.material as THREE.MeshBasicMaterial;

  material.map = texture;
  material.needsUpdate = true;
  applyMode();
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];

  if (!file) {
    return;
  }

  const url = URL.createObjectURL(file);
  const isExr = /\.exr$/i.test(file.name);
  const loader = isExr ? new EXRLoader() : new THREE.TextureLoader();

  loader.load(
    url,
    (loaded) => {
      setTexture(loaded, isExr);
      URL.revokeObjectURL(url);
    },
    undefined,
    () => {
      URL.revokeObjectURL(url);
    }
  );
});

cubeButton.addEventListener("click", () => {
  mode = "cube";
  applyMode();
});

domeButton.addEventListener("click", () => {
  mode = "dome";
  applyMode();
});

// FOV selector: there's no runtime here, so this just changes the camera — useful for eyeballing
// how a starfield baked at a given export FOV looks when viewed at a wider/narrower FOV.
fovInput.addEventListener("input", () => {
  camera.fov = Number(fovInput.value);
  camera.updateProjectionMatrix();
  fovValue.textContent = `${Math.round(camera.fov)}°`;
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();
applyMode();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
