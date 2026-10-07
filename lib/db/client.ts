import { Pool, neonConfig } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
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
  if (process.env.NODE_ENV === "production" && !opts.pgliteDir) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = new PGlite(opts.pgliteDir ?? process.env.PGLITE_DIR ?? LOCAL_PGLITE_DIR);
  return drizzlePglite({ client, schema }) as unknown as DB;
}
