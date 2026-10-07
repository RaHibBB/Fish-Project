import { describe, expect, it } from "vitest";
import { buildEntries, filterEntries, groupByDay } from "./ledger";

const cats = [
  { id: 10, name: "শ্রমিক মজুরি", icon: "users", color: "#000" },
  { id: 11, name: "খাবার", icon: "wheat", color: "#000" },
];
const partners = [
  { id: 1, name: "রাফি" },
  { id: 2, name: "রিয়াজ" },
];
const t = (s: string) => new Date(s);

const entries = buildEntries(
  {
    expenses: [
      { id: 1, date: "2026-05-01", amount: 4920, categoryId: 10, description: "", paidByPartnerId: null, labourCount: 6, receiptUrl: null, voidedAt: null, voidReason: null, createdAt: t("2026-05-01T08:00:00Z") },
      { id: 2, date: "2026-05-01", amount: 2750, categoryId: 11, description: "খাবারের বস্তা", paidByPartnerId: 1, labourCount: null, receiptUrl: "x", voidedAt: null, voidReason: null, createdAt: t("2026-05-01T09:00:00Z") },
      { id: 3, date: "2026-05-01", amount: 500, categoryId: 11, description: "ভুল", paidByPartnerId: null, labourCount: null, receiptUrl: null, voidedAt: t("2026-05-02T00:00:00Z"), voidReason: "ভুল", createdAt: t("2026-05-01T10:00:00Z") },
      { id: 4, date: "2026-06-03", amount: 820, categoryId: 10, description: "", paidByPartnerId: null, labourCount: 1, receiptUrl: null, voidedAt: null, voidReason: null, createdAt: t("2026-06-03T08:00:00Z") },
    ],
    contributions: [
      { id: 1, date: "2026-04-30", amount: 100000, partnerId: 2, note: "", method: "bkash", voidedAt: null, voidReason: null, createdAt: t("2026-04-30T08:00:00Z") },
    ],
    withdrawals: [],
  },
  cats,
  partners,
);

describe("ledger entries", () => {
  it("sorts newest first and labels payers", () => {
    expect(entries.map((e) => `${e.kind}:${e.id}`)).toEqual([
      "expense:4",
      "expense:3",
      "expense:2",
      "expense:1",
      "contribution:1",
    ]);
    expect(entries.find((e) => e.kind === "contribution")!.payerLabel).toBe("রিয়াজ · বিকাশ");
    expect(entries.find((e) => e.id === 2 && e.kind === "expense")!.payerLabel).toBe("রাফি দিয়েছেন");
  });

  it("groups by day with a subtotal that skips voided rows and money rows", () => {
    const groups = groupByDay(entries);
    expect(groups.map((g) => [g.date, g.expenseTotal, g.entries.length])).toEqual([
      ["2026-06-03", 820, 1],
      ["2026-05-01", 7670, 3],
      ["2026-04-30", 0, 1],
    ]);
  });

  it("filters by month, category, payer, type and search", () => {
    expect(filterEntries(entries, { month: "2026-05" })).toHaveLength(3);
    expect(filterEntries(entries, { categoryId: 10 }).map((e) => e.id)).toEqual([4, 1]);
    expect(filterEntries(entries, { payer: "fund" }).map((e) => e.id)).toEqual([4, 3, 1]);
    expect(filterEntries(entries, { payer: "1" }).map((e) => e.id)).toEqual([2]);
    expect(filterEntries(entries, { type: "money" }).map((e) => e.kind)).toEqual(["contribution"]);
    expect(filterEntries(entries, { q: "বস্তা" }).map((e) => e.id)).toEqual([2]);
    expect(filterEntries(entries, { q: "২৭৫০" }).map((e) => e.id)).toEqual([2]);
    expect(filterEntries(entries, { q: "4,920" }).map((e) => e.id)).toEqual([1]);
  });
});
