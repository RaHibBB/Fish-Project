import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DB } from "./client";
import { auditLog, partners, settings } from "./schema";
import { createCategory, updateCategory, updatePartners, updateSettings } from "./settings-mutations";
import { createTestDb } from "./test-db";

let db: DB;
let ps: { id: number; name: string; phone: string; shareBp: number }[];

beforeAll(async () => {
  db = await createTestDb();
  ps = await db.select().from(partners).orderBy(partners.sortOrder);
}, 30_000);

describe("settings", () => {
  it("updates wage and farm name with an audit row", async () => {
    await updateSettings(db, ps[0].id, { farmName: "খামার", labourDailyWage: 850, startDate: "2026-03-01" });
    const [s] = await db.select().from(settings);
    expect(s).toMatchObject({ labourDailyWage: 850, farmName: "খামার", startDate: "2026-03-01" });
    expect(await db.$count(auditLog, eq(auditLog.tableName, "settings"))).toBe(1);
    await expect(updateSettings(db, ps[0].id, { farmName: "x", labourDailyWage: 0, startDate: "" })).rejects.toThrow();
  });
});

describe("partners", () => {
  const edit = (over: Partial<(typeof ps)[number]>[] = []) =>
    ps.map((p, i) => ({ id: p.id, name: p.name, phone: p.phone, shareBp: p.shareBp, ...over[i] }));

  it("requires shares to total 100%", async () => {
    await expect(updatePartners(db, ps[0].id, edit([{ shareBp: 5000 }]))).rejects.toThrow();
  });

  it("saves unequal shares and lets two partners swap phone numbers", async () => {
    await updatePartners(
      db,
      ps[0].id,
      edit([
        { shareBp: 5000, phone: ps[1].phone },
        { shareBp: 3000, phone: ps[0].phone },
        { shareBp: 2000 },
      ]),
    );
    const after = await db.select().from(partners).orderBy(partners.sortOrder);
    expect(after.map((p) => p.shareBp)).toEqual([5000, 3000, 2000]);
    expect(after[0].phone).toBe(ps[1].phone);
    expect(after[1].phone).toBe(ps[0].phone);
  });

  it("rejects duplicate or invalid phones", async () => {
    const now = await db.select().from(partners).orderBy(partners.sortOrder);
    const base = now.map((p) => ({ id: p.id, name: p.name, phone: p.phone, shareBp: p.shareBp }));
    await expect(updatePartners(db, ps[0].id, [{ ...base[0], phone: base[1].phone }, base[1], base[2]])).rejects.toThrow();
    await expect(updatePartners(db, ps[0].id, [{ ...base[0], phone: "123" }, base[1], base[2]])).rejects.toThrow();
  });
});

describe("categories", () => {
  it("adds, renames and archives (never deletes)", async () => {
    const c = await createCategory(db, ps[0].id, { name: "বিদ্যুৎ", icon: "droplets", color: "#123456" });
    expect(c.slug).toMatch(/^custom-/);
    const u = await updateCategory(db, ps[0].id, c.id, { name: "বিদ্যুৎ বিল", icon: "droplets", color: "#123456", archived: true });
    expect(u).toMatchObject({ name: "বিদ্যুৎ বিল", archived: true });
    await expect(createCategory(db, ps[0].id, { name: "x", icon: "rocket" as "fish", color: "#123456" })).rejects.toThrow();
  });
});
