import { createDb, type DB } from "./client";
import { runMigrations, seed } from "./setup";

/** Fresh in-memory Postgres (PGlite) with migrations + seeds and known PINs, for tests. */
export async function createTestDb(): Promise<DB> {
  const db = createDb({ url: "", pgliteDir: "memory://" });
  await runMigrations(db, "pglite");
  await seed(db, { pins: ["111111", "222222", "333333"] });
  return db;
}
