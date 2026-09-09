import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Cambia BASE_PATH si renombras el repositorio de GitHub.
const BASE_PATH = "/Facturtaxi/";

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "stream", "crypto"],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
});
