// Login accounts: add a non-partner admin, reset anyone's PIN. Temporary PINs are returned
// once to the caller and must be changed at the next login.
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { newTempPin, normalizePhone } from "@/lib/auth/pin";
import type { DB } from "./client";
import { writeAudit } from "./audit";
import { MutationError } from "./mutations";
import { partners } from "./schema";

export const adminInput = z.object({
  name: z.string().trim().min(1).max(40),
  phone: z.string().transform((p, ctx) => {
    const n = normalizePhone(p);
    if (!n) ctx.addIssue({ code: "custom", message: "invalid_phone" });
    return n ?? "";
  }),
});

async function assertPhoneFree(db: DB, phone: string, exceptId?: number) {
  const [taken] = await db.select({ id: partners.id }).from(partners).where(eq(partners.phone, phone));
  if (taken && taken.id !== exceptId) throw new MutationError("phone_taken");
}

/** A login-only admin (no share, never in money calculations). */
export async function createAdmin(db: DB, actorId: number | null, raw: z.input<typeof adminInput>) {
  const data = adminInput.parse(raw);
  await assertPhoneFree(db, data.phone);
  const pin = newTempPin();
  const pinHash = await bcrypt.hash(pin, 10);
  const row = await db.transaction(async (tx) => {
    const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${partners.sortOrder}), 0)::int` }).from(partners);
    const [row] = await tx
      .insert(partners)
      .values({ ...data, pinHash, shareBp: 0, isPartner: false, mustChangePin: true, sortOrder: max + 1 })
      .returning();
    await writeAudit(tx, { actorId, action: "create", tableName: "partners", rowId: row.id, after: row });
    return row;
  });
  return { id: row.id, name: row.name, phone: row.phone, pin };
}

/** New temporary PIN for someone who forgot theirs or is locked out. */
export async function resetPinFor(db: DB, actorId: number | null, targetId: number) {
  const [target] = await db.select().from(partners).where(eq(partners.id, targetId));
  if (!target) throw new MutationError("not_found");
  const pin = newTempPin();
  const pinHash = await bcrypt.hash(pin, 10);
  await db.transaction(async (tx) => {
    await tx
      .update(partners)
      .set({ pinHash, mustChangePin: true, failedLogins: 0, lockedUntil: null })
      .where(eq(partners.id, targetId));
    await writeAudit(tx, { actorId, action: "reset_pin", tableName: "partners", rowId: targetId });
  });
  return { id: target.id, name: target.name, phone: target.phone, pin };
}

/** Change an account's name/phone (partners' shares are edited separately). */
export async function updateAccount(db: DB, actorId: number, id: number, raw: z.input<typeof adminInput>) {
  const data = adminInput.parse(raw);
  await assertPhoneFree(db, data.phone, id);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(partners).where(eq(partners.id, id));
    if (!before) throw new MutationError("not_found");
    const [after] = await tx.update(partners).set(data).where(eq(partners.id, id)).returning();
    await writeAudit(tx, { actorId, action: "update", tableName: "partners", rowId: id, before, after });
    return after;
  });
}
