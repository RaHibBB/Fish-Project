import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { addDays, todayISO } from "@/lib/format";
import type { DB } from "./client";
import { auditLog, categories, expenses, partners } from "./schema";
import {
  createContribution,
  createDuePayment,
  createExpense,
  createSale,
  createWithdrawal,
  updateDuePayment,
  updateExpense,
  voidRow,
} from "./mutations";
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

describe("shop credit (বাকি)", () => {
  const credit = (shop: string, amount: number) =>
    createExpense(db, rafi, { date: todayISO(), categoryId: feed, amount, paidByPartnerId: null, onCredit: true, shop });

  it("saves a credit purchase with its shop and audit row", async () => {
    const row = await credit("রহিম ফিড", 50000);
    expect(row).toMatchObject({ onCredit: true, shop: "রহিম ফিড", paidByPartnerId: null });
    expect((await audits("expenses", row.id))[0]).toMatchObject({ action: "create" });
  });

  it("needs a shop name, and nobody can have paid it", async () => {
    const base = { date: todayISO(), categoryId: feed, amount: 100, onCredit: true };
    await expect(createExpense(db, rafi, { ...base, paidByPartnerId: null, shop: "  " })).rejects.toThrow("shop_required");
    await expect(createExpense(db, rafi, { ...base, paidByPartnerId: rafi, shop: "ক" })).rejects.toThrow("credit_paid_by");
  });

  it("forgets a shop name typed on a normal (paid) expense", async () => {
    const row = await createExpense(db, rafi, { date: todayISO(), categoryId: feed, amount: 100, paidByPartnerId: null, shop: "ভুল" });
    expect(row).toMatchObject({ onCredit: false, shop: "" });
  });

  it("records payments, never more than is owed, and logs edits", async () => {
    await credit("করিম ঔষধ", 8000);
    const p1 = await createDuePayment(db, rafi, { date: todayISO(), shop: "করিম ঔষধ", amount: 3000, paidByPartnerId: null });
    expect(p1).toMatchObject({ shop: "করিম ঔষধ", amount: 3000, paidByPartnerId: null });
    await expect(createDuePayment(db, rafi, { date: todayISO(), shop: "করিম ঔষধ", amount: 5001, paidByPartnerId: null })).rejects.toThrow(
      "due_exceeded",
    );
    await expect(createDuePayment(db, rafi, { date: todayISO(), shop: "অচেনা দোকান", amount: 1, paidByPartnerId: null })).rejects.toThrow(
      "due_exceeded",
    );
    const p2 = await createDuePayment(db, rafi, { date: todayISO(), shop: " করিম ঔষধ ", amount: 5000, paidByPartnerId: rafi });
    expect(p2.paidByPartnerId).toBe(rafi);
    // editing p2 may use up to what it already covers
    await updateDuePayment(db, rafi, p2.id, { date: todayISO(), shop: "করিম ঔষধ", amount: 4000, paidByPartnerId: rafi });
    await expect(
      updateDuePayment(db, rafi, p2.id, { date: todayISO(), shop: "করিম ঔষধ", amount: 5001, paidByPartnerId: rafi }),
    ).rejects.toThrow("due_exceeded");
    expect((await audits("due_payments", p2.id)).map((l) => l.action)).toEqual(["create", "update"]);
  });

  it("a re-sent payment returns the saved one instead of failing or duplicating", async () => {
    await credit("তৃতীয় দোকান", 1000);
    const input = { date: todayISO(), shop: "তৃতীয় দোকান", amount: 1000, paidByPartnerId: null, clientId: "due-resend-0001" };
    const a = await createDuePayment(db, rafi, input);
    const b = await createDuePayment(db, rafi, input);
    expect(b.id).toBe(a.id);
  });

  it("voids a payment (kept, frozen) and refuses to delete rows", async () => {
    await credit("চতুর্থ", 700);
    const p = await createDuePayment(db, rafi, { date: todayISO(), shop: "চতুর্থ", amount: 700, paidByPartnerId: null });
    const v = await voidRow(db, rafi, "due_payments", p.id, "ভুল দোকান");
    expect(v.voidedBy).toBe(rafi);
    await expect(db.execute("delete from due_payments" as never)).rejects.toThrow();
  });
});

describe("sale receipt", () => {
  it("keeps the receipt photo on a sale", async () => {
    const row = await createSale(db, rafi, { date: todayISO(), amount: 25000, receiptUrl: "data:image/jpeg;base64,AAAA" });
    expect(row.receiptUrl).toBe("data:image/jpeg;base64,AAAA");
  });
});

describe("credit purchases that already have payments", () => {
  it("can't be voided, lowered or turned into a normal expense while payments would exceed them", async () => {
    const e = await createExpense(db, rafi, {
      date: todayISO(),
      categoryId: feed,
      amount: 10000,
      paidByPartnerId: null,
      onCredit: true,
      shop: "পঞ্চম দোকান",
    });
    await createDuePayment(db, rafi, { date: todayISO(), shop: "পঞ্চম দোকান", amount: 6000, paidByPartnerId: null });
    const same = { date: todayISO(), categoryId: feed, paidByPartnerId: null, onCredit: true, shop: "পঞ্চম দোকান" };
    await expect(voidRow(db, rafi, "expenses", e.id, "ভুল")).rejects.toThrow("due_has_payments");
    await expect(updateExpense(db, rafi, e.id, { ...same, amount: 5000 })).rejects.toThrow("due_has_payments");
    await expect(updateExpense(db, rafi, e.id, { ...same, amount: 10000, onCredit: false })).rejects.toThrow("due_has_payments");
    // raising it is fine
    const up = await updateExpense(db, rafi, e.id, { ...same, amount: 12000 });
    expect(up.amount).toBe(12000);
  });
});
