import { describe, expect, it } from "vitest";
import { buildShareText } from "./summary";

describe("share text", () => {
  it("summarises cash box, month, partners and settle-up", () => {
    const text = buildShareText({
      farmName: "খামার",
      today: "2026-10-09",
      partners: [
        { id: 1, name: "রাফি", shareBp: 5000 },
        { id: 2, name: "অভি", shareBp: 5000 },
      ],
      ledger: {
        contributions: [{ date: "2026-10-01", partnerId: 1, amount: 10000, voidedAt: null }],
        expenses: [{ date: "2026-10-05", categoryId: 1, amount: 4000, paidByPartnerId: null, voidedAt: null }],
        withdrawals: [],
        sales: [],
      },
      url: "https://example.app",
    });
    expect(text).toContain("ক্যাশ বাক্স: ৳৬,০০০");
    expect(text).toContain("অক্টোবর ২০২৬ এর খরচ: ৳৪,০০০");
    expect(text).toContain("অভি → রাফি ৳৫,০০০");
    expect(text).not.toContain("বিক্রি");
    expect(text.endsWith("https://example.app")).toBe(true);
  });

  it("adds income and profit when fish were sold", () => {
    const text = buildShareText({
      farmName: "খামার",
      today: "2026-10-09",
      partners: [{ id: 1, name: "রাফি", shareBp: 10000 }],
      ledger: {
        contributions: [],
        expenses: [{ date: "2026-10-05", categoryId: 1, amount: 4000, paidByPartnerId: 1, voidedAt: null }],
        withdrawals: [],
        sales: [{ date: "2026-10-06", amount: 10000, receivedByPartnerId: null, voidedAt: null }],
      },
    });
    expect(text).toContain("মোট বিক্রি: ৳১০,০০০");
    expect(text).toContain("লাভ/ক্ষতি: +৳৬,০০০");
  });
});
