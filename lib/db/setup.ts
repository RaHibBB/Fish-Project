import path from "node:path";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { DB } from "./client";
import { categories, partners, settings } from "./schema";
import { DEFAULT_LABOUR_WAGE, SEED_CATEGORIES, SEED_PARTNERS } from "./seed-data";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export async function runMigrations(db: DB, driver: "neon" | "pglite") {
  if (driver === "neon") {
    await migrateNeon(db as unknown as NeonDatabase, { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    await migratePglite(db as unknown as PgliteDatabase, { migrationsFolder: MIGRATIONS_FOLDER });
  }
}

export type SeededPartner = { name: string; phone: string; pin: string };

/**
 * Idempotent: inserts settings, missing categories and (only if there are no partners yet)
 * the three partners with random temporary PINs, which are returned so they can be shown once.
 */
export async function seed(
  db: DB,
  opts: { phones?: string[]; pins?: string[] } = {},
): Promise<{ partners: SeededPartner[] }> {
  await db
    .insert(settings)
    .values({ id: 1, labourDailyWage: DEFAULT_LABOUR_WAGE })
    .onConflictDoNothing();

  await db
    .insert(categories)
    .values(SEED_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i + 1 })))
    .onConflictDoNothing({ target: categories.slug });

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(partners);
  if (count > 0) return { partners: [] };

  const phones = opts.phones ?? ["01700000001", "01700000002", "01700000003"];
  if (phones.length !== SEED_PARTNERS.length) {
    throw new Error(`Expected ${SEED_PARTNERS.length} phone numbers, got ${phones.length}`);
  }
  const created: SeededPartner[] = [];
  for (const [i, p] of SEED_PARTNERS.entries()) {
    const pin = opts.pins?.[i] ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.insert(partners).values({
      name: p.name,
      phone: phones[i],
      pinHash: await bcrypt.hash(pin, 10),
      shareBp: p.shareBp,
      mustChangePin: true,
      sortOrder: i + 1,
    });
    created.push({ name: p.name, phone: phones[i], pin });
  }
  return { partners: created };
}
