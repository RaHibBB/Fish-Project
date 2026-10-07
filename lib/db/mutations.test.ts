import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { addDays, todayISO } from "@/lib/format";
import type { DB } from "./client";
import { auditLog, categories, expenses, partners } from "./schema";
import { createContribution, createExpense, createWithdrawal, updateExpense, voidRow } from "./mutations";
import { createTestDb } from "./test-db";

let db: DB;
let rafi: number;
let labour: number;
let feed: number;

beforeAll(async () => {
  db = await createTestDb();
  [{ id: rafi }] = await db.select().from(partners).where(eq(partners.name, "রাফি"));
  [{ id: labour }] = await db.select().from(categories).where(eq(categories.slug, "labour"));
  [{ id: feed }] = await db.select().from(categories).where(eq(categories.slug, "feed"));
}, 30_000);

const audits = (table: string, rowId: number) =>
  db.select().from(auditLog).where(and(eq(auditLog.tableName, table), eq(auditLog.rowId, rowId)));

describe("expenses", () => {
  it("creates a labour expense with an audit row", async () => {
    const row = await createExpense(db, rafi, {
      date: todayISO(),
      categoryId: labour,
      amount: 4920,
      paidByPartnerId: null,
      labourCount: 6,
      labourRate: 820,
    });
    expect(row).toMatchObject({ amount: 4920, labourCount: 6, labourRate: 820, paidByPartnerId: null, createdBy: rafi });
    const log = await audits("expenses", row.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: "create", actorId: rafi });
  });

  it("rejects labour amounts that don't match count × rate", async () => {
    await expect(
      createExpense(db, rafi, {
        date: todayISO(),
        categoryId: labour,
        amount: 5000,
        paidByPartnerId: null,
        labourCount: 6,
        labourRate: 820,
      }),
    ).rejects.toThrow();
  });

  it("requires a category, a positive amount and a non-future date", async () => {
    const base = { date: todayISO(), categoryId: feed, amount: 100, paidByPartnerId: null };
    await expect(createExpense(db, rafi, { ...base, categoryId: 0 })).rejects.toThrow();
    await expect(createExpense(db, rafi, { ...base, categoryId: 9999 })).rejects.toThrow("unknown_category");
    await expect(createExpense(db, rafi, { ...base, amount: 0 })).rejects.toThrow();
    await expect(createExpense(db, rafi, { ...base, amount: 12.5 })).rejects.toThrow();
    await expect(createExpense(db, rafi, { ...base, date: addDays(todayISO(), 1) })).rejects.toThrow();
    await expect(createExpense(db, rafi, { ...base, date: "2026-02-30" })).rejects.toThrow();
  });

  it("records who paid personally", async () => {
    const row = await createExpense(db, rafi, {
      date: todayISO(),
      categoryId: feed,
      amount: 2750,
      paidByPartnerId: rafi,
      description: "খাবারের বস্তা",
    });
    expect(row.paidByPartnerId).toBe(rafi);
  });

  it("logs edits with before and after", async () => {
    const row = await createExpense(db, rafi, { date: todayISO(), categoryId: feed, amount: 100, paidByPartnerId: null });
    await updateExpense(db, rafi, row.id, { date: todayISO(), categoryId: feed, amount: 150, paidByPartnerId: null });
    const log = await audits("expenses", row.id);
    const upd = log.find((l) => l.action === "update")!;
    expect((upd.before as { amount: number }).amount).toBe(100);
    expect((upd.after as { amount: number }).amount).toBe(150);
  });

  it("voids with a reason, keeps the row, and refuses to edit or void it again", async () => {
    const row = await createExpense(db, rafi, { date: todayISO(), categoryId: feed, amount: 999, paidByPartnerId: null });
    await expect(voidRow(db, rafi, "expenses", row.id, " ")).rejects.toThrow();
    const voided = await voidRow(db, rafi, "expenses", row.id, "ভুল অঙ্ক");
    expect(voided).toMatchObject({ voidReason: "ভুল অঙ্ক", voidedBy: rafi });
    expect(await db.$count(expenses, eq(expenses.id, row.id))).toBe(1);
    await expect(voidRow(db, rafi, "expenses", row.id, "আবার")).rejects.toThrow("voided");
    await expect(
      updateExpense(db, rafi, row.id, { date: todayISO(), categoryId: feed, amount: 1, paidByPartnerId: null }),
    ).rejects.toThrow("voided");
    expect((await audits("expenses", row.id)).map((l) => l.action)).toEqual(["create", "void"]);
  });
});

describe("contributions and withdrawals", () => {
  it("creates and voids contributions", async () => {
    const c = await createContribution(db, rafi, { date: todayISO(), partnerId: rafi, amount: 100000, method: "bkash" });
    expect(c.method).toBe("bkash");
    const v = await voidRow(db, rafi, "contributions", c.id, "দুইবার লেখা হয়েছে");
    expect(v.voidedAt).not.toBeNull();
  });

  it("rejects bad methods and unknown partners", async () => {
    await expect(
      createContribution(db, rafi, { date: todayISO(), partnerId: rafi, amount: 1, method: "card" as "cash" }),
    ).rejects.toThrow();
    await expect(createWithdrawal(db, rafi, { date: todayISO(), partnerId: 999, amount: 1 })).rejects.toThrow(
      "unknown_partner",
    );
  });
});
