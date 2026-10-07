import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Optimistic check only: bounce visitors without a valid session cookie to /login.
 * The real check (partner exists, PIN changed) happens in requirePartner() on every page/action.
 */
export async function proxy(request: NextRequest) {
  const id = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!id) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|icons/|icon.svg|apple-icon|manifest.webmanifest|favicon.ico).*)",
  ],
};
