// One-off "start fresh from today": every existing expense is voided (kept visible as বাতিল, never
// deleted), each partner's fund contribution is set to what they have put in, and ONE expense holds
// the total spent so far. Runs from a build step (the production DB isn't reachable from a laptop),
// is audit-logged, and does nothing if its `clientId` expense already exists.
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "./client";
import { writeAudit } from "./audit";
import { applyFundContributions } from "./contribution-fix";
import { categories, expenses } from "./schema";

export const ledgerResetInput = z.object({
  clientId: z.string().min(8).max(64),
  date: z.string(),
  categorySlug: z.string(),
  /** total spent so far, as one entry paid from the fund */
  totalCost: z.number().int().min(1),
  description: z.string().max(200),
  voidReason: z.string().min(2).max(200),
  /** partner name → what they put in */
  contributions: z.record(z.string(), z.object({ amount: z.number().int().min(1), note: z.string().max(200).default("") })),
});
export type LedgerReset = z.input<typeof ledgerResetInput>;

export type LedgerResetResult = { skipped: boolean; voided: number; expenseId: number };

export async function applyLedgerReset(db: DB, raw: LedgerReset): Promise<LedgerResetResult> {
  const setup = ledgerResetInput.parse(raw);
  const [done] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.clientId, setup.clientId));
  if (done) return { skipped: true, voided: 0, expenseId: done.id };

  const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, setup.categorySlug));
  if (!cat) throw new Error(`unknown category slug "${setup.categorySlug}"`);

  await applyFundContributions(db, { date: setup.date, contributions: setup.contributions });

  return db.transaction(async (tx) => {
    const active = await tx.select().from(expenses).where(isNull(expenses.voidedAt));
    const now = new Date();
    for (const before of active) {
      const [after] = await tx
        .update(expenses)
        .set({ voidReason: setup.voidReason, voidedAt: now })
        .where(eq(expenses.id, before.id))
        .returning();
      await writeAudit(tx, { actorId: null, action: "void", tableName: "expenses", rowId: before.id, before, after });
    }
    const [row] = await tx
      .insert(expenses)
      .values({
        date: setup.date,
        categoryId: cat.id,
        amount: setup.totalCost,
        description: setup.description,
        paidByPartnerId: null,
        clientId: setup.clientId,
      })
      .returning();
    await writeAudit(tx, { actorId: null, action: "create", tableName: "expenses", rowId: row.id, after: row });
    return { skipped: false, voided: active.length, expenseId: row.id };
  });
}
