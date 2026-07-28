import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import appPkg from "./package.json" with { type: "json" };
import runtimePkg from "./src/runtime/package.json" with { type: "json" };

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
  plugins: [react(), tailwindcss()],
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
