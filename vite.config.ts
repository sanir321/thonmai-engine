import { defineConfig } from "vite";
import path from "node:path";

/**
 * Shared path aliases for the tooling that is not Next: Vitest and `vite-node`
 * (used by the scripts/ CLIs). Next reads tsconfig `paths` on its own.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@data": path.resolve(__dirname, "./data"),
      // See sqlite-shim.ts: Vite cannot resolve `node:sqlite` on its own.
      "node:sqlite": path.resolve(__dirname, "./src/lib/db/sqlite-shim.ts"),
    },
  },
  ssr: {
    // No externals needed: the app does no local text recognition, so there is no
    // worker or wasm package left to keep out of the SSR bundle.
    external: [],
  },
});
