import { BarChart } from "@/components/charts";
import { CategoryList } from "@/components/category-list";
import { buildCategoryView, parseCategoryParams } from "@/lib/category-view";
import { BN_MONTHS, bnDate, taka, toBnDigits } from "@/lib/format";
import { active, fundBalance, monthlyTotals, partnerPositions, settleUp, totalExpense } from "@/lib/money";
import type { getCategories, getLedger, getPartners } from "@/lib/server/queries";

type Ledger = Awaited<ReturnType<typeof getLedger>>;
type Categories = Awaited<ReturnType<typeof getCategories>>;
type Partners = Awaited<ReturnType<typeof getPartners>>;

const METHOD: Record<string, string> = { cash: "নগদ", bkash: "বিকাশ", bank: "ব্যাংক" };

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 mb-2 border-b pb-1 text-lg font-bold break-after-avoid">{children}</h2>;
}

/** Monthly totals, category breakdown, partner statements and settle-up (Reports screen and its PDF). */
export function ReportBody({
  ledger,
  categories,
  partners,
  hrefForCategory,
}: {
  ledger: Ledger;
  categories: Categories;
  partners: Partners;
  hrefForCategory?: (id: number) => string;
}) {
  const months = monthlyTotals(ledger.expenses);
  const positions = partnerPositions(ledger, partners);
  const transfers = settleUp(positions);
  const fund = fundBalance(ledger);
  const total = totalExpense(ledger.expenses);
  const view = buildCategoryView(ledger.expenses, categories, parseCategoryParams({}));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-3">
          <div className="text-xs text-muted-foreground">মোট খরচ</div>
          <div className="text-lg font-bold">{taka(total)}</div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-xs text-muted-foreground">ক্যাশ বাক্স</div>
          <div className={`text-lg font-bold ${fund < 0 ? "text-destructive" : ""}`}>{taka(fund)}</div>
        </div>
      </div>

      <H2>মাসিক খরচ</H2>
      <BarChart
        bars={months.map((m) => ({
          key: m.key,
          value: m.total,
          label: `${BN_MONTHS[Number(m.key.slice(5)) - 1].slice(0, 3)} ${toBnDigits(m.key.slice(2, 4))}`,
        }))}
      />
      <table className="w-full text-sm">
        <tbody>
          {months.map((m) => (
            <tr key={m.key} className="border-b">
              <td className="py-1.5">
                {BN_MONTHS[Number(m.key.slice(5)) - 1]} {toBnDigits(m.key.slice(0, 4))}
              </td>
              <td className="py-1.5 text-right text-muted-foreground">{toBnDigits(m.count)}টি</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{taka(m.total)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="py-1.5">মোট</td>
            <td />
            <td className="py-1.5 text-right tabular-nums">{taka(total)}</td>
          </tr>
        </tbody>
      </table>

      <H2>খাত অনুযায়ী (শুরু থেকে)</H2>
      <div className="-mx-4">
        <CategoryList view={view} hrefFor={hrefForCategory} />
      </div>

      <H2>পার্টনারদের হিসাব</H2>
      {positions.map((p) => {
        const contribs = active(ledger.contributions).filter((c) => c.partnerId === p.partnerId);
        const personal = active(ledger.expenses).filter((e) => e.paidByPartnerId === p.partnerId);
        const withdrawn = active(ledger.withdrawals).filter((w) => w.partnerId === p.partnerId);
        return (
          <section key={p.partnerId} className="mb-4 rounded-xl border p-3 break-inside-avoid">
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-bold">
                {p.name} <span className="text-sm font-normal text-muted-foreground">(ভাগ {toBnDigits(p.shareBp / 100)}%)</span>
              </h3>
              <span className={`font-bold ${p.net < 0 ? "text-destructive" : p.net > 0 ? "text-primary" : ""}`}>
                {taka(p.net, { signed: true })}
              </span>
            </div>
            <table className="mt-2 w-full text-sm">
              <tbody>
                <tr><td>ফান্ডে জমা</td><td className="text-right tabular-nums">{taka(p.contributed)}</td></tr>
                <tr><td>নিজে খরচ করেছেন</td><td className="text-right tabular-nums">{taka(p.paidPersonally)}</td></tr>
                <tr><td>ফেরত নিয়েছেন</td><td className="text-right tabular-nums">−{taka(p.withdrawn)}</td></tr>
                <tr className="border-t font-semibold"><td>মোট দিয়েছেন</td><td className="text-right tabular-nums">{taka(p.putIn)}</td></tr>
                <tr><td>ভাগের খরচ</td><td className="text-right tabular-nums">−{taka(p.fairShare)}</td></tr>
                <tr><td>ফান্ডে থাকা টাকায় ভাগ</td><td className="text-right tabular-nums">{taka(-p.fundShare, { signed: true })}</td></tr>
                <tr className="border-t font-bold"><td>অবস্থান</td><td className="text-right tabular-nums">{taka(p.net, { signed: true })}</td></tr>
              </tbody>
            </table>
            {(contribs.length > 0 || personal.length > 0 || withdrawn.length > 0) && (
              <details className="mt-2 text-sm" open>
                <summary className="cursor-pointer text-muted-foreground">বিস্তারিত</summary>
                <table className="mt-1 w-full">
                  <tbody>
                    {[
                      ...contribs.map((c) => ({ date: c.date, text: `জমা (${METHOD[c.method]})${c.note ? ` · ${c.note}` : ""}`, amount: c.amount })),
                      ...personal.map((e) => ({ date: e.date, text: `নিজে খরচ: ${catName.get(e.categoryId)}${e.description ? ` · ${e.description}` : ""}`, amount: e.amount })),
                      ...withdrawn.map((w) => ({ date: w.date, text: `ফেরত${w.note ? ` · ${w.note}` : ""}`, amount: -w.amount })),
                    ]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-2 align-top whitespace-nowrap">{bnDate(r.date)}</td>
                          <td className="py-1 align-top">{r.text}</td>
                          <td className="py-1 text-right align-top tabular-nums">{taka(r.amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </details>
            )}
          </section>
        );
      })}

      <H2>কে কাকে দেবেন (সেটেলমেন্ট)</H2>
      {transfers.length === 0 ? (
        <p>সবার হিসাব সমান — কাউকে কিছু দিতে হবে না।</p>
      ) : (
        <table className="w-full text-base">
          <tbody>
            {transfers.map((t, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">
                  {t.fromName} → {t.toName}
                </td>
                <td className="py-2 text-right font-bold tabular-nums">{taka(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {fund < 0 && (
        <p className="text-sm text-destructive">
          ক্যাশ বাক্সে {taka(-fund)} ঘাটতি আছে — ভাগ অনুযায়ী সবাই মিলে ফান্ডে দিতে হবে।
        </p>
      )}
    </div>
  );
}
