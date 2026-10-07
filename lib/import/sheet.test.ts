import { describe, expect, it } from "vitest";
import { buildProposals, parseAmount, readDate, resolveDates, suggestCategory, type SheetRow } from "./sheet";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const row = (n: number, o: Partial<SheetRow>): SheetRow => ({
  row: n,
  date: null,
  labourer: null,
  voucher: null,
  sheetCategory: "Lease",
  description: "",
  amount: 0,
  supplier: null,
  paymentMethod: null,
  receipt: null,
  remarks: "From 300K",
  ...o,
});

describe("dates", () => {
  it("reads typos", () => {
    expect(readDate("6/070/26")).toMatchObject({ y: 2026, m: 7, d: 6, typo: true, text: true });
    expect(readDate("27/04/27")).toMatchObject({ y: 2027, m: 4, d: 27 });
    expect(readDate("")).toBeNull();
    expect(readDate(46143)).toMatchObject({ y: 2026, m: 5, d: 1 }); // Excel serial
  });

  it("fixes mm/dd mix-ups using neighbouring rows", () => {
    const raws = [
      readDate(utc(2026, 4, 28)),
      readDate(utc(2026, 1, 5)), // really 01/05 = 1 May
      readDate(utc(2026, 6, 5)), // really 6 May
      readDate(utc(2026, 5, 7)),
    ];
    const res = resolveDates(raws);
    expect(res.map((r) => r.date)).toEqual(["2026-04-28", "2026-05-01", "2026-05-06", "2026-05-07"]);
    expect(res[1].flags[0].kind).toBe("date_swapped");
    expect(res[2].flags[0].kind).toBe("date_swapped");
    expect(res[3].flags).toEqual([]);
  });

  it("fixes the 6/070/26 and 27/04/27 typos, inherits empty dates", () => {
    const res = resolveDates([readDate(utc(2026, 4, 20)), readDate("27/04/27"), null, readDate("6/070/26")]);
    expect(res.map((r) => r.date)).toEqual(["2026-04-20", "2026-04-27", "2026-04-27", "2026-07-06"]);
    expect(res[1].flags[0].kind).toBe("date_year_fixed");
    expect(res[2].flags[0].kind).toBe("date_inherited");
    expect(res[3].flags[0].kind).toBe("date_typo");
  });
});

describe("real sheet quirks", () => {
  it("treats yyyy-mm-dd text like a date cell (can be the mm/dd mix-up)", () => {
    const res = resolveDates([readDate("27/04/26"), readDate("2026-01-05"), readDate("2026-02-05"), readDate("13/05/26")]);
    expect(res.map((r) => r.date)).toEqual(["2026-04-27", "2026-05-01", "2026-05-02", "2026-05-13"]);
  });

  it("uses the category column as description when the description is empty, and trims [ name ]", () => {
    const [pipe, lease, rafi] = buildProposals([
      row(5, { date: "25/04/26", sheetCategory: "pipe purchase 10 feet", description: null, amount: 1040 }),
      row(6, { date: "25/04/26", sheetCategory: "Lease ", description: "Chopping tree branches", amount: 3200 }),
      row(7, { date: "26/04/26", sheetCategory: null, description: "khawa khoroch 1 bosta [ rafi]", amount: 2750, remarks: null }),
    ]);
    expect(pipe).toMatchObject({ description: "pipe purchase 10 feet", category: "equipment" });
    expect(lease.description).toBe("Chopping tree branches");
    expect(rafi.flags).toContainEqual({ kind: "payer_named", name: "rafi" });
    expect(rafi.category).toBe("feed");
  });
});

describe("rows", () => {
  it("parses amounts", () => {
    expect(parseAmount("4,920")).toBe(4920);
    expect(parseAmount("৳৪৯২০")).toBe(4920);
    expect(parseAmount(4920)).toBe(4920);
    expect(parseAmount("")).toBeNull();
  });

  it("suggests categories from the description, ignoring the sheet's 'Lease'", () => {
    expect(suggestCategory("PVC pipe 4 inch", false)).toBe("equipment");
    expect(suggestCategory("Chun 10 bosta", false)).toBe("lime_fertilizer");
    expect(suggestCategory("Gas tablet", false)).toBe("medicine");
    expect(suggestCategory("Mach er khabar", false)).toBe("feed");
    expect(suggestCategory("Pani sech", false)).toBe("irrigation");
    expect(suggestCategory("Gari bara", false)).toBe("transport");
    expect(suggestCategory("Misc", false)).toBe("other");
  });

  it("turns labour rows into count × rate and never guesses a named payer", () => {
    const [labour, named, bracket, noRemark, oddRate] = buildProposals([
      row(5, { date: utc(2026, 4, 20), labourer: 6, description: "Cut to Fill, Prep tools & Food", amount: 4920 }),
      row(6, { date: utc(2026, 4, 21), labourer: "Rahib", description: "Advance", amount: 50000, remarks: "" }),
      row(7, { date: utc(2026, 4, 22), description: "Feed bag [rafi]", amount: 2750, remarks: "" }),
      row(8, { date: utc(2026, 4, 22), description: "Gari bara", amount: 500, remarks: "" }),
      row(9, { date: utc(2026, 4, 23), labourer: 7, description: "Cut to fill", amount: 5000 }),
    ]);
    expect(labour).toMatchObject({ category: "labour", labourCount: 6, labourRate: 820, payer: "fund", flags: [] });
    expect(named.payer).toBeNull();
    expect(named.flags).toContainEqual({ kind: "payer_named", name: "Rahib" });
    expect(bracket.payer).toBeNull();
    expect(bracket.flags).toContainEqual({ kind: "payer_named", name: "rafi" });
    expect(bracket.category).toBe("feed");
    expect(noRemark).toMatchObject({ payer: "fund", category: "transport" });
    expect(noRemark.flags).toContainEqual({ kind: "payer_assumed_fund" });
    expect(oddRate).toMatchObject({ category: "labour", labourCount: null, labourRate: null });
    expect(oddRate.description).toContain("7 জন");
  });
});
