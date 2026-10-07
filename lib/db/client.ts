import path from "node:path";
import { createRequire } from "node:module";
import { Pool, neonConfig } from "@neondatabase/serverless";
import type { PGlite as PGliteType } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Anything that can run queries: the db itself or an open transaction. */
export type Executor = DB | Tx;

export const LOCAL_PGLITE_DIR = ".pglite";

/**
 * Neon's WebSocket driver (needed for interactive transactions) when DATABASE_URL is set,
 * otherwise PGlite: on disk at `dir`, or in memory when `dir` is "memory://".
 */
export function createDb(opts: { url?: string; pgliteDir?: string } = {}): DB {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (url) {
    if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;
    return drizzleNeon({ client: new Pool({ connectionString: url }), schema }) as unknown as DB;
  }
  if (process.env.VERCEL && !opts.pgliteDir) {
    throw new Error("DATABASE_URL is not set");
  }
  // PGlite (≈25 MB of WASM) is a local-development/test fallback only. It is loaded lazily and
  // excluded from the deployed bundle (next.config.ts outputFileTracingExcludes).
  const req = createRequire(path.join(process.cwd(), "package.json"));
  const { PGlite } = req("@electric-sql/pglite") as { PGlite: typeof PGliteType };
  const { drizzle } = req("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const client = new PGlite(opts.pgliteDir ?? process.env.PGLITE_DIR ?? LOCAL_PGLITE_DIR);
  return drizzle({ client, schema }) as unknown as DB;
}
