// Row builders for every CSV export. Dates are dd/mm/yyyy, amounts plain integers (so Excel can sum them).
import { buildCategoryView, payerLabel, type CategoryParams } from "./category-view";
import { ddmmyyyy } from "./format";
import { filterExpenses, monthlyTotals, partnerPositions, settleUp, type Ledger, type PartnerInfo } from "./money";

type Cat = { id: number; name: string; icon: string; color: string };
type Row = (string | number | null | undefined)[];

type ExpenseRow = Ledger["expenses"][number] & {
  id: number;
  description: string;
  labourRate: number | null;
  voidReason: string | null;
};
type MoneyRow = { id: number; date: string; partnerId: number; amount: number; note: string; voidedAt: Date | string | null; voidReason: string | null };
type FullLedger = {
  expenses: ExpenseRow[];
  contributions: (MoneyRow & { method: string })[];
  withdrawals: MoneyRow[];
};

const METHOD: Record<string, string> = { cash: "নগদ", bkash: "বিকাশ", bank: "ব্যাংক" };
const status = (r: { voidedAt: unknown; voidReason: string | null }) => (r.voidedAt ? `বাতিল: ${r.voidReason ?? ""}` : "");

function namer(partners: PartnerInfo[]) {
  return (id: number | null) => (id === null ? "ফান্ড" : (partners.find((p) => p.id === id)?.name ?? "?"));
}

/** খাত list view (summary per category) — or, with `entries`, every expense in the view. */
export function categoryCsv(
  ledger: FullLedger,
  categories: Cat[],
  partners: PartnerInfo[],
  params: CategoryParams,
  entries: boolean,
  today?: string,
): Row[] {
  const view = buildCategoryView(ledger.expenses, categories, params, today);
  const header: Row[] = [
    ["সময়", view.period.label],
    ["কে দিল", payerLabel(params.payer, partners)],
    [],
  ];
  if (entries) {
    const name = namer(partners);
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const list = filterExpenses(ledger.expenses, {
      from: view.period.from,
      to: view.period.to,
      payer: params.payer,
      categoryIds: params.categoryIds,
    });
    list.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    return [
      ...header,
      ["তারিখ", "খাত", "টাকা", "শ্রমিক", "মজুরি", "কে দিল", "নোট"],
      ...list.map((e) => [
        ddmmyyyy(e.date),
        catName.get(e.categoryId) ?? "?",
        e.amount,
        e.labourCount,
        e.labourRate,
        name(e.paidByPartnerId),
        e.description,
      ]),
      ["মোট", "", list.reduce((a, e) => a + e.amount, 0)],
    ];
  }
  return [
    ...header,
    ["খাত", "টাকা", "শতাংশ", "এন্ট্রি", "শ্রমিক-দিন", "এই মাস", "গত মাস"],
    ...view.rows.map((r) => [
      r.category.name,
      r.total,
      Math.round(r.percent * 10) / 10,
      r.count,
      r.labourDays || null,
      r.thisMonth,
      r.lastMonth,
    ]),
    ["সর্বমোট", view.total, view.total ? 100 : 0, view.count, view.labourDays || null],
  ];
}

export function expensesCsv(ledger: FullLedger, categories: Cat[], partners: PartnerInfo[]): Row[] {
  const name = namer(partners);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  return [
    ["নং", "তারিখ", "খাত", "টাকা", "শ্রমিক", "মজুরি", "কে দিল", "নোট", "অবস্থা"],
    ...[...ledger.expenses]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map((e) => [
        e.id,
        ddmmyyyy(e.date),
        catName.get(e.categoryId) ?? "?",
        e.amount,
        e.labourCount,
        e.labourRate,
        name(e.paidByPartnerId),
        e.description,
        status(e),
      ]),
  ];
}

export function moneyCsv(ledger: FullLedger, partners: PartnerInfo[]): Row[] {
  const name = namer(partners);
  const rows = [
    ...ledger.contributions.map((c) => ({ ...c, kind: "জমা", how: METHOD[c.method] ?? c.method })),
    ...ledger.withdrawals.map((w) => ({ ...w, kind: "ফেরত", how: "" })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return [
    ["তারিখ", "ধরন", "পার্টনার", "টাকা", "কীভাবে", "নোট", "অবস্থা"],
    ...rows.map((r) => [ddmmyyyy(r.date), r.kind, name(r.partnerId), r.amount, r.how, r.note, status(r)]),
  ];
}

export function monthlyCsv(ledger: FullLedger): Row[] {
  const months = monthlyTotals(ledger.expenses);
  return [
    ["মাস", "খরচ", "এন্ট্রি"],
    ...months.map((m) => [m.key, m.total, m.count]),
    ["মোট", months.reduce((a, m) => a + m.total, 0), months.reduce((a, m) => a + m.count, 0)],
  ];
}

export function partnersCsv(ledger: FullLedger, partners: PartnerInfo[]): Row[] {
  const positions = partnerPositions(ledger, partners);
  return [
    ["পার্টনার", "ভাগ %", "ফান্ডে জমা", "নিজে খরচ করেছেন", "ফেরত নিয়েছেন", "বিক্রির টাকা হাতে", "মোট দিয়েছেন", "ভাগের খরচ", "ফান্ডে ভাগ", "অবস্থান"],
    ...positions.map((p) => [
      p.name,
      p.shareBp / 100,
      p.contributed,
      p.paidPersonally,
      p.withdrawn,
      p.salesHeld,
      p.putIn,
      p.fairShare,
      p.fundShare,
      p.net,
    ]),
    [],
    ["কে", "কাকে", "টাকা"],
    ...settleUp(positions).map((t) => [t.fromName, t.toName, t.amount]),
  ];
}

type SaleRow = {
  id: number;
  date: string;
  amount: number;
  fish: string;
  weightKg: number | null;
  buyer: string;
  pondId: number | null;
  receivedByPartnerId: number | null;
  note: string;
  voidedAt: Date | string | null;
  voidReason: string | null;
};

export function salesCsv(sales: SaleRow[], partners: PartnerInfo[], ponds: { id: number; name: string }[]): Row[] {
  const name = namer(partners);
  const pond = new Map(ponds.map((p) => [p.id, p.name]));
  return [
    ["তারিখ", "মাছ", "কেজি", "টাকা", "পুকুর", "ক্রেতা", "টাকা কোথায়", "নোট", "অবস্থা"],
    ...[...sales]
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      .map((s) => [
        ddmmyyyy(s.date),
        s.fish,
        s.weightKg,
        s.amount,
        s.pondId ? (pond.get(s.pondId) ?? "") : "",
        s.buyer,
        s.receivedByPartnerId === null ? "ফান্ডে" : name(s.receivedByPartnerId),
        s.note,
        status(s),
      ]),
  ];
}
