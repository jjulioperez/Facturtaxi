import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Cambia BASE_PATH si renombras el repositorio de GitHub.
const BASE_PATH = "/Facturtaxi/";

export default defineConfig(({ mode }) => ({
  // La app empaquetada con Capacitor (APK) sirve los archivos desde la raíz,
  // no bajo /Facturtaxi/ como GitHub Pages. Por eso el build para Android
  // usa "vite build --mode capacitor" (ver npm run build:apk).
  base: mode === "capacitor" ? "/" : BASE_PATH,
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "stream", "crypto"],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
}));
