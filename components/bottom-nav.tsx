"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { BarChart3, BookOpen, House, Layers, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "হোম", icon: House },
  { href: "/ledger", label: "হিসাব", icon: BookOpen },
  { href: "/add", label: "খরচ", icon: Plus, primary: true },
  { href: "/categories", label: "খাত", icon: Layers },
  { href: "/reports", label: "রিপোর্ট", icon: BarChart3 },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Full-screen forms have their own sticky save bar, so the nav is hidden there. */
const FORM_ROUTES = [/^\/add$/, /^\/contribute$/, /^\/sale$/, /^\/feeding\/new$/, /^\/ledger\/.+\/edit$/];

/** Reads the URL, so it must sit inside <Suspense>; see AppNav. */
function BottomNav() {
  const pathname = usePathname();
  if (FORM_ROUTES.some((r) => r.test(pathname))) return null;
  return <NavBar pathname={pathname} />;
}

/** Bottom navigation; the static fallback renders the same bar with nothing highlighted. */
export function AppNav() {
  return (
    <Suspense fallback={<NavBar pathname={null} />}>
      <BottomNav />
    </Suspense>
  );
}

function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname !== null && isActive(pathname, item.href);
          const Icon = item.icon;
          if ("primary" in item) {
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  aria-label="নতুন খরচ"
                  className="-mt-6 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background active:scale-95"
                >
                  <Icon className="size-8" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-xs",
                  active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-6" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
