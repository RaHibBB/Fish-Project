import Link from "next/link";
import { Paperclip } from "lucide-react";
import { BarChart } from "@/components/charts";
import type { buildCategoryDetail } from "@/lib/category-view";
import { BN_MONTHS, bnDate, bnMonth, taka, toBnDigits } from "@/lib/format";
import type { ExpenseLike } from "@/lib/money";
import { cn } from "@/lib/utils";

export type DetailEntry = ExpenseLike & { id: number; description: string; receiptUrl: string | null };
type Detail = ReturnType<typeof buildCategoryDetail<DetailEntry>>;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

/** Body of a category detail (screen and print). */
export function CategoryDetailBody({
  detail,
  isLabour,
  color,
  payerName,
  interactive = true,
}: {
  detail: Detail;
  isLabour: boolean;
  color: string;
  payerName: (id: number | null) => string;
  interactive?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="মোট" value={taka(detail.total)} />
        <Stat label="মাসে গড়" value={taka(detail.avgPerMonth)} />
        <Stat label="এন্ট্রি" value={`${toBnDigits(detail.count)}টি`} />
        {isLabour ? (
          <Stat label="মোট শ্রমিক-দিন" value={toBnDigits(detail.labour.labourDays)} />
        ) : (
          <Stat label="মাস" value={`${toBnDigits(detail.months.length)}টি`} />
        )}
        {isLabour && (
          <Stat
            label="দিনে গড় শ্রমিক"
            value={`${toBnDigits((Math.round(detail.labour.avgPerDay * 10) / 10).toString())} জন`}
          />
        )}
        {isLabour && <Stat label="কাজের দিন" value={toBnDigits(detail.labour.workingDays)} />}
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">মাস অনুযায়ী</h2>
        <BarChart
          color={color}
          bars={detail.months.map((m) => ({
            key: m.month,
            value: m.total,
            label: BN_MONTHS[Number(m.month.slice(5)) - 1].slice(0, 3),
          }))}
        />
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="py-1.5 text-left font-normal">মাস</th>
              <th className="py-1.5 text-right font-normal">এন্ট্রি</th>
              <th className="py-1.5 text-right font-normal">টাকা</th>
            </tr>
          </thead>
          <tbody>
            {detail.months.map((m) => (
              <tr key={m.month} className="border-b">
                <td className="py-1.5">{bnMonth(m.month)}</td>
                <td className="py-1.5 text-right tabular-nums">{toBnDigits(m.count)}</td>
                <td className="py-1.5 text-right tabular-nums">{taka(m.total)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5">মোট</td>
              <td className="py-1.5 text-right tabular-nums">{toBnDigits(detail.count)}</td>
              <td className="py-1.5 text-right tabular-nums">{taka(detail.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">সব এন্ট্রি</h2>
        {detail.entries.length === 0 && <p className="text-muted-foreground">কোনো এন্ট্রি নেই।</p>}
        <table className="w-full text-sm">
          <tbody>
            {detail.entries.map((e) => {
              const row = (
                <>
                  <td className="py-2 align-top whitespace-nowrap">{bnDate(e.date)}</td>
                  <td className="px-2 py-2 align-top">
                    {e.labourCount ? `${toBnDigits(e.labourCount)} জন · ` : ""}
                    {payerName(e.paidByPartnerId)}
                    {e.description && <div className="text-muted-foreground">{e.description}</div>}
                  </td>
                  <td className="py-2 text-right align-top whitespace-nowrap tabular-nums">
                    {taka(e.amount)}
                    {e.receiptUrl &&
                      (interactive ? (
                        <a href={`/receipts/${e.id}`} target="_blank" rel="noreferrer" aria-label="রসিদ" className="ml-1 inline-block">
                          <Paperclip className="inline size-3.5 text-primary" />
                        </a>
                      ) : (
                        <span className="ml-1 text-xs">(রসিদ)</span>
                      ))}
                  </td>
                </>
              );
              return (
                <tr key={e.id} className={cn("border-b", interactive && "active:bg-muted")}>
                  {row}
                  {interactive && (
                    <td className="no-print w-6 py-2 text-right align-top">
                      <Link href={`/ledger/expense/${e.id}`} aria-label="খুলুন" className="text-muted-foreground">
                        ›
                      </Link>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
