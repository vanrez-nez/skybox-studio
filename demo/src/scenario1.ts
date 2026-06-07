// Scenario 1: display an exported equirect image on a Cube Skybox and a Skydome,
// using ONLY plain three.js (no runtime package). The image is the editor's baked
// equirect PNG export, chosen via the file picker.
import * as THREE from "three";

import { createLookControls } from "./look-controls";

type SkyMode = "cube" | "dome";

const app = document.getElementById("app") as HTMLDivElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const cubeButton = document.getElementById("mode-cube") as HTMLButtonElement;
const domeButton = document.getElementById("mode-dome") as HTMLButtonElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
const controls = createLookControls(camera, renderer.domElement);

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

function setTexture(next: THREE.Texture) {
  texture?.dispose();
  texture = next;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

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

  new THREE.TextureLoader().load(url, (loaded) => {
    setTexture(loaded);
    URL.revokeObjectURL(url);
  });
});

cubeButton.addEventListener("click", () => {
  mode = "cube";
  applyMode();
});

domeButton.addEventListener("click", () => {
  mode = "dome";
  applyMode();
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
