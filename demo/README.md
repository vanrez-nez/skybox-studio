# Skybox Studio — standalone demos

Two minimal vite + three.js demos that exercise the skybox outside the editor.

## Setup

The runtime is consumed as a built package, so build it first, then install the demo:

```bash
cd ../src/runtime && npm run build   # produces src/runtime/dist
cd ../../demo && npm install
npm run dev
```

Open the printed URL and pick a scenario from the landing page.

## Scenario 1 — Exported image (no runtime)

`scenario1.html` / `src/scenario1.ts`. Pure three.js (does **not** import the runtime).
Pick an exported equirect PNG (the editor's image export) and view it as:

- **Cube Skybox** — the equirect set as `scene.background`.
- **Skydome** — a BackSide `SphereGeometry` textured with the equirect.

Drag to look around, scroll to zoom.

## Scenario 2 — Runtime (Live / Baked)

`scenario2.html` / `src/scenario2.ts`. Uses `skybox-studio-runtime` only. Loads a project
bundle (`manifest.json` + `assets/<hash>.png`) — by default the bundled
`public/sample-project/`, or click **Open bundle folder…** to pick an unzipped editor export.

- **Live** — the original layers via `Skybox` (`setRenderMode("auto")`); image layers get their
  textures through `setImageTextures`. Requires a WebGPU-capable browser.
- **Baked** — the manifest flattened to a single equirect texture with `createBakedSkyboxTexture`
  (image pixels are decoded from the PNG assets first), applied via `setBakedTexture`.

Toggle Sphere/Box geometry. The included sample uses only procedural layers (gradient +
field-gradient). To see image/spot/starfield layers, **export a project bundle from the editor**
(Export dialog → "Export project"), unzip it, and load the folder.
