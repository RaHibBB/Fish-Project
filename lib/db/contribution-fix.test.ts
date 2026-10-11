import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DB } from "./client";
import { applyFundContributions } from "./contribution-fix";
import { createContribution } from "./mutations";
import { auditLog, contributions, partners } from "./schema";
import { createTestDb } from "./test-db";

let db: DB;
beforeAll(async () => {
  db = await createTestDb();
  const ps = await db.select().from(partners).orderBy(partners.sortOrder);
  for (const p of ps) await createContribution(db, null, { date: "2026-04-16", partnerId: p.id, amount: 100000 });
}, 30_000);

const setup = {
  contributions: {
    রাফি: { amount: 77200, note: "মোট ৳৮১,৫৫০ − নিজে খরচ ৳৪,৩৫০" },
    রিয়াজ: { amount: 185370, note: "মোট ৳২,৩৫,৩৭০ − নিজে খরচ ৳৫০,০০০" },
    অভি: { amount: 170000, note: "মোট ৳১,৭০,০০০" },
  },
};

describe("applyFundContributions", () => {
  it("corrects each partner's contribution and logs before/after", async () => {
    const res = await applyFundContributions(db, setup);
    expect(res.map((r) => r.action)).toEqual(["updated", "updated", "updated"]);
    const [rafi] = await db.select().from(partners).where(eq(partners.name, "রাফি"));
    const [row] = await db.select().from(contributions).where(eq(contributions.partnerId, rafi.id));
    expect(row).toMatchObject({ amount: 77200, note: "মোট ৳৮১,৫৫০ − নিজে খরচ ৳৪,৩৫০" });
    const [log] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.tableName, "contributions"), eq(auditLog.rowId, row.id), eq(auditLog.action, "update")));
    expect((log.before as { amount: number }).amount).toBe(100000);
    expect((log.after as { amount: number }).amount).toBe(77200);
  });

  it("is idempotent", async () => {
    const res = await applyFundContributions(db, setup);
    expect(res.map((r) => r.action)).toEqual(["unchanged", "unchanged", "unchanged"]);
    expect(await db.$count(contributions)).toBe(3);
  });

  it("skips unknown partners and refuses to guess when there are several rows", async () => {
    const [ovi] = await db.select().from(partners).where(eq(partners.name, "অভি"));
    await createContribution(db, null, { date: "2026-05-01", partnerId: ovi.id, amount: 5000 });
    const res = await applyFundContributions(db, {
      contributions: { অভি: { amount: 1 }, কেউনা: { amount: 5 } },
    });
    expect(res.map((r) => r.action)).toEqual(["skipped", "skipped"]);
  });
});
