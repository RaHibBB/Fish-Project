import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DATA_TAG } from "./cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, categories, contributions, expenses, withdrawals } from "@/lib/db/schema";
import type { EntryKind } from "@/lib/ledger";

export const ENTRY_KINDS = ["expense", "contribution", "withdrawal"] as const;

export function isEntryKind(k: string): k is EntryKind {
  return (ENTRY_KINDS as readonly string[]).includes(k);
}

const TABLE_NAMES = { expense: "expenses", contribution: "contributions", withdrawal: "withdrawals" } as const;

export async function getExpense(id: number) {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id));
  return row ?? null;
}

export async function getContribution(id: number) {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  const [row] = await db.select().from(contributions).where(eq(contributions.id, id));
  return row ?? null;
}

export async function getWithdrawal(id: number) {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
  return row ?? null;
}

export async function getEntryHistory(kind: EntryKind, id: number) {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.tableName, TABLE_NAMES[kind]), eq(auditLog.rowId, id)))
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id));
}

export async function getCategory(id: number) {
  "use cache: remote";
  cacheTag(DATA_TAG);
  cacheLife("max");
  const [c] = await db.select().from(categories).where(eq(categories.id, id));
  return c ?? null;
}
