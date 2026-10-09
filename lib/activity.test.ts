import { describe, expect, it } from "vitest";
import { describeActivity } from "./activity";

const lookup = {
  people: new Map([
    [1, "রাফি"],
    [2, "রাহিব"],
  ]),
  categories: new Map([[10, "শ্রমিক মজুরি"]]),
  ponds: new Map<number, string>(),
};
const at = new Date("2026-10-09T05:00:00Z");

describe("activity lines", () => {
  it("describes adds, edits and voids with links to the entry", () => {
    const lines = describeActivity(
      [
        { id: 3, actorId: 2, action: "void", tableName: "expenses", rowId: 7, before: {}, after: { categoryId: 10, amount: 4920, labourCount: 6 }, createdAt: at },
        { id: 2, actorId: 1, action: "create", tableName: "contributions", rowId: 4, before: null, after: { partnerId: 1, amount: 100000 }, createdAt: at },
        { id: 1, actorId: null, action: "update", tableName: "settings", rowId: 1, before: {}, after: {}, createdAt: at },
      ],
      lookup,
    );
    expect(lines[0]).toMatchObject({ who: "রাহিব", verb: "বাতিল করেছেন", what: "খরচ: শ্রমিক মজুরি (৬ জন) ৳৪,৯২০", href: "/ledger/expense/7", tone: "void" });
    expect(lines[1]).toMatchObject({ who: "রাফি", what: "রাফি এর জমা ৳১,০০,০০০", href: "/ledger/contribution/4" });
    expect(lines[2]).toMatchObject({ who: "সিস্টেম", what: "সেটিংস", href: null });
  });
});
