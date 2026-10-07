import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "farm_session";
export const SESSION_DAYS = 90;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

const DEV_SECRET = "dev-only-session-secret-change-me-0123456789";

function secretKey(secret = process.env.SESSION_SECRET): Uint8Array {
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
    secret = DEV_SECRET;
  }
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

/** Signed (HS256) session token carrying the partner id. */
export async function signSession(partnerId: number, secret?: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(partnerId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey(secret));
}

/** Returns the partner id, or null when the token is missing, tampered with or expired. */
export async function verifySession(token: string | undefined, secret?: string): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
