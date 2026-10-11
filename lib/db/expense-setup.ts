// One-off helper: add expenses from a build step (the production DB can't be reached from a laptop).
// Uses the normal create path, so each row is validated and audit-logged like one entered in the
// app, and the `clientId` makes it idempotent (a repeat run never adds it twice).
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "./client";
import { writeAudit } from "./audit";
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
    /** true = if this entry already exists (and is not voided), correct its amount/description */
    update: z.boolean().default(false),
  }),
);
export type ExpenseSetup = z.input<typeof expenseSetupInput>;

export type ExpenseSetupResult = { clientId: string; action: "created" | "exists" | "updated"; id: number };

export async function applyExpenseSetup(db: DB, raw: ExpenseSetup): Promise<ExpenseSetupResult[]> {
  const items = expenseSetupInput.parse(raw);
  const out: ExpenseSetupResult[] = [];
  for (const it of items) {
    const [existing] = await db.select().from(expenses).where(eq(expenses.clientId, it.clientId));
    if (existing) {
      const changed = existing.amount !== it.amount || existing.description !== it.description;
      if (it.update && !existing.voidedAt && changed) {
        await db.transaction(async (tx) => {
          const [after] = await tx
            .update(expenses)
            .set({ amount: it.amount, description: it.description, updatedAt: new Date() })
            .where(eq(expenses.id, existing.id))
            .returning();
          await writeAudit(tx, { actorId: null, action: "update", tableName: "expenses", rowId: existing.id, before: existing, after });
        });
        out.push({ clientId: it.clientId, action: "updated", id: existing.id });
      } else {
        out.push({ clientId: it.clientId, action: "exists", id: existing.id });
      }
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
