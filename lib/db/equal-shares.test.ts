import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { partners } from "./schema";
import { createTestDb } from "./test-db";

describe("0005_equal_shares migration", () => {
  it("resets a 35/35/30 split to 3334/3333/3333 and leaves admins alone", async () => {
    const db = await createTestDb();
    const ps = await db.select().from(partners).orderBy(partners.sortOrder);
    const shares = [3500, 3500, 3000];
    for (const [i, p] of ps.entries()) await db.update(partners).set({ shareBp: shares[i] }).where(eq(partners.id, p.id));
    await db.insert(partners).values({ name: "অ্যাডমিন", phone: "01700000999", pinHash: "x", shareBp: 0, isPartner: false, sortOrder: 9 });

    await db.execute(readFileSync("drizzle/0005_equal_shares.sql", "utf8") as never);

    const after = await db.select().from(partners).orderBy(partners.sortOrder);
    expect(after.filter((p) => p.isPartner).map((p) => p.shareBp)).toEqual([3334, 3333, 3333]);
    expect(after.find((p) => !p.isPartner)!.shareBp).toBe(0);
  }, 30_000);
});
