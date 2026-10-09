import { Suspense } from "react";
import { EntryRow } from "@/components/entry-row";
import { LedgerFilters } from "@/components/ledger-filters";
import { PageHeader } from "@/components/page-header";
import { bnDateLong, taka, toBnDigits } from "@/lib/format";
import { buildEntries, filterEntries, groupByDay, type LedgerFilter } from "@/lib/ledger";
import Link from "next/link";
import { getCategories, getLedger, getPartners, getPonds } from "@/lib/server/queries";

async function Ledger({ searchParams }: { searchParams: PageProps<"/ledger">["searchParams"] }) {
  const [sp, ledger, categories, partners, ponds] = await Promise.all([
    searchParams,
    getLedger(),
    getCategories(),
    getPartners(),
    getPonds(),
  ]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filter: LedgerFilter = {
    month: one(sp.month),
    from: one(sp.from),
    to: one(sp.to),
    pondId: one(sp.pond) ? Number(one(sp.pond)) : undefined,
    categoryId: one(sp.cat) ? Number(one(sp.cat)) : undefined,
    payer: one(sp.payer),
    type: one(sp.type) as LedgerFilter["type"],
    q: one(sp.q),
  };
  const all = buildEntries(ledger, categories, partners);
  const months = [...new Set(all.map((e) => e.date.slice(0, 7)))].sort().reverse();
  const shown = filterEntries(all, filter);
  const groups = groupByDay(shown);
  const expenseTotal = groups.reduce((a, g) => a + g.expenseTotal, 0);
  const incomeTotal = groups.reduce((a, g) => a + g.incomeTotal, 0);
  const filtered = Object.values(filter).some(Boolean);

  return (
    <>
      <LedgerFilters months={months} categories={categories} partners={partners} ponds={ponds} />
      {filtered && (
        <p className="border-b bg-muted/50 px-4 py-2 text-sm">
          {toBnDigits(shown.length)}টি এন্ট্রি · মোট খরচ <span className="font-semibold">{taka(expenseTotal)}</span>
          {incomeTotal > 0 && (
            <>
              {" "}
              · বিক্রি <span className="font-semibold text-primary">{taka(incomeTotal)}</span>
            </>
          )}
        </p>
      )}
      {filter.type === "receipt" && shown.length > 0 && (
        <div className="grid grid-cols-3 gap-1 p-1">
          {shown.map((e) => (
            <Link key={e.id} href={`/ledger/expense/${e.id}`} className="relative block aspect-square overflow-hidden rounded-md bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/receipts/${e.id}`} alt={e.title} loading="lazy" className="size-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[11px] text-white">
                {taka(e.amount)}
              </span>
            </Link>
          ))}
        </div>
      )}
      {groups.length === 0 && <p className="p-8 text-center text-muted-foreground">কোনো এন্ট্রি নেই।</p>}
      {filter.type !== "receipt" && groups.map((g) => (
        <section key={g.date}>
          <h2 className="sticky top-[7.75rem] z-10 flex justify-between bg-muted px-4 py-1.5 text-sm font-medium">
            <span>{bnDateLong(g.date)}</span>
            <span>
              {g.expenseTotal > 0 && `খরচ ${taka(g.expenseTotal)}`}
              {g.incomeTotal > 0 && <span className="ml-2 text-primary">+{taka(g.incomeTotal)}</span>}
            </span>
          </h2>
          <div className="divide-y">
            {g.entries.map((e) => (
              <EntryRow key={`${e.kind}-${e.id}`} entry={e} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export default function LedgerPage(props: PageProps<"/ledger">) {
  return (
    <>
      <PageHeader title="হিসাব" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Ledger searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
