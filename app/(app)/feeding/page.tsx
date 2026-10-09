import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { VoidFeedingButton } from "@/components/feeding-form";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { bnDate, bnMonth, monthOf, toBnDigits, todayISO } from "@/lib/format";
import { getCurrentPartner } from "@/lib/server/auth";
import { getFeedings, getPonds } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

const kgText = (n: number) => `${toBnDigits(String(Math.round(n * 100) / 100))} কেজি`;

async function Feeding() {
  const [me, rows, ponds] = await Promise.all([getCurrentPartner(), getFeedings(), getPonds()]);
  const pondName = new Map(ponds.map((p) => [p.id, p.name]));
  const month = monthOf(todayISO());
  const thisMonth = rows.filter((r) => !r.voidedAt && r.date.startsWith(month));
  const byPond = new Map<string, number>();
  for (const r of thisMonth) {
    const key = r.pondId ? (pondName.get(r.pondId) ?? "?") : "পুকুর নির্দিষ্ট না";
    byPond.set(key, (byPond.get(key) ?? 0) + r.feedKg);
  }
  const monthTotal = thisMonth.reduce((a, r) => a + r.feedKg, 0);

  return (
    <div className="space-y-4 p-4">
      <Link href="/feeding/new" className={cn(buttonVariants(), "h-12 w-full text-base")}>
        <Plus className="size-5" /> খাবার দেওয়ার হিসাব লিখুন
      </Link>
      <section className="rounded-xl border p-3">
        <div className="text-sm text-muted-foreground">{bnMonth(month)} এ মোট খাবার</div>
        <div className="text-2xl font-bold">{kgText(monthTotal)}</div>
        {byPond.size > 1 && (
          <ul className="mt-1 text-sm">
            {[...byPond].map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span>{kgText(v)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-muted-foreground">এখনো কোনো লগ নেই।</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.id} className={cn("flex items-center gap-3 px-3 py-2.5", r.voidedAt && "opacity-50")}>
              <div className="flex-1">
                <div className={cn("font-medium", r.voidedAt && "line-through")}>
                  {kgText(r.feedKg)}
                  {r.feedType && ` · ${r.feedType}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {bnDate(r.date)}
                  {r.pondId && ` · ${pondName.get(r.pondId)}`}
                  {r.note && ` · ${r.note}`}
                  {r.voidedAt && ` · বাতিল: ${r.voidReason}`}
                </div>
              </div>
              {me && !r.voidedAt && <VoidFeedingButton id={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FeedingPage() {
  return (
    <>
      <PageHeader title="খাবার লগ" back="/" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Feeding />
      </Suspense>
    </>
  );
}
