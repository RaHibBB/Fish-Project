import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Viewing is open to everyone; only the screens that change data need a login.
 * This is the optimistic check (valid cookie); every server action still calls requirePartner().
 */
export async function proxy(request: NextRequest) {
  const id = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (id) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/add", "/contribute", "/settings", "/change-pin", "/ledger/:kind/:id/edit"],
};
