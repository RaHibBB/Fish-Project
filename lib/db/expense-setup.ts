// One-off helper: add expenses from a build step (the production DB can't be reached from a laptop).
// Uses the normal create path, so each row is validated and audit-logged like one entered in the
// app, and the `clientId` makes it idempotent (a repeat run never adds it twice).
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "./client";
import { createExpense } from "./mutations";
import { categories, expenses, partners } from "./schema";

export const expenseSetupInput = z.array(
  z.object({
    /** unique, stable id for this entry — what makes the step safe to run twice */
    clientId: z.string().min(8).max(64),
    date: z.string(),
    categorySlug: z.string(),
    amount: z.number().int().min(1),
    description: z.string().max(200),
    /** "fund" or a partner's name */
    paidBy: z.string().default("fund"),
  }),
);
export type ExpenseSetup = z.input<typeof expenseSetupInput>;

export type ExpenseSetupResult = { clientId: string; action: "created" | "exists"; id: number };

export async function applyExpenseSetup(db: DB, raw: ExpenseSetup): Promise<ExpenseSetupResult[]> {
  const items = expenseSetupInput.parse(raw);
  const out: ExpenseSetupResult[] = [];
  for (const it of items) {
    const [existing] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.clientId, it.clientId));
    if (existing) {
      out.push({ clientId: it.clientId, action: "exists", id: existing.id });
      continue;
    }
    const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, it.categorySlug));
    if (!cat) throw new Error(`unknown category slug "${it.categorySlug}"`);
    let paidByPartnerId: number | null = null;
    if (it.paidBy !== "fund") {
      const [p] = await db.select({ id: partners.id }).from(partners).where(eq(partners.name, it.paidBy));
      if (!p) throw new Error(`unknown partner "${it.paidBy}"`);
      paidByPartnerId = p.id;
    }
    const row = await createExpense(db, null, {
      date: it.date,
      categoryId: cat.id,
      amount: it.amount,
      description: it.description,
      paidByPartnerId,
      clientId: it.clientId,
    });
    out.push({ clientId: it.clientId, action: "created", id: row.id });
  }
  return out;
}
