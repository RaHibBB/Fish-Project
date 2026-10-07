import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { SignJWT } from "jose";
import type { DB } from "@/lib/db/client";
import { auditLog, partners } from "@/lib/db/schema";
import { createTestDb } from "@/lib/db/test-db";
import { attemptLogin, changePin, isWeakPin, LOCK_MINUTES, normalizePhone } from "./pin";
import { signSession, verifySession } from "./token";

const SECRET = "test-secret-test-secret-test-secret-123";
const RAFI = "01700000001";
const REAZ = "01700000002";
const OVI = "01700000003";

let db: DB;
beforeAll(async () => {
  db = await createTestDb();
}, 30_000);

describe("session token", () => {
  it("round-trips the partner id", async () => {
    expect(await verifySession(await signSession(7, SECRET), SECRET)).toBe(7);
  });

  it("rejects tampered, foreign and expired tokens", async () => {
    const token = await signSession(7, SECRET);
    expect(await verifySession(token + "x", SECRET)).toBeNull();
    expect(await verifySession(token, "another-secret-another-secret-12345")).toBeNull();
    expect(await verifySession(undefined, SECRET)).toBeNull();
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("7")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(expired, SECRET)).toBeNull();
  });
});

describe("phone and PIN rules", () => {
  it("normalizes Bangladeshi numbers", () => {
    expect(normalizePhone("+880 1711-111111")).toBe("01711111111");
    expect(normalizePhone("০১৭১১১১১১১১")).toBe("01711111111");
    expect(normalizePhone("12345")).toBeNull();
  });

  it("accepts international numbers with a + or 00 prefix", () => {
    expect(normalizePhone("+880 1755-000111")).toBe("01755000111");
    expect(normalizePhone("+971 50 000 1234")).toBe("+971500001234");
    expect(normalizePhone("00971500001234")).toBe("+971500001234");
    expect(normalizePhone("0500001234")).toBeNull(); // local UAE format: ambiguous without the prefix
    expect(normalizePhone("+12")).toBeNull();
  });

  it("flags weak PINs", () => {
    expect(isWeakPin("123456")).toBe(true);
    expect(isWeakPin("111111")).toBe(true);
    expect(isWeakPin("654321")).toBe(true);
    expect(isWeakPin("482915")).toBe(false);
  });
});

describe("login", () => {
  it("accepts the right PIN (Bengali digits too) and logs it", async () => {
    const res = await attemptLogin(db, RAFI, "১১১১১১");
    expect(res.ok).toBe(true);
    const logs = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "login"), eq(auditLog.tableName, "partners")));
    expect(logs.length).toBeGreaterThan(0);
  });

  it("rejects unknown phones and wrong PINs with the same answer", async () => {
    expect(await attemptLogin(db, "01999999999", "111111")).toEqual({ ok: false, reason: "invalid" });
    expect(await attemptLogin(db, OVI, "000000")).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks after 5 wrong PINs, even for the right PIN, until the lock expires", async () => {
    const now = new Date("2026-05-01T10:00:00Z");
    for (let i = 0; i < 4; i++) {
      expect((await attemptLogin(db, REAZ, "999999", now)).ok).toBe(false);
    }
    const fifth = await attemptLogin(db, REAZ, "999999", now);
    expect(fifth).toMatchObject({ ok: false, reason: "locked" });

    const stillLocked = await attemptLogin(db, REAZ, "222222", new Date(now.getTime() + 60_000));
    expect(stillLocked).toMatchObject({ ok: false, reason: "locked" });

    const later = new Date(now.getTime() + (LOCK_MINUTES + 1) * 60_000);
    expect((await attemptLogin(db, REAZ, "222222", later)).ok).toBe(true);
    const [p] = await db.select().from(partners).where(eq(partners.phone, REAZ));
    expect(p.failedLogins).toBe(0);
    expect(p.lockedUntil).toBeNull();
  });

  it("a successful login resets the failure counter", async () => {
    await attemptLogin(db, OVI, "999999");
    await attemptLogin(db, OVI, "333333");
    const [p] = await db.select().from(partners).where(eq(partners.phone, OVI));
    expect(p.failedLogins).toBe(0);
  });
});

describe("change PIN", () => {
  it("validates and then clears must_change_pin", async () => {
    const [p] = await db.select().from(partners).where(eq(partners.phone, RAFI));
    expect(await changePin(db, p.id, { current: "000000", next: "482915", confirm: "482915" })).toEqual({
      ok: false,
      error: "wrong_current",
    });
    expect(await changePin(db, p.id, { current: "111111", next: "482915", confirm: "482916" })).toEqual({
      ok: false,
      error: "mismatch",
    });
    expect(await changePin(db, p.id, { current: "111111", next: "123456", confirm: "123456" })).toEqual({
      ok: false,
      error: "weak",
    });
    expect(await changePin(db, p.id, { current: "111111", next: "482915", confirm: "482915" })).toEqual({
      ok: true,
    });
    const [after] = await db.select().from(partners).where(eq(partners.id, p.id));
    expect(after.mustChangePin).toBe(false);
    expect((await attemptLogin(db, RAFI, "111111")).ok).toBe(false);
    expect((await attemptLogin(db, RAFI, "482915")).ok).toBe(true);
  });
});
