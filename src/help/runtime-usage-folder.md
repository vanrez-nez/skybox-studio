## Unzip into a folder

Unzip the bundle and serve the folder (it contains `manifest.json` + an `assets/` directory). Best when you ship the skybox as static files alongside your app.

### 1. Install

```bash
npm install skybox-studio-runtime three
```

### 2. Render it (minimal three.js)

```js
import * as THREE from "three";
import { Skybox, loadBundleFromUrl, loadSkyboxImageTextures } from "skybox-studio-runtime";

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);

// Point at the folder you unzipped (it must contain manifest.json).
const bundle = await loadBundleFromUrl("/skybox/");
const imageTextures = await loadSkyboxImageTextures(bundle, {
  onProgress: ({ loaded, total }) => console.log(`assets ${loaded}/${total}`),
});

const skybox = new Skybox()
  .setRenderer(renderer)
  .fromManifest(bundle.manifest)
  .setImageTextures(imageTextures);

skybox.load();
scene.add(skybox);

renderer.setAnimationLoop(() => renderer.render(scene, camera));
```

Prefer letting the user pick a local folder? Swap `loadBundleFromUrl` for `loadBundleFromDirectory(dirHandle)` (File System Access API) — the rest stays the same.

[Full API & docs on npm →](https://www.npmjs.com/package/skybox-studio-runtime)
