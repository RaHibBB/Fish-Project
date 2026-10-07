import { describe, expect, it } from "vitest";
import {
  addDays,
  bnDate,
  bnMonth,
  bnPercent,
  groupIndian,
  isISODate,
  monthRange,
  prevMonth,
  taka,
  todayISO,
  toBnDigits,
} from "./format";

describe("format", () => {
  it("converts digits to Bengali", () => {
    expect(toBnDigits("6 × 820 = 4920")).toBe("৬ × ৮২০ = ৪৯২০");
  });

  it("groups in the Indian style", () => {
    expect(groupIndian(300000)).toBe("3,00,000");
    expect(groupIndian(302830)).toBe("3,02,830");
    expect(groupIndian(4920)).toBe("4,920");
    expect(groupIndian(820)).toBe("820");
    expect(groupIndian(12345678)).toBe("1,23,45,678");
  });

  it("formats taka with sign", () => {
    expect(taka(300000)).toBe("৳৩,০০,০০০");
    expect(taka(-2830)).toBe("−৳২,৮৩০");
    expect(taka(500, { signed: true })).toBe("+৳৫০০");
    expect(taka(0, { signed: true })).toBe("৳০");
  });

  it("formats dates as dd/mm/yyyy", () => {
    expect(bnDate("2026-05-01")).toBe("০১/০৫/২০২৬");
    expect(bnMonth("2026-05")).toBe("মে ২০২৬");
  });

  it("computes today in Dhaka", () => {
    // 2026-05-01 20:00 UTC is already 2 May in Dhaka (UTC+6).
    expect(todayISO(new Date("2026-05-01T20:00:00Z"))).toBe("2026-05-02");
    expect(todayISO(new Date("2026-05-01T17:59:00Z"))).toBe("2026-05-01");
  });

  it("does calendar arithmetic", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-07-06")).toBe(true);
  });

  it("formats percent", () => {
    expect(bnPercent(1, 8)).toBe("১২.৫%");
    expect(bnPercent(1, 0)).toBe("০%");
  });
});
