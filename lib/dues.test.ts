import { describe, expect, it } from "vitest";
import { duesByShop, dueForShop, shopKey, totalDue } from "./dues";

const buy = (shop: string, amount: number, date = "2026-10-01", voidedAt: Date | null = null) => ({
  date,
  amount,
  shop,
  onCredit: true,
  voidedAt,
});
const pay = (shop: string, amount: number, date = "2026-10-05", voidedAt: Date | null = null) => ({ date, amount, shop, voidedAt });

describe("shop dues", () => {
  it("owed = credit purchases minus payments, per shop, biggest first", () => {
    const d = duesByShop([buy("রহিম ফিড", 50000), buy("করিম ঔষধ", 8000), buy("রহিম ফিড", 20000, "2026-10-03")], [pay("রহিম ফিড", 30000)]);
    expect(d.map((s) => [s.shop, s.bought, s.paid, s.due])).toEqual([
      ["রহিম ফিড", 70000, 30000, 40000],
      ["করিম ঔষধ", 8000, 0, 8000],
    ]);
    expect(totalDue([buy("রহিম ফিড", 70000), buy("করিম ঔষধ", 8000)], [pay("রহিম ফিড", 30000)])).toBe(48000);
  });

  it("treats the same shop typed with other spacing or case as one shop", () => {
    expect(shopKey("  Rahim   Feed ")).toBe("rahim feed");
    expect(dueForShop([buy("Rahim Feed", 1000)], [pay(" rahim feed", 400)], "RAHIM FEED")).toBe(600);
  });

  it("ignores voided rows and purchases that were not on credit", () => {
    const d = duesByShop(
      [buy("ক", 1000, "2026-10-01", new Date()), { date: "2026-10-01", amount: 500, shop: "ক", onCredit: false, voidedAt: null }, buy("ক", 300)],
      [pay("ক", 100, "2026-10-02", new Date())],
    );
    expect(d).toHaveLength(1);
    expect(d[0].due).toBe(300);
  });

  it("an unknown shop owes nothing", () => {
    expect(dueForShop([], [], "কেউ")).toBe(0);
  });
});
