import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Fish, History, Images, LogIn, Plus, Settings, Wallet, Wheat } from "lucide-react";
import { EntryRow } from "@/components/entry-row";
import { InstallApp } from "@/components/install-app";
import { ShareButton } from "@/components/share-button";
import { buttonVariants } from "@/components/ui/button";
import { bnDate, monthOf, taka, todayISO } from "@/lib/format";
import { buildEntries } from "@/lib/ledger";
import { filterExpenses, fundBalance, partnerPositions, settleUp, totalExpense, totalIncome, type Transfer } from "@/lib/money";
import { buildShareText } from "@/lib/summary";
import { getCurrentPartner } from "@/lib/server/auth";
import { getCategories, getLedger, getPartners, getSettings } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

function settleLine(partnerId: number, transfers: Transfer[]) {
  const pays = transfers.filter((t) => t.fromId === partnerId);
  const gets = transfers.filter((t) => t.toId === partnerId);
  if (pays.length) return pays.map((t) => `${t.toName}কে দেবেন ${taka(t.amount)}`).join(", ");
  if (gets.length) return gets.map((t) => `${t.fromName} দেবেন ${taka(t.amount)}`).join(", ");
  return "হিসাব সমান";
}

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection(); // uses today's date — render per request (the data itself is cached)
  const [me, sp, ledger, partners, categories, settings] = await Promise.all([
    getCurrentPartner(),
    searchParams,
    getLedger(),
    getPartners(),
    getCategories(),
    getSettings(),
  ]);
  const today = todayISO();
  const fund = fundBalance(ledger);
  const todayTotal = totalExpense(filterExpenses(ledger.expenses, { from: today, to: today }));
  const monthTotal = totalExpense(filterExpenses(ledger.expenses, { from: `${monthOf(today)}-01`, to: today }));
  const allTotal = totalExpense(ledger.expenses);
  const income = totalIncome(ledger.sales);
  const lowFund = settings.lowFundAlert > 0 && fund >= 0 && fund < settings.lowFundAlert;
  const shareText = buildShareText({ farmName: settings.farmName, ledger, partners, today });
  const positions = partnerPositions(ledger, partners);
  const transfers = settleUp(positions);
  const recent = buildEntries(ledger, categories, partners)
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
    .slice(0, 10);

  return (
    <div className="space-y-4 pb-4">
      <header className="flex h-14 items-center justify-between px-4">
        <div>
          <h1 className="text-lg leading-tight font-bold">{settings.farmName}</h1>
          <p className="text-xs text-muted-foreground">{bnDate(today)}</p>
        </div>
        {me ? (
          <Link href="/settings" aria-label="সেটিংস" className="flex size-11 items-center justify-center rounded-full active:bg-muted">
            <Settings className="size-6" />
          </Link>
        ) : (
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "h-10 text-base")}>
            <LogIn className="size-4" /> লগ ইন
          </Link>
        )}
      </header>

      {sp.saved && (
        <p className="mx-4 flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-primary" role="status">
          <CheckCircle2 className="size-5" /> সংরক্ষিত হয়েছে
        </p>
      )}

      <InstallApp />

      {/* Fund balance */}
      <section
        className={cn(
          "mx-4 rounded-2xl p-5 text-white shadow-sm",
          fund < 0 ? "bg-gradient-to-br from-red-600 to-red-700" : "bg-gradient-to-br from-emerald-600 to-teal-700",
        )}
      >
        <div className="flex items-center gap-2 text-sm opacity-90">
          <Wallet className="size-4" /> ক্যাশ বাক্স (ফান্ডে আছে)
        </div>
        <div className="mt-1 text-4xl font-bold tabular-nums">{taka(fund)}</div>
        {fund < 0 && <p className="mt-1 text-sm opacity-90">ফান্ড থেকে বেশি খরচ হয়েছে — টাকা দিতে হবে</p>}
        {lowFund && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-300/90 px-2.5 py-1.5 text-sm font-medium text-amber-950">
            <AlertTriangle className="size-4" /> ক্যাশ বাক্সে টাকা কম — {taka(settings.lowFundAlert)} এর নিচে
          </p>
        )}
        <Link
          href="/contribute"
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-white/95 text-base font-semibold text-gray-900 active:scale-[0.98]"
        >
          <Plus className="size-5" /> টাকা দিন
        </Link>
      </section>

      {/* Farm shortcuts */}
      <nav className="mx-4 grid grid-cols-4 gap-2 text-center text-xs">
        {[
          { href: "/sale", label: "মাছ বিক্রি", icon: Fish },
          { href: "/feeding", label: "খাবার লগ", icon: Wheat },
          { href: "/activity", label: "পরিবর্তন", icon: History },
          { href: "/ledger?type=receipt", label: "রসিদ", icon: Images },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1 rounded-xl border py-2.5 active:bg-muted">
            <Icon className="size-5 text-primary" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Totals */}
      <section className="mx-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["আজকের খরচ", todayTotal],
          ["এই মাসে", monthTotal],
          ["মোট খরচ", allTotal],
          ...(income > 0
            ? [
                ["মোট বিক্রি", income],
                ["লাভ / ক্ষতি", income - allTotal],
              ]
            : []),
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-2.5">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div
              className={cn(
                "text-base font-bold tabular-nums",
                label === "লাভ / ক্ষতি" && ((value as number) < 0 ? "text-destructive" : "text-primary"),
              )}
            >
              {label === "লাভ / ক্ষতি" ? taka(value as number, { signed: true }) : taka(value as number)}
            </div>
          </div>
        ))}
      </section>

      {/* Partners */}
      <section className="mx-4 space-y-2">
        <h2 className="font-semibold">পার্টনারদের হিসাব</h2>
        {positions.map((p) => (
          <div key={p.partnerId} className="rounded-xl border p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold">{p.name}</span>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums",
                  p.net > 0 && "text-primary",
                  p.net < 0 && "text-destructive",
                )}
              >
                {taka(p.net, { signed: true })}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 text-sm text-muted-foreground">
              <span>দিয়েছেন: <b className="text-foreground">{taka(p.putIn)}</b></span>
              <span>
                {income > 0 ? "ভাগের খরচ (বিক্রি বাদে)" : "ভাগের খরচ"}: <b className="text-foreground">{taka(p.fairShare)}</b>
              </span>
              {p.salesHeld > 0 && (
                <span className="col-span-2">বিক্রির টাকা হাতে: <b className="text-foreground">{taka(p.salesHeld)}</b></span>
              )}
            </div>
            <p className="mt-1.5 border-t pt-1.5 text-sm">{settleLine(p.partnerId, transfers)}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          + মানে অন্যরা তাঁকে দেবেন, − মানে তিনি দেবেন। ফান্ডে থাকা টাকা ভাগ অনুযায়ী সবার।
        </p>
        <ShareButton text={shareText} />
      </section>

      {/* Recent */}
      <section>
        <div className="mx-4 mb-1 flex items-center justify-between">
          <h2 className="font-semibold">সাম্প্রতিক এন্ট্রি</h2>
          <Link href="/ledger" className="text-sm text-primary">
            সব দেখুন
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="mx-4 rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            এখনো কোনো এন্ট্রি নেই।
            <Link href="/add" className={cn(buttonVariants(), "mt-3 h-11 w-full text-base")}>
              প্রথম খরচ লিখুন
            </Link>
          </div>
        ) : (
          <div className="divide-y border-y">
            {recent.map((e) => (
              <EntryRow key={`${e.kind}-${e.id}`} entry={e} showDate />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function HomePage(props: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
      <Home searchParams={props.searchParams} />
    </Suspense>
  );
}
