import { beforeAll, describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { todayISO } from "@/lib/format";
import { fundBalance, partnerPositions } from "@/lib/money";
import type { DB } from "./client";
import { applyLedgerReset } from "./ledger-reset";
import { createContribution, createExpense } from "./mutations";
import { categories, contributions, expenses, partners, withdrawals } from "./schema";
import { createTestDb } from "./test-db";

let db: DB;
beforeAll(async () => {
  db = await createTestDb();
  const ps = await db.select().from(partners).orderBy(partners.sortOrder);
  for (const p of ps) await createContribution(db, null, { date: "2026-04-16", partnerId: p.id, amount: 100000 });
  const [cat] = await db.select().from(categories).limit(1);
  await createExpense(db, null, { date: "2026-05-01", categoryId: cat.id, amount: 4000, paidByPartnerId: null });
  await createExpense(db, null, { date: "2026-05-02", categoryId: cat.id, amount: 1500, paidByPartnerId: ps[1].id });
}, 30_000);

const reset = {
  clientId: "reset-test-0001",
  date: todayISO(),
  categorySlug: "other",
  totalCost: 300000,
  description: "মোট খরচ একসাথে",
  voidReason: "নতুন করে শুরু",
  contributions: {
    রাফি: { amount: 80000, note: "" },
    রিয়াজ: { amount: 140000, note: "" },
    অভি: { amount: 80000, note: "" },
  },
};
const ledger = async () => ({
  expenses: await db.select().from(expenses),
  contributions: await db.select().from(contributions),
  withdrawals: await db.select().from(withdrawals),
});

describe("applyLedgerReset", () => {
  it("voids every old expense (kept, not deleted) and leaves one total-cost entry", async () => {
    const res = await applyLedgerReset(db, reset);
    expect(res).toMatchObject({ skipped: false, voided: 2 });
    expect(await db.$count(expenses)).toBe(3);
    const active = await db.select().from(expenses).where(isNull(expenses.voidedAt));
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ amount: 300000, paidByPartnerId: null, clientId: "reset-test-0001" });
    const voided = await db.select().from(expenses).where(eq(expenses.voidReason, "নতুন করে শুরু"));
    expect(voided).toHaveLength(2);
  });

  it("sets the contributions: cash box = put in − total cost, positions sum to zero", async () => {
    const l = await ledger();
    expect(l.contributions.map((c) => c.amount).sort((a, b) => a - b)).toEqual([80000, 80000, 140000]);
    expect(fundBalance(l)).toBe(0);
    const ps = await db.select().from(partners).orderBy(partners.sortOrder);
    const pos = partnerPositions(l, ps);
    expect(pos.reduce((a, p) => a + p.net, 0)).toBe(0);
    expect(pos.every((p) => p.paidPersonally === 0)).toBe(true);
  });

  it("is safe to run twice", async () => {
    const res = await applyLedgerReset(db, reset);
    expect(res.skipped).toBe(true);
    expect(await db.$count(expenses)).toBe(3);
  });
});
