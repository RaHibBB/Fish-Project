import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { attemptLogin } from "@/lib/auth/pin";
import type { DB } from "./client";
import { createAdmin, resetPinFor, updateAccount } from "./account-mutations";
import { createContribution, createExpense } from "./mutations";
import { categories, partners } from "./schema";
import { updatePartners } from "./settings-mutations";
import { createTestDb } from "./test-db";

let db: DB;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

describe("admin accounts", () => {
  it("creates a login-only admin with a temporary PIN that must be changed", async () => {
    const r = await createAdmin(db, null, { name: "রাহিব", phone: "01766000222" });
    expect(r.pin).toMatch(/^\d{6}$/);
    const [row] = await db.select().from(partners).where(eq(partners.id, r.id));
    expect(row).toMatchObject({ isPartner: false, shareBp: 0, mustChangePin: true, phone: "01766000222" });
    const login = await attemptLogin(db, "+880 1766-000222", r.pin);
    expect(login.ok).toBe(true);
  });

  it("refuses a phone that is already used", async () => {
    await expect(createAdmin(db, null, { name: "x", phone: "01766000222" })).rejects.toThrow("phone_taken");
    await expect(createAdmin(db, null, { name: "x", phone: "12345" })).rejects.toThrow();
  });

  it("keeps admins out of money: not a payer, no contribution, not in the share check", async () => {
    const [admin] = await db.select().from(partners).where(eq(partners.isPartner, false));
    const [cat] = await db.select().from(categories).limit(1);
    await expect(
      createExpense(db, admin.id, { date: "2026-05-01", categoryId: cat.id, amount: 100, paidByPartnerId: admin.id }),
    ).rejects.toThrow("unknown_partner");
    await expect(createContribution(db, admin.id, { date: "2026-05-01", partnerId: admin.id, amount: 100 })).rejects.toThrow(
      "unknown_partner",
    );
    // An admin can still record entries for the partners.
    const ok = await createExpense(db, admin.id, { date: "2026-05-01", categoryId: cat.id, amount: 100, paidByPartnerId: null });
    expect(ok.createdBy).toBe(admin.id);
    // Partner shares are saved without the admin and still have to total 100%.
    const ps = await db.select().from(partners).where(eq(partners.isPartner, true)).orderBy(partners.sortOrder);
    await updatePartners(db, admin.id, ps.map((p) => ({ id: p.id, name: p.name, phone: p.phone, shareBp: p.shareBp })));
    const [after] = await db.select().from(partners).where(eq(partners.id, admin.id));
    expect(after.phone).toBe("01766000222");
  });

  it("an admin can never be given a share (DB rule)", async () => {
    const [admin] = await db.select().from(partners).where(eq(partners.isPartner, false));
    await expect(db.update(partners).set({ shareBp: 100 }).where(eq(partners.id, admin.id))).rejects.toThrow();
  });
});

describe("PIN reset and account edits", () => {
  it("issues a new temporary PIN and unlocks the account", async () => {
    const [rafi] = await db.select().from(partners).where(eq(partners.name, "রাফি"));
    await db.update(partners).set({ lockedUntil: new Date(Date.now() + 3_600_000), mustChangePin: false }).where(eq(partners.id, rafi.id));
    const r = await resetPinFor(db, null, rafi.id);
    const login = await attemptLogin(db, rafi.phone, r.pin);
    expect(login.ok).toBe(true);
    const [after] = await db.select().from(partners).where(eq(partners.id, rafi.id));
    expect(after.mustChangePin).toBe(true);
  });

  it("sets an international phone that can then be used to log in", async () => {
    const [reaz] = await db.select().from(partners).where(eq(partners.name, "রিয়াজ"));
    await updateAccount(db, reaz.id, reaz.id, { name: reaz.name, phone: "+971 50 000 1234" });
    const [after] = await db.select().from(partners).where(eq(partners.id, reaz.id));
    expect(after.phone).toBe("+971500001234");
    expect((await attemptLogin(db, "00971 50 000 1234", "222222")).ok).toBe(true);
  });
});
