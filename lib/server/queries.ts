import "server-only";
import { connection } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, contributions, expenses, partners, settings, withdrawals } from "@/lib/db/schema";
import { DEFAULT_LABOUR_WAGE } from "@/lib/db/seed-data";

// Every read calls connection(): money data must be read per request, never baked in at build time.

export type PartnerOption = { id: number; name: string; shareBp: number };
export type CategoryOption = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  archived: boolean;
};

export async function getSettings() {
  await connection();
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return s ?? { id: 1, labourDailyWage: DEFAULT_LABOUR_WAGE, farmName: "চৌধুরী ব্রাদার্স এগ্রো", startDate: null };
}

export async function getPartners(): Promise<PartnerOption[]> {
  await connection();
  return db
    .select({ id: partners.id, name: partners.name, shareBp: partners.shareBp })
    .from(partners)
    .orderBy(asc(partners.sortOrder), asc(partners.id));
}

export async function getCategories(): Promise<CategoryOption[]> {
  await connection();
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      archived: categories.archived,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
}

/**
 * Every expense, contribution and withdrawal (voided ones included, so they can be shown).
 * The farm has a few hundred rows a year, so computing totals in memory with lib/money.ts
 * keeps one tested code path for every screen.
 */
export async function getLedger() {
  await connection();
  const [e, c, w] = await Promise.all([
    db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.id)),
    db.select().from(contributions).orderBy(desc(contributions.date), desc(contributions.id)),
    db.select().from(withdrawals).orderBy(desc(withdrawals.date), desc(withdrawals.id)),
  ]);
  return { expenses: e, contributions: c, withdrawals: w };
}

/** Most recent non-voided expense, for the "আগেরটা আবার" button. */
export async function getLastExpense() {
  await connection();
  const rows = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.createdAt), desc(expenses.id))
    .limit(20);
  return rows.find((r) => r.voidedAt === null) ?? null;
}
