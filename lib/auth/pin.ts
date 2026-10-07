import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { partners, type Partner } from "@/lib/db/schema";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/** "+880 1711-111111" -> "01711111111"; returns null if it isn't a Bangladeshi mobile number. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(2);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

/** Accepts Bengali or Latin digits. */
export function normalizePin(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\s/g, "");
}

export function isValidPin(pin: string) {
  return /^\d{6}$/.test(pin);
}

/** Rejects PINs that are trivially guessable. */
export function isWeakPin(pin: string) {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  return "0123456789".includes(pin) || "9876543210".includes(pin);
}

let dummyHash: string | undefined;

export type LoginResult =
  | { ok: true; partner: Partner }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; lockedUntil: Date };

export async function attemptLogin(
  db: DB,
  phoneInput: string,
  pinInput: string,
  now: Date = new Date(),
): Promise<LoginResult> {
  const phone = normalizePhone(phoneInput);
  const pin = normalizePin(pinInput);
  if (!phone || !isValidPin(pin)) return { ok: false, reason: "invalid" };

  const [partner] = await db.select().from(partners).where(eq(partners.phone, phone));
  if (!partner) {
    // Same cost as a real check so response time doesn't reveal which numbers exist.
    dummyHash ??= await bcrypt.hash("dummy-pin", 10);
    await bcrypt.compare(pin, dummyHash);
    return { ok: false, reason: "invalid" };
  }
  if (partner.lockedUntil && partner.lockedUntil > now) {
    return { ok: false, reason: "locked", lockedUntil: partner.lockedUntil };
  }

  const lockExpired = partner.lockedUntil !== null && partner.lockedUntil <= now;
  const priorFailures = lockExpired ? 0 : partner.failedLogins;

  if (await bcrypt.compare(pin, partner.pinHash)) {
    await db.transaction(async (tx) => {
      if (partner.failedLogins !== 0 || partner.lockedUntil) {
        await tx
          .update(partners)
          .set({ failedLogins: 0, lockedUntil: null })
          .where(eq(partners.id, partner.id));
      }
      await writeAudit(tx, { actorId: partner.id, action: "login", tableName: "partners", rowId: partner.id });
    });
    return { ok: true, partner: { ...partner, failedLogins: 0, lockedUntil: null } };
  }

  const failedLogins = priorFailures + 1;
  const lockedUntil =
    failedLogins >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null;
  await db.transaction(async (tx) => {
    await tx
      .update(partners)
      .set({ failedLogins: lockedUntil ? 0 : failedLogins, lockedUntil })
      .where(eq(partners.id, partner.id));
    await writeAudit(tx, {
      actorId: null,
      action: lockedUntil ? "login_locked" : "login_failed",
      tableName: "partners",
      rowId: partner.id,
      after: { failedLogins, lockedUntil },
    });
  });
  return lockedUntil ? { ok: false, reason: "locked", lockedUntil } : { ok: false, reason: "invalid" };
}

export type ChangePinError = "wrong_current" | "invalid" | "mismatch" | "same" | "weak";

export async function changePin(
  db: DB,
  partnerId: number,
  input: { current: string; next: string; confirm: string },
): Promise<{ ok: true } | { ok: false; error: ChangePinError }> {
  const current = normalizePin(input.current);
  const next = normalizePin(input.next);
  const confirm = normalizePin(input.confirm);
  if (!isValidPin(next)) return { ok: false, error: "invalid" };
  if (next !== confirm) return { ok: false, error: "mismatch" };
  if (next === current) return { ok: false, error: "same" };
  if (isWeakPin(next)) return { ok: false, error: "weak" };

  const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId));
  if (!partner || !(await bcrypt.compare(current, partner.pinHash))) {
    return { ok: false, error: "wrong_current" };
  }
  const pinHash = await bcrypt.hash(next, 10);
  await db.transaction(async (tx) => {
    await tx.update(partners).set({ pinHash, mustChangePin: false }).where(eq(partners.id, partnerId));
    await writeAudit(tx, {
      actorId: partnerId,
      action: "change_pin",
      tableName: "partners",
      rowId: partnerId,
      before: { mustChangePin: partner.mustChangePin },
      after: { mustChangePin: false },
    });
  });
  return { ok: true };
}
