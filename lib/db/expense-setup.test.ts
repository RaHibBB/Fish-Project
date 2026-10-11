import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { todayISO } from "@/lib/format";
import { fundBalance } from "@/lib/money";
import type { DB } from "./client";
import { applyExpenseSetup } from "./expense-setup";
import { createContribution } from "./mutations";
import { contributions, expenses, partners, withdrawals } from "./schema";
import { createTestDb } from "./test-db";

let db: DB;
beforeAll(async () => {
  db = await createTestDb();
  const [p] = await db.select().from(partners).orderBy(partners.sortOrder);
  await createContribution(db, null, { date: "2026-04-16", partnerId: p.id, amount: 90000 });
}, 30_000);

const item = {
  clientId: "setup-test-0001",
  date: todayISO(),
  categorySlug: "other",
  amount: 90000,
  description: "একসাথে ধরা খরচ (পরীক্ষা)",
  paidBy: "fund",
};
const ledger = async () => ({
  expenses: await db.select().from(expenses),
  contributions: await db.select().from(contributions),
  withdrawals: await db.select().from(withdrawals),
});

describe("applyExpenseSetup", () => {
  it("adds a fund expense that brings the cash box to zero", async () => {
    expect(fundBalance(await ledger())).toBe(90000);
    const res = await applyExpenseSetup(db, [item]);
    expect(res[0].action).toBe("created");
    expect(fundBalance(await ledger())).toBe(0);
  });

  it("never adds the same entry twice", async () => {
    const res = await applyExpenseSetup(db, [item]);
    expect(res[0].action).toBe("exists");
    expect(await db.$count(expenses, eq(expenses.clientId, "setup-test-0001"))).toBe(1);
  });

  it("corrects the amount of an existing entry only when asked, and logs before/after", async () => {
    const same = await applyExpenseSetup(db, [{ ...item, amount: 85000 }]);
    expect(same[0].action).toBe("exists"); // no update flag → untouched
    const res = await applyExpenseSetup(db, [{ ...item, amount: 85000, update: true }]);
    expect(res[0].action).toBe("updated");
    const [row] = await db.select().from(expenses).where(eq(expenses.clientId, "setup-test-0001"));
    expect(row.amount).toBe(85000);
    const again = await applyExpenseSetup(db, [{ ...item, amount: 85000, update: true }]);
    expect(again[0].action).toBe("exists");
  });

  it("rejects an unknown category or partner", async () => {
    await expect(applyExpenseSetup(db, [{ ...item, clientId: "setup-test-0002", categorySlug: "nope" }])).rejects.toThrow();
    await expect(applyExpenseSetup(db, [{ ...item, clientId: "setup-test-0003", paidBy: "কেউনা" }])).rejects.toThrow();
  });
});
