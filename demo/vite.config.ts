import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // The runtime package is symlinked (file:../src/runtime) and imports `three`
  // bare; without dedupe its imports resolve to a different three copy than the
  // demo's `three/webgpu`, producing "Multiple instances of Three.js" + broken
  // TSL ("No stack defined"). Force a single three instance.
  resolve: {
    dedupe: ["three"],
  },
  optimizeDeps: {
    include: ["three", "three/webgpu", "three/tsl"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        scenario1: resolve(__dirname, "scenario1.html"),
        scenario2: resolve(__dirname, "scenario2.html"),
      },
    },
  },
});
