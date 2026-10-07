import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Donut, ShareBar } from "@/components/charts";
import type { buildCategoryView } from "@/lib/category-view";
import { bnPercent, taka, toBnDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

type View = ReturnType<typeof buildCategoryView>;

function ChangeLine({ row }: { row: View["rows"][number] }) {
  const { diff, percent } = row.change;
  if (row.thisMonth === 0 && row.lastMonth === 0) return null;
  return (
    <span className={cn(diff > 0 ? "text-destructive" : diff < 0 ? "text-primary" : "")}>
      এই মাস {taka(row.thisMonth)} · গত মাসের চেয়ে {taka(diff, { signed: true })}
      {percent === null ? " (নতুন)" : ` (${percent > 0 ? "+" : percent < 0 ? "−" : ""}${toBnDigits(Math.abs(Math.round(percent)))}%)`}
    </span>
  );
}

/** Donut + sorted category rows + grand total. `hrefFor` makes rows tappable (omitted on print). */
export function CategoryList({ view, hrefFor }: { view: View; hrefFor?: (categoryId: number) => string }) {
  if (view.rows.length === 0) {
    return <p className="p-8 text-center text-muted-foreground">এই সময়ে কোনো খরচ নেই।</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center">
        <Donut
          total={view.total}
          slices={view.rows.map((r) => ({ key: r.category.id, value: r.total, color: r.category.color }))}
        />
      </div>
      <ul className="divide-y border-y">
        {view.rows.map((r) => {
          const inner = (
            <>
              <CategoryIcon icon={r.category.icon} color={r.category.color} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{r.category.name}</span>
                  <span className="font-semibold tabular-nums">{taka(r.total)}</span>
                </div>
                <ShareBar percent={r.percent} color={r.category.color} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {toBnDigits(r.count)}টি এন্ট্রি
                    {r.labourDays > 0 && ` · ${toBnDigits(r.labourDays)} শ্রমিক-দিন`}
                  </span>
                  <span>{bnPercent(r.total, view.total)}</span>
                </div>
                <div className="text-xs">
                  <ChangeLine row={r} />
                </div>
              </div>
            </>
          );
          return (
            <li key={r.category.id}>
              {hrefFor ? (
                <Link href={hrefFor(r.category.id)} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
                  {inner}
                  <ChevronRight className="no-print size-4 shrink-0 text-muted-foreground" />
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between px-4 text-lg font-bold">
        <span>সর্বমোট ({toBnDigits(view.count)}টি)</span>
        <span className="tabular-nums">{taka(view.total)}</span>
      </div>
    </div>
  );
}
