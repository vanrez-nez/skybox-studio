import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import appPkg from "./package.json" with { type: "json" };
import runtimePkg from "./src/runtime/package.json" with { type: "json" };

const SPLASH_ASSET = "assets/splash.webp";

// Emit load-manifest.json — the app's JS/CSS chunks plus the eager splash image, with their UNCOMPRESSED
// byte sizes. The splash preloader (src/lib/preload.ts) streams these to drive a real 0–100% bar;
// uncompressed sizes make decompressed stream bytes match the total even when the host gzips.
//
// Lazy workers are deliberately excluded: neither image export nor terrain generation is needed for
// the initial editor view, so counting those chunks would make the boot bar wait on bytes nothing
// needs. Non-CSS bundler assets (sourcemaps included) are skipped the same way.
function loadManifestPlugin(): Plugin {
  return {
    name: "load-manifest",
    apply: "build",
    generateBundle(_options, bundle) {
      const entries: { url: string; bytes: number }[] = [];
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === "chunk") {
          if (
            fileName.includes("texture-baking.worker") ||
            fileName.includes("terrain.worker")
          ) {
            continue;
          }
          entries.push({ url: fileName, bytes: Buffer.byteLength(output.code) });
        } else if (fileName.endsWith(".css")) {
          const source = output.source;
          entries.push({
            url: fileName,
            bytes: typeof source === "string" ? Buffer.byteLength(source) : source.byteLength,
          });
        }
      }
      // Lives in public/, so it never enters the Rollup graph — measure it off disk.
      const splashPath = fileURLToPath(new URL(`./public/${SPLASH_ASSET}`, import.meta.url));
      entries.push({ url: SPLASH_ASSET, bytes: statSync(splashPath).size });
      this.emitFile({
        type: "asset",
        fileName: "load-manifest.json",
        source: JSON.stringify(entries),
      });
    },
  };
}

// Short hash of the HEAD commit, baked into a BUILD so the status bar can identify the exact released
// code. Appends "-dirty" when the tree has uncommitted changes so the marker never claims a clean commit
// it isn't. Only meaningful at build time — in dev the working tree is live/uncommitted, so we show "dev"
// instead of a commit that wouldn't represent what's actually running. Falls back to "unknown" when git
// is unavailable.
function gitCommitHash(): string {
  try {
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim().length > 0;

    return dirty ? `${hash}-dirty` : hash;
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/skybox-studio/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(appPkg.version),
    __RUNTIME_VERSION__: JSON.stringify(runtimePkg.version),
    // Only a real build gets a commit hash (representative of the released code); dev shows "dev".
    __COMMIT_HASH__: JSON.stringify(command === "build" ? gitCommitHash() : "dev"),
  },
  plugins: [react(), tailwindcss(), loadManifestPlugin()],
  resolve: {
    alias: {
      // More specific alias first: the editor imports the runtime's source directly
      // (the "Direct path") from the submodule's src/ root.
      "@/runtime": "/src/runtime/src",
      "@": "/src",
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
}));
