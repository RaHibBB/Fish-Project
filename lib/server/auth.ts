import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "@/lib/auth/token";

export type CurrentPartner = { id: number; name: string; phone: string; mustChangePin: boolean };

/** The logged-in partner (fresh from the DB, once per request), or null. */
export const getCurrentPartner = cache(async (): Promise<CurrentPartner | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = await verifySession(token);
  if (!id) return null;
  const [p] = await db
    .select({ id: partners.id, name: partners.name, phone: partners.phone, mustChangePin: partners.mustChangePin })
    .from(partners)
    .where(eq(partners.id, id));
  return p ?? null;
});

/**
 * Data-access guard: every page and server action calls this. Redirects to /login when
 * signed out and to /change-pin until the temporary PIN has been replaced.
 */
export async function requirePartner(opts: { allowPinChange?: boolean } = {}): Promise<CurrentPartner> {
  const partner = await getCurrentPartner();
  if (!partner) redirect("/login");
  if (partner.mustChangePin && !opts.allowPinChange) redirect("/change-pin");
  return partner;
}

export async function startSession(partnerId: number) {
  (await cookies()).set(SESSION_COOKIE, await signSession(partnerId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
