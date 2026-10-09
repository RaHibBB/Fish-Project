import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DATA_TAG } from "./cache";
import { asc, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, categories, contributions, expenses, feedings, partners, ponds, sales, settings, withdrawals } from "@/lib/db/schema";
import { DEFAULT_LABOUR_WAGE } from "@/lib/db/seed-data";

// Every read is cached in the shared cache under DATA_TAG and expired by dataChanged() on every
// write (see lib/server/cache.ts), so pages don't hit the database between changes.

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
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return (
    s ?? { id: 1, labourDailyWage: DEFAULT_LABOUR_WAGE, farmName: "চৌধুরী ব্রাদার্স এগ্রো", startDate: null, lowFundAlert: 10000 }
  );
}

/** Partners only (people with a share). Login-only admins are excluded from all money logic. */
export async function getPartners(): Promise<PartnerOption[]> {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  return db
    .select({ id: partners.id, name: partners.name, shareBp: partners.shareBp })
    .from(partners)
    .where(eq(partners.isPartner, true))
    .orderBy(asc(partners.sortOrder), asc(partners.id));
}

/** Everyone who can log in (partners and admins) — for names in history and the accounts list. */
export async function getPeople() {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  return db
    .select({ id: partners.id, name: partners.name, phone: partners.phone, isPartner: partners.isPartner })
    .from(partners)
    .orderBy(asc(partners.sortOrder), asc(partners.id));
}

export async function getCategories(): Promise<CategoryOption[]> {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
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
 * Every expense, contribution, withdrawal and sale (voided ones included, so they can be shown).
 * The farm has a few hundred rows a year, so computing totals in memory with lib/money.ts
 * keeps one tested code path for every screen.
 */
export async function getLedger() {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  const [e, c, w, s] = await Promise.all([
    db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.id)),
    db.select().from(contributions).orderBy(desc(contributions.date), desc(contributions.id)),
    db.select().from(withdrawals).orderBy(desc(withdrawals.date), desc(withdrawals.id)),
    db.select().from(sales).orderBy(desc(sales.date), desc(sales.id)),
  ]);
  return { expenses: e, contributions: c, withdrawals: w, sales: s };
}

/** Most recent non-voided expense, for the "আগেরটা আবার" button. */
export async function getLastExpense() {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  const rows = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.createdAt), desc(expenses.id))
    .limit(20);
  return rows.find((r) => r.voidedAt === null) ?? null;
}

export type PondOption = { id: number; name: string; archived: boolean };

export async function getPonds(): Promise<PondOption[]> {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  return db
    .select({ id: ponds.id, name: ponds.name, archived: ponds.archived })
    .from(ponds)
    .orderBy(asc(ponds.sortOrder), asc(ponds.id));
}

/** Feeding log, newest first (voided rows included so they stay visible). */
export async function getFeedings() {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  return db.select().from(feedings).orderBy(desc(feedings.date), desc(feedings.id)).limit(500);
}

/** Recent changes for the "পরিবর্তন" page (logins and PIN events left out). */
export async function getActivity(limit = 200) {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  return db
    .select()
    .from(auditLog)
    .where(notInArray(auditLog.action, ["login", "login_failed", "login_locked", "change_pin", "reset_pin"]))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit);
}
