import { describe, expect, it } from "vitest";
import {
  buildCategoryDetail,
  buildCategoryView,
  categoryQuery,
  monthsBetween,
  parseCategoryParams,
  resolvePeriod,
} from "./category-view";
import { totalExpense, filterExpenses, type ExpenseLike } from "./money";

const TODAY = "2026-07-15";
const LABOUR = 1;
const FEED = 2;
const LIME = 3;
const cats = [
  { id: LABOUR, name: "শ্রমিক মজুরি", icon: "users", color: "#000" },
  { id: FEED, name: "খাবার", icon: "wheat", color: "#000" },
  { id: LIME, name: "চুন ও সার", icon: "sprout", color: "#000" },
];
const e = (id: number, date: string, categoryId: number, amount: number, o: Partial<ExpenseLike> = {}) => ({
  id,
  date,
  categoryId,
  amount,
  paidByPartnerId: null,
  labourCount: null,
  voidedAt: null,
  ...o,
});
const rows = [
  e(1, "2026-05-02", LABOUR, 4920, { labourCount: 6 }),
  e(2, "2026-06-01", FEED, 2750, { paidByPartnerId: 7 }),
  e(3, "2026-06-20", FEED, 1250),
  e(4, "2026-06-21", FEED, 9999, { voidedAt: new Date() }),
  e(5, "2026-06-25", LABOUR, 3280, { labourCount: 4 }),
  e(6, "2026-07-03", FEED, 500),
  e(7, "2026-07-04", LIME, 1500),
  e(8, "2026-07-05", LABOUR, 4100, { labourCount: 5 }),
];
const base = parseCategoryParams({});

describe("periods", () => {
  it("resolves the preset periods relative to today", () => {
    expect(resolvePeriod({ period: "this_month" }, TODAY)).toMatchObject({ from: "2026-07-01", to: "2026-07-31" });
    expect(resolvePeriod({ period: "last_month" }, TODAY)).toMatchObject({ from: "2026-06-01", to: "2026-06-30" });
    expect(resolvePeriod({ period: "this_year" }, TODAY)).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
    expect(resolvePeriod({ period: "all" }, TODAY)).toEqual({ label: "শুরু থেকে" });
    expect(resolvePeriod({ period: "custom", from: "2026-06-30", to: "2026-06-01" }, TODAY)).toMatchObject({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("round-trips URL params", () => {
    const p = parseCategoryParams({ p: "custom", from: "2026-06-01", to: "2026-06-30", payer: "fund", cats: "2,3" });
    expect(p).toEqual({ period: "custom", from: "2026-06-01", to: "2026-06-30", payer: "fund", categoryIds: [2, 3] });
    expect(categoryQuery(p)).toBe("?p=custom&from=2026-06-01&to=2026-06-30&payer=fund&cats=2%2C3");
    expect(parseCategoryParams({ p: "nonsense", payer: "x", cats: "a,0,-1" })).toEqual(base);
  });
});

describe("খাত view", () => {
  it("গত মাস + খাবার shows the right total (voided row excluded)", () => {
    const v = buildCategoryView(rows, cats, { ...base, period: "last_month", categoryIds: [FEED] }, TODAY);
    expect(v.total).toBe(4000);
    expect(v.rows).toHaveLength(1);
    expect(v.rows[0]).toMatchObject({ total: 4000, count: 2, percent: 100 });
    const d = buildCategoryDetail(rows, FEED, { ...base, period: "last_month" }, TODAY);
    expect(d.total).toBe(4000);
    expect(d.entries.map((x) => x.id)).toEqual([3, 2]);
  });

  it("category rows always add up to the overall total for the same period", () => {
    for (const period of ["this_month", "last_month", "this_year", "all"] as const) {
      for (const payer of ["all", "fund", 7] as const) {
        const v = buildCategoryView(rows, cats, { ...base, period, payer }, TODAY);
        const r = resolvePeriod({ period }, TODAY);
        expect(v.rows.reduce((a, x) => a + x.total, 0)).toBe(v.total);
        expect(v.total).toBe(totalExpense(filterExpenses(rows, { from: r.from, to: r.to, payer })));
      }
    }
  });

  it("sorts highest first and compares this month with last month", () => {
    const v = buildCategoryView(rows, cats, base, TODAY);
    expect(v.rows.map((r) => r.category.id)).toEqual([LABOUR, FEED, LIME]);
    const labour = v.rows[0];
    expect(labour).toMatchObject({ total: 12300, labourDays: 15, thisMonth: 4100, lastMonth: 3280 });
    expect(labour.change.diff).toBe(820);
    expect(labour.change.percent).toBeCloseTo(25);
    expect(v.rows.find((r) => r.category.id === LIME)!.change.percent).toBeNull();
  });

  it("filters by payer and multiple categories", () => {
    expect(buildCategoryView(rows, cats, { ...base, payer: 7 }, TODAY).total).toBe(2750);
    expect(buildCategoryView(rows, cats, { ...base, categoryIds: [FEED, LIME] }, TODAY).total).toBe(6000);
  });
});

describe("category detail", () => {
  it("shows month by month with gaps, average and labour stats", () => {
    const d = buildCategoryDetail(rows, LABOUR, base, TODAY);
    expect(d.months).toEqual([
      { month: "2026-05", total: 4920, count: 1 },
      { month: "2026-06", total: 3280, count: 1 },
      { month: "2026-07", total: 4100, count: 1 },
    ]);
    expect(d.avgPerMonth).toBe(4100);
    expect(d.labour).toEqual({ labourDays: 15, workingDays: 3, avgPerDay: 5 });
  });

  it("lists months across the whole selected period", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    const d = buildCategoryDetail(rows, LIME, { ...base, period: "this_year" }, TODAY);
    expect(d.months.map((m) => m.month)).toEqual(monthsBetween("2026-01", "2026-07"));
    expect(d.total).toBe(1500);
  });
});
