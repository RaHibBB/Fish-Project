import { describe, expect, it } from "vitest";
import {
  allocate,
  categoryTotals,
  change,
  dailyTotals,
  filterExpenses,
  fundBalance,
  labourStats,
  monthlyTotals,
  partnerPositions,
  settleUp,
  totalExpense,
  type ContributionLike,
  type ExpenseLike,
  type Ledger,
  type PartnerInfo,
  type WithdrawalLike,
} from "./money";

const RAFI = 1;
const REAZ = 2;
const OVI = 3;
const LABOUR = 10;
const FEED = 11;
const LIME = 12;

const EQUAL: PartnerInfo[] = [
  { id: RAFI, name: "রাফি", shareBp: 3334 },
  { id: REAZ, name: "রিয়াজ", shareBp: 3333 },
  { id: OVI, name: "অভি", shareBp: 3333 },
];

const exp = (amount: number, o: Partial<ExpenseLike> = {}): ExpenseLike => ({
  date: "2026-05-01",
  categoryId: FEED,
  amount,
  paidByPartnerId: null,
  labourCount: null,
  voidedAt: null,
  ...o,
});
const contrib = (partnerId: number, amount: number, o: Partial<ContributionLike> = {}): ContributionLike => ({
  date: "2026-04-01",
  partnerId,
  amount,
  voidedAt: null,
  ...o,
});
const withdraw = (partnerId: number, amount: number): WithdrawalLike => ({
  date: "2026-06-01",
  partnerId,
  amount,
  voidedAt: null,
});

const netSum = (l: Ledger, p: PartnerInfo[]) => partnerPositions(l, p).reduce((a, x) => a + x.net, 0);
const byId = (l: Ledger, p: PartnerInfo[]) => new Map(partnerPositions(l, p).map((x) => [x.partnerId, x]));

describe("allocate", () => {
  it("splits exactly, remainder to the largest share", () => {
    const a = allocate(100, EQUAL);
    expect([...a.values()]).toEqual([34, 33, 33]);
    const b = allocate(302830, EQUAL);
    expect([...b.values()].reduce((x, y) => x + y, 0)).toBe(302830);
  });

  it("handles negative amounts symmetrically", () => {
    const a = allocate(-2830, EQUAL);
    expect([...a.values()].reduce((x, y) => x + y, 0)).toBe(-2830);
    expect(a.get(RAFI)).toBe(-944);
    expect(a.get(REAZ)).toBe(-943);
  });

  it("gives the remainder to the largest share when shares are unequal", () => {
    const shares: PartnerInfo[] = [
      { id: RAFI, name: "a", shareBp: 2000 },
      { id: REAZ, name: "b", shareBp: 5000 },
      { id: OVI, name: "c", shareBp: 3000 },
    ];
    const a = allocate(7, shares);
    expect(a.get(REAZ)! + a.get(RAFI)! + a.get(OVI)!).toBe(7);
    expect(a.get(REAZ)).toBe(4); // 3 + leftover 1
  });
});

describe("fund balance", () => {
  it("is contributions − fund-paid expenses − withdrawals", () => {
    const l: Ledger = {
      contributions: [contrib(RAFI, 100000), contrib(REAZ, 100000), contrib(OVI, 100000)],
      expenses: [exp(4920), exp(50000, { paidByPartnerId: RAFI })],
      withdrawals: [withdraw(OVI, 1000)],
    };
    expect(fundBalance(l)).toBe(300000 - 4920 - 1000);
    expect(totalExpense(l.expenses)).toBe(54920);
  });

  it("can go negative (fund overspent, like the sheet: −2,830)", () => {
    const l: Ledger = {
      contributions: [contrib(RAFI, 100000), contrib(REAZ, 100000), contrib(OVI, 100000)],
      expenses: [exp(302830)],
      withdrawals: [],
    };
    expect(fundBalance(l)).toBe(-2830);
    const pos = byId(l, EQUAL);
    // Everyone paid the same and the fund paid everything, so positions are ~0. With the default
    // 3334/3333/3333 shares Rafi carries 0.01% more of the cost: fair 100,964 / 100,933 / 100,933,
    // fund share −944 / −943 / −943.
    expect([...pos.values()].map((p) => p.net)).toEqual([-20, 10, 10]);
    expect(netSum(l, EQUAL)).toBe(0);
  });
});

describe("partner positions", () => {
  it("credits a partner who paid personally", () => {
    const l: Ledger = {
      contributions: [contrib(RAFI, 100000), contrib(REAZ, 100000), contrib(OVI, 100000)],
      expenses: [exp(30000, { paidByPartnerId: RAFI })],
      withdrawals: [],
    };
    const p = byId(l, EQUAL);
    expect(p.get(RAFI)!.putIn).toBe(130000);
    expect(p.get(RAFI)!.paidPersonally).toBe(30000);
    // Default shares 3334/3333/3333: fair 10,002 / 9,999 / 9,999; untouched fund 300,000 → 100,020 / 99,990 / 99,990.
    expect(p.get(RAFI)!.net).toBe(130000 - 10002 - 100020); // 19,978 ≈ the 20,000 others owe him
    expect(p.get(REAZ)!.net).toBe(100000 - 9999 - 99990); // −9,989
    expect(p.get(OVI)!.net).toBe(-9989);
    expect(netSum(l, EQUAL)).toBe(0);
    expect(settleUp(partnerPositions(l, EQUAL))).toEqual([
      { fromId: REAZ, fromName: "রিয়াজ", toId: RAFI, toName: "রাফি", amount: 9989 },
      { fromId: OVI, fromName: "অভি", toId: RAFI, toName: "রাফি", amount: 9989 },
    ]);
  });

  it("respects unequal shares", () => {
    const shares: PartnerInfo[] = [
      { id: RAFI, name: "রাফি", shareBp: 5000 },
      { id: REAZ, name: "রিয়াজ", shareBp: 3000 },
      { id: OVI, name: "অভি", shareBp: 2000 },
    ];
    // Everyone put in 1/3, but shares are 50/30/20 and the money is all spent.
    const l: Ledger = {
      contributions: [contrib(RAFI, 30000), contrib(REAZ, 30000), contrib(OVI, 30000)],
      expenses: [exp(90000)],
      withdrawals: [],
    };
    const p = byId(l, shares);
    expect(p.get(RAFI)!.fairShare).toBe(45000);
    expect(p.get(RAFI)!.net).toBe(-15000);
    expect(p.get(REAZ)!.net).toBe(3000);
    expect(p.get(OVI)!.net).toBe(12000);
    expect(netSum(l, shares)).toBe(0);
  });

  it("counts the unspent fund as each partner's money", () => {
    const l: Ledger = {
      contributions: [contrib(RAFI, 60000), contrib(REAZ, 30000), contrib(OVI, 30000)],
      expenses: [exp(30000)],
      withdrawals: [],
    };
    // Fund 90,000 left → 30,006 / 29,997 / 29,997; fair 10,002 / 9,999 / 9,999.
    // Rafi put in 30,000 more than the others, so ≈ +20,000 / −10,000 / −10,000.
    const p = byId(l, EQUAL);
    expect(fundBalance(l)).toBe(90000);
    expect(p.get(RAFI)!.net).toBe(60000 - 10002 - 30006);
    expect(p.get(REAZ)!.net).toBe(30000 - 9999 - 29997);
    expect(p.get(RAFI)!.net).toBe(19992);
    expect(netSum(l, EQUAL)).toBe(0);
  });

  it("subtracts withdrawals", () => {
    const l: Ledger = {
      contributions: [contrib(RAFI, 50000), contrib(REAZ, 50000), contrib(OVI, 50000)],
      expenses: [],
      withdrawals: [withdraw(OVI, 30000)],
    };
    const p = byId(l, EQUAL);
    // Fund 120,000 → 40,008 / 39,996 / 39,996
    expect(p.get(OVI)!.putIn).toBe(20000);
    expect(p.get(OVI)!.net).toBe(20000 - 39996);
    expect(p.get(RAFI)!.net).toBe(50000 - 40008);
    expect(netSum(l, EQUAL)).toBe(0);
  });

  it("ignores voided rows everywhere", () => {
    const voided = new Date("2026-05-02T00:00:00Z");
    const l: Ledger = {
      contributions: [contrib(RAFI, 100000), contrib(REAZ, 100000), contrib(OVI, 999999, { voidedAt: voided })],
      expenses: [exp(9000), exp(50000, { paidByPartnerId: REAZ, voidedAt: voided })],
      withdrawals: [{ ...withdraw(RAFI, 5000), voidedAt: voided }],
    };
    expect(fundBalance(l)).toBe(200000 - 9000);
    expect(totalExpense(l.expenses)).toBe(9000);
    const p = byId(l, EQUAL);
    expect(p.get(OVI)!.putIn).toBe(0);
    expect(p.get(REAZ)!.paidPersonally).toBe(0);
    expect(p.get(RAFI)!.withdrawn).toBe(0);
    expect(netSum(l, EQUAL)).toBe(0);
  });

  it("net positions always sum to exactly zero with awkward numbers", () => {
    const shares: PartnerInfo[] = [
      { id: RAFI, name: "a", shareBp: 3334 },
      { id: REAZ, name: "b", shareBp: 3333 },
      { id: OVI, name: "c", shareBp: 3333 },
    ];
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let run = 0; run < 200; run++) {
      const l: Ledger = {
        contributions: Array.from({ length: rnd(5) }, () => contrib(1 + rnd(3), 1 + rnd(100001))),
        expenses: Array.from({ length: rnd(20) }, () =>
          exp(1 + rnd(9999), { paidByPartnerId: rnd(2) ? null : 1 + rnd(3) }),
        ),
        withdrawals: Array.from({ length: rnd(2) }, () => withdraw(1 + rnd(3), 1 + rnd(5000))),
        sales: Array.from({ length: rnd(4) }, () => ({
          date: "2026-08-01",
          amount: 1 + rnd(80000),
          receivedByPartnerId: rnd(2) ? null : 1 + rnd(3),
          voidedAt: null,
        })),
      };
      expect(netSum(l, shares)).toBe(0);
      const transfers = settleUp(partnerPositions(l, shares));
      expect(transfers.length).toBeLessThanOrEqual(2);
    }
  });
});

describe("settle-up", () => {
  it("produces the minimal transfers", () => {
    const t = settleUp([
      { partnerId: RAFI, name: "রাফি", net: 12500 },
      { partnerId: REAZ, name: "রিয়াজ", net: 0 },
      { partnerId: OVI, name: "অভি", net: -12500 },
    ]);
    expect(t).toEqual([{ fromId: OVI, fromName: "অভি", toId: RAFI, toName: "রাফি", amount: 12500 }]);
    expect(settleUp([{ partnerId: RAFI, name: "a", net: 0 }])).toEqual([]);
  });
});

describe("period and category totals", () => {
  const voided = new Date();
  const rows: ExpenseLike[] = [
    exp(4920, { date: "2026-04-28", categoryId: LABOUR, labourCount: 6 }),
    exp(3280, { date: "2026-04-29", categoryId: LABOUR, labourCount: 4 }),
    exp(4920, { date: "2026-05-02", categoryId: LABOUR, labourCount: 6 }),
    exp(2750, { date: "2026-05-02", categoryId: FEED, paidByPartnerId: RAFI }),
    exp(1500, { date: "2026-05-10", categoryId: LIME }),
    exp(99999, { date: "2026-05-11", categoryId: FEED, voidedAt: voided }),
  ];

  it("totals per day and per month", () => {
    expect(dailyTotals(rows).find((d) => d.key === "2026-05-02")).toEqual({ key: "2026-05-02", total: 7670, count: 2 });
    expect(monthlyTotals(rows)).toEqual([
      { key: "2026-04", total: 8200, count: 2 },
      { key: "2026-05", total: 9170, count: 3 },
    ]);
  });

  it("category rows add up to the overall total for the same period", () => {
    const all = categoryTotals(rows);
    expect(all.total).toBe(17370);
    expect(all.rows.reduce((a, r) => a + r.total, 0)).toBe(all.total);
    expect(all.rows.map((r) => r.categoryId)).toEqual([LABOUR, FEED, LIME]);
    expect(all.rows.reduce((a, r) => a + r.percent, 0)).toBeCloseTo(100);
    expect(all.labourDays).toBe(16);

    const may = categoryTotals(rows, { from: "2026-05-01", to: "2026-05-31" });
    expect(may.total).toBe(totalExpense(filterExpenses(rows, { from: "2026-05-01", to: "2026-05-31" })));
    expect(may.rows.find((r) => r.categoryId === LABOUR)).toMatchObject({ total: 4920, count: 1, labourDays: 6 });
  });

  it("filters by payer and by several categories", () => {
    expect(categoryTotals(rows, { payer: RAFI }).total).toBe(2750);
    expect(categoryTotals(rows, { payer: "fund" }).total).toBe(17370 - 2750);
    expect(categoryTotals(rows, { categoryIds: [FEED, LIME] }).total).toBe(4250);
    expect(categoryTotals(rows, { from: "2026-06-01" })).toEqual({ rows: [], total: 0, count: 0, labourDays: 0 });
  });

  it("computes labour stats and month-on-month change", () => {
    expect(labourStats(rows)).toEqual({ labourDays: 16, workingDays: 3, avgPerDay: 16 / 3 });
    expect(change(150, 100)).toEqual({ diff: 50, percent: 50 });
    expect(change(100, 0)).toEqual({ diff: 100, percent: null });
  });
});

describe("fish sales", () => {
  const sale = (amount: number, receivedByPartnerId: number | null = null) => ({
    date: "2026-08-01",
    amount,
    receivedByPartnerId,
    voidedAt: null,
  });

  it("money paid into the fund raises the cash box", () => {
    const l: Ledger = { contributions: [contrib(RAFI, 50000)], expenses: [exp(20000)], withdrawals: [], sales: [sale(30000)] };
    expect(fundBalance(l)).toBe(60000);
  });

  it("a partner who keeps sale cash holds it for the farm and the others are owed", () => {
    const shares: PartnerInfo[] = [
      { id: RAFI, name: "রাফি", shareBp: 5000 },
      { id: REAZ, name: "রিয়াজ", shareBp: 5000 },
    ];
    // Both put in 50,000; 60,000 spent from the fund; Rafi sold fish for 30,000 and kept the cash.
    const l: Ledger = {
      contributions: [contrib(RAFI, 50000), contrib(REAZ, 50000)],
      expenses: [exp(60000)],
      withdrawals: [],
      sales: [sale(30000, RAFI)],
    };
    const p = byId(l, shares);
    expect(fundBalance(l)).toBe(40000);
    expect(p.get(RAFI)!.salesHeld).toBe(30000);
    expect(p.get(RAFI)!.fairShare).toBe(15000); // (60,000 − 30,000) / 2
    expect(p.get(RAFI)!.net).toBe(-15000); // owes Reaz half of the cash he kept
    expect(p.get(REAZ)!.net).toBe(15000);
    expect(netSum(l, shares)).toBe(0);
  });

  it("profit (income > expense) still sums to zero and ignores voided sales", () => {
    const l: Ledger = {
      contributions: [contrib(RAFI, 10000), contrib(REAZ, 10000), contrib(OVI, 10000)],
      expenses: [exp(9000)],
      withdrawals: [],
      sales: [sale(50000), sale(7777, OVI), { ...sale(99999), voidedAt: new Date() }],
    };
    expect(netSum(l, EQUAL)).toBe(0);
    expect(fundBalance(l)).toBe(30000 + 50000 - 9000);
  });
});
