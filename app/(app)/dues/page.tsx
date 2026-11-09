import { Suspense } from "react";
import Link from "next/link";
import { HandCoins, Store } from "lucide-react";
import { EntryRow } from "@/components/entry-row";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { bnDate, taka, toBnDigits } from "@/lib/format";
import { duesByShop, shopKey } from "@/lib/dues";
import { buildEntries } from "@/lib/ledger";
import { getCurrentPartner } from "@/lib/server/auth";
import { getCategories, getLedger, getPartners } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

async function Dues() {
  const [me, ledger, categories, partners] = await Promise.all([getCurrentPartner(), getLedger(), getCategories(), getPartners()]);
  const shops = duesByShop(ledger.expenses, ledger.duePayments);
  const owing = shops.filter((s) => s.due > 0);
  const settled = shops.filter((s) => s.due <= 0);
  const total = owing.reduce((a, s) => a + s.due, 0);
  const entries = buildEntries(ledger, categories, partners).filter((e) => !e.voided);
  const shopEntries = (name: string) => entries.filter((e) => e.shop && shopKey(e.shop) === shopKey(name));

  return (
    <div className="space-y-4 p-4 pb-8">
      <section className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm opacity-90">
          <Store className="size-4" /> দোকানে মোট বাকি
        </div>
        <div className="mt-1 text-4xl font-bold tabular-nums">{taka(total)}</div>
        <p className="mt-1 text-sm opacity-90">
          {owing.length === 0 ? "কোনো দোকানে বাকি নেই" : `${toBnDigits(owing.length)}টি দোকানে বাকি`}
        </p>
        {me && owing.length > 0 && (
          <Link
            href="/dues/pay"
            className="mt-4 flex h-14 items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold text-gray-900 active:scale-[0.98]"
          >
            <HandCoins className="size-5" /> বাকি শোধ করুন
          </Link>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        বাকিতে কিনলে খরচ এখনই গোনা হয়, কিন্তু ফান্ড থেকে টাকা কাটা যায় না। টাকা দিলে এখানে &quot;বাকি শোধ&quot; লিখুন — তখন ফান্ড (বা যিনি দিলেন তাঁর হিসাব) থেকে কাটা হবে।
        নতুন বাকি লিখতে: খরচ লিখুন → &quot;কে দিল&quot; এ <b>বাকি (দোকানে)</b>।
      </p>

      {owing.length === 0 && shops.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">এখনো কোনো বাকি লেখা হয়নি।</div>
      )}

      {owing.map((s) => (
        <details key={shopKey(s.shop)} className="rounded-xl border">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
            <span>
              <span className="block text-lg font-semibold">{s.shop}</span>
              <span className="block text-xs text-muted-foreground">
                মোট কেনা {taka(s.bought)} · দিয়েছেন {taka(s.paid)} · শেষ {bnDate(s.lastDate)}
              </span>
            </span>
            <b className="text-xl text-amber-600 tabular-nums">{taka(s.due)}</b>
          </summary>
          <div className="border-t">
            {me && (
              <Link
                href={`/dues/pay?shop=${encodeURIComponent(s.shop)}`}
                className={cn(buttonVariants({ variant: "outline" }), "m-3 h-11 w-[calc(100%-1.5rem)] text-base")}
              >
                <HandCoins className="size-4" /> {s.shop} কে টাকা দিন
              </Link>
            )}
            <div className="divide-y">
              {shopEntries(s.shop).map((e) => (
                <EntryRow key={`${e.kind}-${e.id}`} entry={e} showDate />
              ))}
            </div>
          </div>
        </details>
      ))}

      {settled.length > 0 && (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer font-medium">শোধ হয়ে গেছে ({toBnDigits(settled.length)}টি দোকান)</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {settled.map((s) => (
              <li key={shopKey(s.shop)} className="flex justify-between">
                <span>{s.shop}</span>
                <span className="text-muted-foreground">কেনা {taka(s.bought)} — পুরো শোধ</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function DuesPage() {
  return (
    <>
      <PageHeader title="দোকানের বাকি" back="/" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Dues />
      </Suspense>
    </>
  );
}
