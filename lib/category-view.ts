// View models for the খাত screen, its detail page, and their PDF/CSV exports.
// Everything is derived from lib/money.ts so all four always agree.
import { bnDate, bnMonth, isISODate, monthOf, monthRange, prevMonth, todayISO } from "./format";
import {
  categoryTotals,
  change,
  filterExpenses,
  labourStats,
  monthlyTotals,
  type ExpenseLike,
  type PayerFilter,
} from "./money";

export const PERIODS = [
  { key: "this_month", label: "এই মাস" },
  { key: "last_month", label: "গত মাস" },
  { key: "this_year", label: "এই বছর" },
  { key: "all", label: "শুরু থেকে" },
  { key: "custom", label: "কাস্টম তারিখ" },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

export type CategoryParams = {
  period: PeriodKey;
  from?: string;
  to?: string;
  payer: PayerFilter;
  categoryIds: number[];
};

type RawParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Read ?p=&from=&to=&payer=&cats= (default: শুরু থেকে, everyone, all categories). */
export function parseCategoryParams(sp: RawParams): CategoryParams {
  const p = one(sp.p);
  const period: PeriodKey = PERIODS.some((x) => x.key === p) ? (p as PeriodKey) : "all";
  const from = isISODate(one(sp.from)) ? one(sp.from) : undefined;
  const to = isISODate(one(sp.to)) ? one(sp.to) : undefined;
  const payerRaw = one(sp.payer);
  const payer: PayerFilter = payerRaw === "fund" ? "fund" : /^\d+$/.test(payerRaw) ? Number(payerRaw) : "all";
  const categoryIds = one(sp.cats)
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return { period, from, to, payer, categoryIds };
}

/** Back to a query string (for links, print and CSV URLs). */
export function categoryQuery(p: CategoryParams, overrides: Partial<CategoryParams> = {}): string {
  const v = { ...p, ...overrides };
  const q = new URLSearchParams();
  if (v.period !== "all") q.set("p", v.period);
  if (v.period === "custom") {
    if (v.from) q.set("from", v.from);
    if (v.to) q.set("to", v.to);
  }
  if (v.payer !== "all") q.set("payer", String(v.payer));
  if (v.categoryIds.length) q.set("cats", v.categoryIds.join(","));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type ResolvedPeriod = { from?: string; to?: string; label: string };

export function resolvePeriod(p: Pick<CategoryParams, "period" | "from" | "to">, today = todayISO()): ResolvedPeriod {
  const month = monthOf(today);
  switch (p.period) {
    case "this_month":
      return { ...monthRange(month), label: `এই মাস (${bnMonth(month)})` };
    case "last_month": {
      const m = prevMonth(month);
      return { ...monthRange(m), label: `গত মাস (${bnMonth(m)})` };
    }
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31`, label: "এই বছর" };
    case "custom": {
      let { from, to } = p;
      if (from && to && from > to) [from, to] = [to, from];
      const label = `${from ? bnDate(from) : "শুরু"} – ${to ? bnDate(to) : "আজ"}`;
      return { from, to, label };
    }
    default:
      return { label: "শুরু থেকে" };
  }
}

type Cat = { id: number; name: string; icon: string; color: string };

export type CategoryRow = {
  category: Cat;
  total: number;
  count: number;
  percent: number;
  labourDays: number;
  thisMonth: number;
  lastMonth: number;
  change: { diff: number; percent: number | null };
};

export function payerLabel(payer: PayerFilter, partners: { id: number; name: string }[]) {
  if (payer === "all") return "সবাই";
  if (payer === "fund") return "ফান্ড থেকে";
  return partners.find((p) => p.id === payer)?.name ?? "?";
}

/** খাত list: one row per category with spending in the period, highest first. */
export function buildCategoryView(
  expenses: ExpenseLike[],
  categories: Cat[],
  params: CategoryParams,
  today = todayISO(),
) {
  const period = resolvePeriod(params, today);
  const filter = { from: period.from, to: period.to, payer: params.payer, categoryIds: params.categoryIds };
  const result = categoryTotals(expenses, filter);

  const thisM = monthRange(monthOf(today));
  const lastM = monthRange(prevMonth(monthOf(today)));
  const cmpFilter = { payer: params.payer, categoryIds: params.categoryIds };
  const thisTotals = categoryTotals(expenses, { ...cmpFilter, ...thisM });
  const lastTotals = categoryTotals(expenses, { ...cmpFilter, ...lastM });
  const amountIn = (r: typeof thisTotals, id: number) => r.rows.find((x) => x.categoryId === id)?.total ?? 0;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows: CategoryRow[] = result.rows.map((r) => {
    const thisMonth = amountIn(thisTotals, r.categoryId);
    const lastMonth = amountIn(lastTotals, r.categoryId);
    return {
      category: byId.get(r.categoryId) ?? { id: r.categoryId, name: "?", icon: "ellipsis", color: "#6b7280" },
      total: r.total,
      count: r.count,
      percent: r.percent,
      labourDays: r.labourDays,
      thisMonth,
      lastMonth,
      change: change(thisMonth, lastMonth),
    };
  });
  return { period, rows, total: result.total, count: result.count, labourDays: result.labourDays };
}

/** Every "yyyy-mm" from `from` to `to` inclusive. */
export function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const out: string[] = [];
  let m = fromMonth;
  while (m <= toMonth && out.length < 600) {
    out.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}

/** One category (or the selected few) over the period: month-by-month, average, entries. */
export function buildCategoryDetail<E extends ExpenseLike>(
  expenses: E[],
  categoryId: number,
  params: Omit<CategoryParams, "categoryIds">,
  today = todayISO(),
) {
  const period = resolvePeriod(params, today);
  const entries = filterExpenses(expenses, {
    from: period.from,
    to: period.to,
    payer: params.payer,
    categoryIds: [categoryId],
  }).sort((a, b) => b.date.localeCompare(a.date));
  const total = entries.reduce((a, e) => a + e.amount, 0);
  const buckets = new Map(monthlyTotals(entries).map((b) => [b.key, b]));

  // Months shown: the whole period (capped at this month); for "শুরু থেকে" from the first entry.
  const lastMonth = monthOf(period.to && period.to < today ? period.to : today);
  const firstMonth = period.from
    ? monthOf(period.from)
    : entries.length
      ? monthOf(entries[entries.length - 1].date)
      : lastMonth;
  const months = monthsBetween(firstMonth, lastMonth).map((m) => ({
    month: m,
    total: buckets.get(m)?.total ?? 0,
    count: buckets.get(m)?.count ?? 0,
  }));
  const avgPerMonth = months.length ? Math.round(total / months.length) : 0;
  return { period, entries, total, count: entries.length, months, avgPerMonth, labour: labourStats(entries) };
}
