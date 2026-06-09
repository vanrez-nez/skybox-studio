# Skybox Studio

A browser-based editor for authoring skyboxes — gradients, field gradients, spots, images, and
procedural starfields — composited live with WebGPU and exportable as equirectangular textures or
project bundles.

Built with React, Vite, and Three.js. The rendering/baking logic lives in the
[`skybox-studio-runtime`](./src/runtime) submodule, which the editor imports directly from source via
the `@/runtime` alias.

## Getting started

```bash
git clone --recurse-submodules https://github.com/vanrez-nez/skybox-studio.git
cd skybox-studio
npm install
npm run dev
```

Already cloned without submodules? Pull the runtime in with:

```bash
git submodule update --init --recursive
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check (`tsc --noEmit`) and build to `dist/`. |
| `npm run preview` | Preview the production build locally (served under the `/skybox-studio/` base). |
| `npm run deploy` | Build and publish `dist/` to the `site` branch (GitHub Pages). |

## Deployment

The app is hosted on GitHub Pages from the **`site`** branch:

```bash
npm run deploy
```

This builds with base `/skybox-studio/` and pushes the output to `site` via `gh-pages`. In the repo,
set **Settings → Pages → Source → Deploy from a branch → `site` / root** (one-time). Live at
<https://vanrez-nez.github.io/skybox-studio/>.
