// Shop credit (বাকি): what is owed to each shop. Pure logic; voided rows never count.
// A credit purchase (expense with onCredit) adds to what we owe; a due payment reduces it.

type Voidable = { voidedAt: Date | string | null };
export type CreditExpenseLike = Voidable & { date: string; amount: number; onCredit?: boolean; shop?: string };
export type DuePaymentRow = Voidable & { date: string; amount: number; shop?: string };

export type ShopDue = {
  /** name as last typed */
  shop: string;
  bought: number;
  paid: number;
  /** bought − paid (negative = paid more than was owed) */
  due: number;
  lastDate: string;
};

/** Same shop even if typed with different spaces or letter case. */
export function shopKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function duesByShop(expenses: CreditExpenseLike[], payments: DuePaymentRow[] = []): ShopDue[] {
  const map = new Map<string, ShopDue & { _at: string }>();
  const touch = (name: string, date: string) => {
    const key = shopKey(name);
    const row = map.get(key) ?? { shop: name.trim(), bought: 0, paid: 0, due: 0, lastDate: date, _at: date };
    if (date >= row._at) {
      row._at = date;
      row.shop = name.trim();
      row.lastDate = date;
    }
    map.set(key, row);
    return row;
  };
  for (const e of expenses) {
    if (e.voidedAt != null || !e.onCredit || !e.shop?.trim()) continue;
    touch(e.shop, e.date).bought += e.amount;
  }
  for (const p of payments) {
    if (p.voidedAt != null || !p.shop?.trim()) continue;
    touch(p.shop, p.date).paid += p.amount;
  }
  return [...map.values()]
    .map(({ _at, ...r }) => {
      void _at;
      return { ...r, due: r.bought - r.paid };
    })
    .sort((a, b) => b.due - a.due || b.lastDate.localeCompare(a.lastDate));
}

/** Total still owed to all shops. */
export function totalDue(expenses: CreditExpenseLike[], payments: DuePaymentRow[] = []): number {
  return duesByShop(expenses, payments).reduce((a, s) => a + s.due, 0);
}

/** Outstanding for one shop (0 when unknown). */
export function dueForShop(expenses: CreditExpenseLike[], payments: DuePaymentRow[], shop: string): number {
  const key = shopKey(shop);
  return duesByShop(expenses, payments).find((s) => shopKey(s.shop) === key)?.due ?? 0;
}
