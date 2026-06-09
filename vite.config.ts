import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/skybox-studio/" : "/",
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
