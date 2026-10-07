import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { DB } from "./client";
import { auditLog, categories, contributions, expenses, partners, settings } from "./schema";
import { seed } from "./setup";
import { createTestDb } from "./test-db";

let db: DB;

beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

async function addExpense() {
  const [cat] = await db.select().from(categories).where(eq(categories.slug, "labour"));
  const [row] = await db
    .insert(expenses)
    .values({ date: "2026-05-01", categoryId: cat.id, amount: 4920, labourCount: 6, labourRate: 820 })
    .returning();
  return row;
}

describe("schema and seeds", () => {
  it("seeds settings, 12 categories and 3 partners with shares summing to 10000", async () => {
    const [s] = await db.select().from(settings);
    expect(s.labourDailyWage).toBe(820);
    expect(await db.$count(categories)).toBe(12);
    const ps = await db.select().from(partners).orderBy(partners.sortOrder);
    expect(ps.map((p) => p.name)).toEqual(["রাফি", "রিয়াজ", "অভি"]);
    expect(ps.reduce((a, p) => a + p.shareBp, 0)).toBe(10000);
    expect(ps.every((p) => p.mustChangePin)).toBe(true);
  });

  it("seeding again is a no-op", async () => {
    const res = await seed(db);
    expect(res.partners).toEqual([]);
    expect(await db.$count(categories)).toBe(12);
    expect(await db.$count(partners)).toBe(3);
  });
});

describe("never delete", () => {
  it("blocks DELETE on expenses", async () => {
    const row = await addExpense();
    await expect(db.delete(expenses).where(eq(expenses.id, row.id))).rejects.toThrow();
    expect(await db.$count(expenses, eq(expenses.id, row.id))).toBe(1);
  });

  it("blocks DELETE on every other table", async () => {
    const [p] = await db.select().from(partners).limit(1);
    await db.insert(contributions).values({ date: "2026-05-01", partnerId: p.id, amount: 100000 });
    await expect(db.delete(categories)).rejects.toThrow();
    await expect(db.delete(partners)).rejects.toThrow();
    await expect(db.delete(contributions)).rejects.toThrow();
    await expect(db.delete(settings)).rejects.toThrow();
  });

  it("blocks TRUNCATE", async () => {
    await expect(db.execute(sql`truncate table expenses cascade`)).rejects.toThrow();
  });

  it("keeps audit_log append-only", async () => {
    const [row] = await db
      .insert(auditLog)
      .values({ action: "create", tableName: "expenses", rowId: 1, after: { a: 1 } })
      .returning();
    await expect(db.update(auditLog).set({ action: "x" }).where(eq(auditLog.id, row.id))).rejects.toThrow();
    await expect(db.delete(auditLog).where(eq(auditLog.id, row.id))).rejects.toThrow();
  });

  it("requires a reason to void and freezes voided rows", async () => {
    const row = await addExpense();
    await expect(
      db.update(expenses).set({ voidedAt: new Date(), voidReason: "  " }).where(eq(expenses.id, row.id)),
    ).rejects.toThrow();
    await db
      .update(expenses)
      .set({ voidedAt: new Date(), voidReason: "ভুল এন্ট্রি" })
      .where(eq(expenses.id, row.id));
    await expect(
      db.update(expenses).set({ voidedAt: null, voidReason: null }).where(eq(expenses.id, row.id)),
    ).rejects.toThrow();
  });

  it("rejects zero or negative amounts", async () => {
    const [cat] = await db.select().from(categories).limit(1);
    await expect(
      db.insert(expenses).values({ date: "2026-05-01", categoryId: cat.id, amount: 0 }),
    ).rejects.toThrow();
  });
});
