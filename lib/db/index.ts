import "server-only";
import { createDb, type DB } from "./client";

const globalForDb = globalThis as unknown as { __farmDb?: DB };

/**
 * Shared database handle, created on first use (so `next build` doesn't need a database).
 * Uses Neon (DATABASE_URL) in production and falls back to a local PGlite database in
 * `.pglite/` for development. Cached on globalThis so dev hot-reloads reuse one PGlite.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = (globalForDb.__farmDb ??= createDb());
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
