import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * The path aliases and externals live in vite.config.ts so that `vite-node`
 * (the scripts/ CLIs) resolves them the same way Vitest does. Merge rather than
 * repeat, so the two can never drift.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
  }),
);
