import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { todayISO } from "@/lib/format";
import type { DB } from "./client";
import { createContribution, createExpense, createFeeding, createSale, updateSale, voidRow } from "./mutations";
import { categories, expenses, partners, sales } from "./schema";
import { createPond, updatePond } from "./settings-mutations";
import { createTestDb } from "./test-db";

let db: DB;
let rafi: number;
let feed: number;
beforeAll(async () => {
  db = await createTestDb();
  [{ id: rafi }] = await db.select().from(partners).where(eq(partners.name, "রাফি"));
  [{ id: feed }] = await db.select().from(categories).where(eq(categories.slug, "feed"));
}, 30_000);

describe("resend safety (clientId)", () => {
  it("saving the same entry twice keeps one row", async () => {
    const input = { date: todayISO(), categoryId: feed, amount: 2750, paidByPartnerId: null, clientId: "phone-abc-123" };
    const a = await createExpense(db, rafi, input);
    const b = await createExpense(db, rafi, input);
    expect(b.id).toBe(a.id);
    expect(await db.$count(expenses, eq(expenses.clientId, "phone-abc-123"))).toBe(1);
    const c1 = await createContribution(db, rafi, { date: todayISO(), partnerId: rafi, amount: 5, clientId: "phone-xyz-999" });
    const c2 = await createContribution(db, rafi, { date: todayISO(), partnerId: rafi, amount: 5, clientId: "phone-xyz-999" });
    expect(c2.id).toBe(c1.id);
  });

  it("entries without a clientId are always new", async () => {
    const input = { date: todayISO(), categoryId: feed, amount: 100, paidByPartnerId: null };
    const a = await createExpense(db, rafi, input);
    const b = await createExpense(db, rafi, input);
    expect(b.id).not.toBe(a.id);
  });
});

describe("ponds, sales and feeding", () => {
  it("records a sale with pond, kg and who received the cash; edits and voids it", async () => {
    const pond = await createPond(db, rafi, { name: "বড় পুকুর" });
    const s = await createSale(db, rafi, {
      date: todayISO(),
      amount: 45000,
      fish: "রুই",
      weightKg: 150.555,
      buyer: "আড়ত",
      pondId: pond.id,
      receivedByPartnerId: rafi,
    });
    expect(s).toMatchObject({ amount: 45000, weightKg: 150.56, pondId: pond.id, receivedByPartnerId: rafi });
    const u = await updateSale(db, rafi, s.id, { date: todayISO(), amount: 46000, pondId: pond.id, receivedByPartnerId: null });
    expect(u.receivedByPartnerId).toBeNull();
    await voidRow(db, rafi, "sales", s.id, "ভুল");
    await expect(db.delete(sales).where(eq(sales.id, s.id))).rejects.toThrow();
  });

  it("validates pond and amounts; ponds can be renamed and hidden", async () => {
    await expect(createSale(db, rafi, { date: todayISO(), amount: 0 })).rejects.toThrow();
    await expect(createSale(db, rafi, { date: todayISO(), amount: 10, pondId: 999 })).rejects.toThrow("unknown_pond");
    const pond = await createPond(db, rafi, { name: "ছোট পুকুর" });
    const p2 = await updatePond(db, rafi, pond.id, { name: "ছোট পুকুর ১", archived: true });
    expect(p2).toMatchObject({ name: "ছোট পুকুর ১", archived: true });
  });

  it("logs feeding in kg", async () => {
    const f = await createFeeding(db, rafi, { date: todayISO(), feedKg: 25, feedType: "ভাসমান" });
    expect(f.feedKg).toBe(25);
    await expect(createFeeding(db, rafi, { date: todayISO(), feedKg: 0 })).rejects.toThrow();
  });
});
