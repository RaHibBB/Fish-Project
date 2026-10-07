import { Suspense } from "react";
import { EntryRow } from "@/components/entry-row";
import { LedgerFilters } from "@/components/ledger-filters";
import { PageHeader } from "@/components/page-header";
import { bnDateLong, taka, toBnDigits } from "@/lib/format";
import { buildEntries, filterEntries, groupByDay, type LedgerFilter } from "@/lib/ledger";
import { requirePartner } from "@/lib/server/auth";
import { getCategories, getLedger, getPartners } from "@/lib/server/queries";

async function Ledger({ searchParams }: { searchParams: PageProps<"/ledger">["searchParams"] }) {
  await requirePartner();
  const [sp, ledger, categories, partners] = await Promise.all([
    searchParams,
    getLedger(),
    getCategories(),
    getPartners(),
  ]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filter: LedgerFilter = {
    month: one(sp.month),
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
  const filtered = Object.values(filter).some(Boolean);

  return (
    <>
      <LedgerFilters months={months} categories={categories} partners={partners} />
      {filtered && (
        <p className="border-b bg-muted/50 px-4 py-2 text-sm">
          {toBnDigits(shown.length)}টি এন্ট্রি · মোট খরচ <span className="font-semibold">{taka(expenseTotal)}</span>
        </p>
      )}
      {groups.length === 0 && <p className="p-8 text-center text-muted-foreground">কোনো এন্ট্রি নেই।</p>}
      {groups.map((g) => (
        <section key={g.date}>
          <h2 className="sticky top-[7.75rem] z-10 flex justify-between bg-muted px-4 py-1.5 text-sm font-medium">
            <span>{bnDateLong(g.date)}</span>
            {g.expenseTotal > 0 && <span>খরচ {taka(g.expenseTotal)}</span>}
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
