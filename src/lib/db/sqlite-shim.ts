import type { DatabaseSync as DatabaseSyncCtor } from "node:sqlite";

/**
 * `node:sqlite` is a builtin, but Vite's builtin list predates Node 22.5, so it
 * strips the `node:` prefix, fails to recognise `sqlite`, and then tries to
 * resolve it from node_modules. `vite.config.ts` aliases this module in its
 * place for Vitest and `vite-node`.
 *
 * Next.js is unaffected: it recognises `node:` builtins itself and never reads
 * the Vite config, so the production build keeps the ordinary static import.
 *
 * `process.getBuiltinModule` resolves the builtin at runtime with no `require`
 * and no `import.meta`, which keeps this file valid in every module format.
 */
const builtin = process.getBuiltinModule("node:sqlite") as {
  DatabaseSync: typeof DatabaseSyncCtor;
};

export const DatabaseSync = builtin.DatabaseSync;
export type { DatabaseSyncCtor };
