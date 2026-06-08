## Use the `.zip` directly

Keep the exported `.zip` as-is and load it at runtime — great for a file picker, drag-and-drop, or fetching a single bundle URL.

### 1. Install

```bash
npm install skybox-studio-runtime three
```

### 2. Render it (minimal three.js)

```js
import * as THREE from "three";
import { Skybox, loadSkyboxBundle } from "skybox-studio-runtime";

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);

// `source` can be a File (from <input type="file">), a Blob, an ArrayBuffer, or a URL to the .zip.
async function showSkybox(source) {
  const { manifest, imageTextures } = await loadSkyboxBundle(source, {
    onProgress: ({ loaded, total }) => console.log(`assets ${loaded}/${total}`),
  });

  const skybox = new Skybox()
    .setRenderer(renderer)
    .fromManifest(manifest)
    .setImageTextures(imageTextures);

  skybox.load();
  scene.add(skybox);
}

// Example: load from a file input.
document.querySelector("input[type=file]").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) void showSkybox(file);
});

renderer.setAnimationLoop(() => renderer.render(scene, camera));
```

`loadSkyboxBundle` unzips the bundle, reads `manifest.json`, and loads every image asset (PNG/JPEG/WebP) with progress reporting.

[Full API & docs on npm →](https://www.npmjs.com/package/skybox-studio-runtime)
