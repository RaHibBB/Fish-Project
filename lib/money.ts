// Pure money logic. All amounts are integer taka; voided rows never count.

export type PartnerInfo = { id: number; name: string; shareBp: number };

type Voidable = { voidedAt: Date | string | null };

export type ExpenseLike = Voidable & {
  date: string; // yyyy-mm-dd
  categoryId: number;
  amount: number;
  /** null = paid from the fund */
  paidByPartnerId: number | null;
  labourCount?: number | null;
};

export type ContributionLike = Voidable & { date: string; partnerId: number; amount: number };
export type WithdrawalLike = Voidable & { date: string; partnerId: number; amount: number };
/** Fish sold. receivedByPartnerId null = paid into the fund. */
export type SaleLike = Voidable & { date: string; amount: number; receivedByPartnerId: number | null };

export type Ledger = {
  expenses: ExpenseLike[];
  contributions: ContributionLike[];
  withdrawals: WithdrawalLike[];
  /** optional so older callers/tests without sales keep working */
  sales?: SaleLike[];
};

export const TOTAL_BP = 10000;

export function isActive(row: Voidable) {
  return row.voidedAt == null;
}

export function active<T extends Voidable>(rows: T[]): T[] {
  return rows.filter(isActive);
}

function sum<T>(rows: T[], pick: (r: T) => number) {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

/** ক্যাশ বাক্স = Σ contributions + Σ sales paid into the fund − Σ fund expenses − Σ withdrawals. */
export function fundBalance(ledger: Ledger): number {
  return (
    sum(active(ledger.contributions), (c) => c.amount) +
    sum(
      active(ledger.sales ?? []).filter((s) => s.receivedByPartnerId === null),
      (s) => s.amount,
    ) -
    sum(
      active(ledger.expenses).filter((e) => e.paidByPartnerId === null),
      (e) => e.amount,
    ) -
    sum(active(ledger.withdrawals), (w) => w.amount)
  );
}

/** Σ all non-voided sales (income), wherever the cash went. */
export function totalIncome(sales: SaleLike[] = []): number {
  return sum(active(sales), (s) => s.amount);
}

/** Σ all non-voided expenses, whether paid from the fund or personally. */
export function totalExpense(expenses: ExpenseLike[]): number {
  return sum(active(expenses), (e) => e.amount);
}

/**
 * Split an integer amount by basis-point shares so the parts sum to exactly `amount`.
 * Each part is rounded toward zero; the leftover taka go to the largest share
 * (first one in order on a tie). Works for negative amounts too.
 */
export function allocate(amount: number, partners: PartnerInfo[]): Map<number, number> {
  const result = new Map<number, number>();
  if (partners.length === 0) return result;
  const totalBp = sum(partners, (p) => p.shareBp);
  if (totalBp <= 0) throw new Error("Partner shares must be positive");
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  let allocated = 0;
  for (const p of partners) {
    const part = Math.floor((abs * p.shareBp) / totalBp);
    result.set(p.id, part);
    allocated += part;
  }
  const largest = partners.reduce((best, p) => (p.shareBp > best.shareBp ? p : best), partners[0]);
  result.set(largest.id, result.get(largest.id)! + (abs - allocated));
  if (sign < 0) for (const [id, v] of result) result.set(id, v === 0 ? 0 : -v);
  return result;
}

export type PartnerPosition = {
  partnerId: number;
  name: string;
  shareBp: number;
  contributed: number;
  paidPersonally: number;
  withdrawn: number;
  /** sale money this partner received and is holding for the farm */
  salesHeld: number;
  /** দিয়েছেন = contributions + personal payments − withdrawals − sale money held */
  putIn: number;
  /** ভাগের খরচ = (total expense − total income) × share */
  fairShare: number;
  /** this partner's slice of the current fund balance */
  fundShare: number;
  /** অবস্থান: positive = others owe them, negative = they owe */
  net: number;
};

export function partnerPositions(ledger: Ledger, partners: PartnerInfo[]): PartnerPosition[] {
  const expenses = active(ledger.expenses);
  const contributions = active(ledger.contributions);
  const withdrawals = active(ledger.withdrawals);
  const sales = active(ledger.sales ?? []);
  const fair = allocate(totalExpense(expenses) - totalIncome(sales), partners);
  const fund = allocate(fundBalance({ expenses, contributions, withdrawals, sales }), partners);

  return partners.map((p) => {
    const contributed = sum(
      contributions.filter((c) => c.partnerId === p.id),
      (c) => c.amount,
    );
    const paidPersonally = sum(
      expenses.filter((e) => e.paidByPartnerId === p.id),
      (e) => e.amount,
    );
    const withdrawn = sum(
      withdrawals.filter((w) => w.partnerId === p.id),
      (w) => w.amount,
    );
    const salesHeld = sum(
      sales.filter((s) => s.receivedByPartnerId === p.id),
      (s) => s.amount,
    );
    const putIn = contributed + paidPersonally - withdrawn - salesHeld;
    const fairShare = fair.get(p.id)!;
    const fundShare = fund.get(p.id)!;
    return {
      partnerId: p.id,
      name: p.name,
      shareBp: p.shareBp,
      contributed,
      paidPersonally,
      withdrawn,
      salesHeld,
      putIn,
      fairShare,
      fundShare,
      net: putIn - fairShare - fundShare,
    };
  });
}

export type Transfer = { fromId: number; fromName: string; toId: number; toName: string; amount: number };

/**
 * Minimal list of payments that brings every net position to zero: repeatedly the
 * biggest debtor pays the biggest creditor. At most (partners − 1) transfers.
 */
export function settleUp(positions: Pick<PartnerPosition, "partnerId" | "name" | "net">[]): Transfer[] {
  const debtors = positions.filter((p) => p.net < 0).map((p) => ({ ...p, left: -p.net }));
  const creditors = positions.filter((p) => p.net > 0).map((p) => ({ ...p, left: p.net }));
  const transfers: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.left - a.left);
    creditors.sort((a, b) => b.left - a.left);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.left, c.left);
    transfers.push({ fromId: d.partnerId, fromName: d.name, toId: c.partnerId, toName: c.name, amount });
    d.left -= amount;
    c.left -= amount;
    if (d.left === 0) debtors.shift();
    if (c.left === 0) creditors.shift();
  }
  return transfers;
}

// ---------------------------------------------------------------------------
// Period / category totals

/** "all" = everyone, "fund" = paid from the fund, number = paid personally by that partner. */
export type PayerFilter = "all" | "fund" | number;

export type ExpenseFilter = {
  from?: string; // inclusive yyyy-mm-dd
  to?: string; // inclusive yyyy-mm-dd
  payer?: PayerFilter;
  categoryIds?: number[]; // empty / undefined = all categories
};

export function filterExpenses<T extends ExpenseLike>(expenses: T[], f: ExpenseFilter = {}): T[] {
  const cats = f.categoryIds?.length ? new Set(f.categoryIds) : null;
  const payer = f.payer ?? "all";
  return active(expenses).filter(
    (e) =>
      (!f.from || e.date >= f.from) &&
      (!f.to || e.date <= f.to) &&
      (!cats || cats.has(e.categoryId)) &&
      (payer === "all" || (payer === "fund" ? e.paidByPartnerId === null : e.paidByPartnerId === payer)),
  );
}

export type Bucket = { key: string; total: number; count: number };

function bucketBy(expenses: ExpenseLike[], keyOf: (e: ExpenseLike) => string): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const e of active(expenses)) {
    const key = keyOf(e);
    const b = map.get(key) ?? { key, total: 0, count: 0 };
    b.total += e.amount;
    b.count += 1;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Per-day totals, oldest first (key = yyyy-mm-dd). */
export function dailyTotals(expenses: ExpenseLike[]): Bucket[] {
  return bucketBy(expenses, (e) => e.date);
}

/** Per-month totals, oldest first (key = yyyy-mm). */
export function monthlyTotals(expenses: ExpenseLike[]): Bucket[] {
  return bucketBy(expenses, (e) => e.date.slice(0, 7));
}

export type CategoryTotal = {
  categoryId: number;
  total: number;
  count: number;
  /** share of the period total, 0–100 */
  percent: number;
  /** Σ labour_count */
  labourDays: number;
};

export type CategoryTotalsResult = {
  rows: CategoryTotal[]; // highest total first
  total: number; // always equals Σ rows.total
  count: number;
  labourDays: number;
};

/** Totals per category for a period / payer / category selection (used by খাত and its exports). */
export function categoryTotals(expenses: ExpenseLike[], f: ExpenseFilter = {}): CategoryTotalsResult {
  const rows = new Map<number, CategoryTotal>();
  let total = 0;
  let count = 0;
  let labourDays = 0;
  for (const e of filterExpenses(expenses, f)) {
    const r = rows.get(e.categoryId) ?? { categoryId: e.categoryId, total: 0, count: 0, percent: 0, labourDays: 0 };
    r.total += e.amount;
    r.count += 1;
    r.labourDays += e.labourCount ?? 0;
    rows.set(e.categoryId, r);
    total += e.amount;
    count += 1;
    labourDays += e.labourCount ?? 0;
  }
  const list = [...rows.values()]
    .map((r) => ({ ...r, percent: total ? (r.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total || a.categoryId - b.categoryId);
  return { rows: list, total, count, labourDays };
}

/** Labour summary for a set of expenses: Σ labour_count and average labourers per working day. */
export function labourStats(expenses: ExpenseLike[]) {
  const labour = active(expenses).filter((e) => (e.labourCount ?? 0) > 0);
  const labourDays = sum(labour, (e) => e.labourCount ?? 0);
  const days = new Set(labour.map((e) => e.date)).size;
  return { labourDays, workingDays: days, avgPerDay: days ? labourDays / days : 0 };
}

/** Change between two amounts: ৳ difference and % (null when the previous amount is 0). */
export function change(current: number, previous: number) {
  return {
    diff: current - previous,
    percent: previous === 0 ? null : ((current - previous) / previous) * 100,
  };
}
