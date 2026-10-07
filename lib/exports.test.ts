import { describe, expect, it } from "vitest";
import { parseCategoryParams } from "./category-view";
import { toCSV } from "./csv";
import { categoryCsv, expensesCsv, partnersCsv } from "./exports";

const cats = [
  { id: 1, name: "শ্রমিক মজুরি", icon: "users", color: "#000" },
  { id: 2, name: "খাবার", icon: "wheat", color: "#000" },
];
const partners = [
  { id: 7, name: "রাফি", shareBp: 5000 },
  { id: 8, name: "অভি", shareBp: 5000 },
];
const exp = (id: number, date: string, categoryId: number, amount: number, extra = {}) => ({
  id,
  date,
  categoryId,
  amount,
  description: "",
  paidByPartnerId: null as number | null,
  labourCount: null as number | null,
  labourRate: null as number | null,
  voidedAt: null as Date | null,
  voidReason: null as string | null,
  ...extra,
});
const ledger = {
  expenses: [
    exp(1, "2026-06-02", 1, 4920, { labourCount: 6, labourRate: 820 }),
    exp(2, "2026-06-03", 2, 2750, { paidByPartnerId: 7, description: 'বস্তা, "ভালো"' }),
    exp(3, "2026-06-04", 2, 100, { voidedAt: new Date(), voidReason: "ভুল" }),
  ],
  contributions: [
    { id: 1, date: "2026-06-01", partnerId: 7, amount: 5000, method: "cash", note: "", voidedAt: null, voidReason: null },
    { id: 2, date: "2026-06-01", partnerId: 8, amount: 5000, method: "bkash", note: "", voidedAt: null, voidReason: null },
  ],
  withdrawals: [],
};

describe("csv", () => {
  it("adds a BOM and escapes quotes and commas", () => {
    expect(toCSV([["a", 'b,"c"'], [1, null]])).toBe('﻿a,"b,""c"""\r\n1,\r\n');
  });

  it("category summary totals equal the sum of rows and skip voided rows", () => {
    const rows = categoryCsv(ledger, cats, partners, parseCategoryParams({}), false, "2026-06-30");
    const body = rows.slice(4, -1);
    const total = rows.at(-1)!;
    expect(body.map((r) => r[0])).toEqual(["শ্রমিক মজুরি", "খাবার"]);
    expect(total[1]).toBe(7670);
    expect(body.reduce((a, r) => a + Number(r[1]), 0)).toBe(total[1]);
  });

  it("category entries respect payer and category filters", () => {
    const rows = categoryCsv(ledger, cats, partners, parseCategoryParams({ payer: "7", cats: "2" }), true, "2026-06-30");
    expect(rows.slice(4, -1).map((r) => [r[0], r[2], r[5]])).toEqual([["03/06/2026", 2750, "রাফি"]]);
  });

  it("full expense export keeps voided rows, marked", () => {
    const rows = expensesCsv(ledger, cats, partners);
    expect(rows).toHaveLength(4);
    expect(rows[3][8]).toBe("বাতিল: ভুল");
  });

  it("partner export ends with the settle-up", () => {
    const rows = partnersCsv(ledger, partners);
    // Rafi paid 2,750 personally; 7,670 total split 50/50 → Ovi owes Rafi 1,375.
    expect(rows.at(-1)).toEqual(["অভি", "রাফি", 1375]);
  });
});
