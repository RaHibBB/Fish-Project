// Unified list of expenses, contributions and withdrawals for the হিসাব screen and Home.
import { toBnDigits } from "./format";

export type EntryKind = "expense" | "contribution" | "withdrawal" | "sale";

export type LedgerEntry = {
  kind: EntryKind;
  id: number;
  date: string;
  amount: number;
  /** category name, or জমা / ফেরত / মাছ বিক্রি */
  title: string;
  note: string;
  categoryId: number | null;
  icon: string | null;
  color: string | null;
  /** expense/sale: null = fund, else partner. contribution/withdrawal: the partner */
  partnerId: number | null;
  payerLabel: string;
  labourCount: number | null;
  hasReceipt: boolean;
  pondId: number | null;
  voided: boolean;
  voidReason: string | null;
  createdAt: number;
};

type Named = { id: number; name: string };
type Cat = Named & { icon: string; color: string };
type Row = {
  id: number;
  date: string;
  amount: number;
  voidedAt: Date | string | null;
  voidReason: string | null;
  createdAt: Date | string;
};

const METHOD_LABEL: Record<string, string> = { cash: "নগদ", bkash: "বিকাশ", bank: "ব্যাংক" };

export function buildEntries(
  data: {
    expenses: (Row & {
      categoryId: number;
      description: string;
      paidByPartnerId: number | null;
      labourCount: number | null;
      receiptUrl: string | null;
    })[];
    contributions: (Row & { partnerId: number; note: string; method: string })[];
    withdrawals: (Row & { partnerId: number; note: string })[];
    sales?: (Row & {
      fish: string;
      weightKg: number | null;
      buyer: string;
      note: string;
      receivedByPartnerId: number | null;
      pondId: number | null;
    })[];
  },
  categories: Cat[],
  partners: Named[],
): LedgerEntry[] {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const partnerName = (id: number | null) => (id === null ? "ফান্ড" : (partners.find((p) => p.id === id)?.name ?? "?"));
  const base = (r: Row) => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    voided: r.voidedAt != null,
    voidReason: r.voidReason,
    createdAt: new Date(r.createdAt).getTime(),
  });

  const entries: LedgerEntry[] = [
    ...data.expenses.map((e) => {
      const c = cat.get(e.categoryId);
      return {
        ...base(e),
        kind: "expense" as const,
        title: c?.name ?? "?",
        note: e.description,
        categoryId: e.categoryId,
        icon: c?.icon ?? null,
        color: c?.color ?? null,
        partnerId: e.paidByPartnerId,
        payerLabel: e.paidByPartnerId === null ? "ফান্ড থেকে" : `${partnerName(e.paidByPartnerId)} দিয়েছেন`,
        labourCount: e.labourCount,
        hasReceipt: Boolean(e.receiptUrl),
        pondId: (e as { pondId?: number | null }).pondId ?? null,
      };
    }),
    ...data.contributions.map((c) => ({
      ...base(c),
      kind: "contribution" as const,
      title: "ফান্ডে জমা",
      note: c.note,
      categoryId: null,
      icon: null,
      color: null,
      partnerId: c.partnerId,
      payerLabel: `${partnerName(c.partnerId)} · ${METHOD_LABEL[c.method] ?? c.method}`,
      labourCount: null,
      hasReceipt: false,
      pondId: null,
    })),
    ...data.withdrawals.map((w) => ({
      ...base(w),
      kind: "withdrawal" as const,
      title: "ফান্ড থেকে ফেরত",
      note: w.note,
      categoryId: null,
      icon: null,
      color: null,
      partnerId: w.partnerId,
      payerLabel: partnerName(w.partnerId),
      labourCount: null,
      hasReceipt: false,
      pondId: null,
    })),
    ...(data.sales ?? []).map((x) => ({
      ...base(x),
      kind: "sale" as const,
      title: x.fish ? `মাছ বিক্রি · ${x.fish}` : "মাছ বিক্রি",
      note: [x.weightKg ? `${toBnDigits(String(x.weightKg))} কেজি` : "", x.buyer, x.note].filter(Boolean).join(" · "),
      categoryId: null,
      icon: null,
      color: null,
      partnerId: x.receivedByPartnerId,
      payerLabel: x.receivedByPartnerId === null ? "ফান্ডে জমা" : `${partnerName(x.receivedByPartnerId)} নিয়েছেন`,
      labourCount: null,
      hasReceipt: false,
      pondId: x.pondId,
    })),
  ];
  // Newest day first; within a day, newest entry first.
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || b.id - a.id);
}

export type LedgerFilter = {
  month?: string; // yyyy-mm
  from?: string; // yyyy-mm-dd, inclusive
  to?: string; // yyyy-mm-dd, inclusive
  categoryId?: number;
  /** "fund", or a partner id (as string) */
  payer?: string;
  /** expense | money (contributions + withdrawals) | sale | receipt (expenses with a photo) */
  type?: "expense" | "money" | "sale" | "receipt";
  pondId?: number;
  q?: string;
};

export function filterEntries(entries: LedgerEntry[], f: LedgerFilter): LedgerEntry[] {
  const q = f.q?.trim().toLowerCase();
  const qLatin = q?.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[,৳]/g, "");
  return entries.filter((e) => {
    if (f.month && !e.date.startsWith(f.month)) return false;
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (f.type === "expense" && e.kind !== "expense") return false;
    if (f.type === "money" && e.kind !== "contribution" && e.kind !== "withdrawal") return false;
    if (f.type === "sale" && e.kind !== "sale") return false;
    if (f.type === "receipt" && !e.hasReceipt) return false;
    if (f.pondId && e.pondId !== f.pondId) return false;
    if (f.categoryId && e.categoryId !== f.categoryId) return false;
    if (f.payer) {
      if (f.payer === "fund") {
        if ((e.kind !== "expense" && e.kind !== "sale") || e.partnerId !== null) return false;
      } else if (e.partnerId !== Number(f.payer)) return false;
    }
    if (q) {
      const hay = `${e.title} ${e.note} ${e.payerLabel}`.toLowerCase();
      const amountHit = qLatin !== "" && String(e.amount).includes(qLatin!);
      if (!hay.includes(q) && !amountHit && !toBnDigits(String(e.amount)).includes(q)) return false;
    }
    return true;
  });
}

export type DayGroup = { date: string; entries: LedgerEntry[]; expenseTotal: number; incomeTotal: number };

/** Groups (already sorted) entries by day; the subtotal counts non-voided expenses only. */
export function groupByDay(entries: LedgerEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of entries) {
    let g = groups.at(-1);
    if (!g || g.date !== e.date) {
      g = { date: e.date, entries: [], expenseTotal: 0, incomeTotal: 0 };
      groups.push(g);
    }
    g.entries.push(e);
    if (e.kind === "expense" && !e.voided) g.expenseTotal += e.amount;
    if (e.kind === "sale" && !e.voided) g.incomeTotal += e.amount;
  }
  return groups;
}
