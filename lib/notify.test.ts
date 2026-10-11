import { describe, expect, it } from "vitest";
import { buildEntryNotification, notificationTargets } from "./notify";

const lookup = {
  people: new Map([
    [1, "রাফি"],
    [2, "রিয়াজ"],
  ]),
  categories: new Map([[10, "শ্রমিক মজুরি"]]),
  ponds: new Map<number, string>(),
};

describe("entry notifications", () => {
  it("says who added what, with a link to the entry", () => {
    const n = buildEntryNotification(
      { actorId: 1, action: "create", tableName: "expenses", row: { id: 7, categoryId: 10, amount: 4920, labourCount: 6 } },
      lookup,
    );
    expect(n).toEqual({
      title: "রাফি যোগ করেছেন",
      body: "খরচ: শ্রমিক মজুরি (৬ জন) ৳৪,৯২০",
      url: "/ledger/expense/7",
      tag: "entry-expenses-7",
    });
  });

  it("covers deposits, voids and feeding", () => {
    expect(
      buildEntryNotification({ actorId: 2, action: "create", tableName: "contributions", row: { id: 3, partnerId: 2, amount: 100000 } }, lookup),
    ).toMatchObject({ title: "রিয়াজ যোগ করেছেন", body: "রিয়াজ এর জমা ৳১,০০,০০০" });
    expect(
      buildEntryNotification({ actorId: 1, action: "void", tableName: "expenses", row: { id: 7, categoryId: 10, amount: 4920 } }, lookup).title,
    ).toBe("রাফি বাতিল করেছেন");
    expect(buildEntryNotification({ actorId: 1, action: "create", tableName: "feedings", row: { id: 1, feedKg: 25 } }, lookup).url).toBe("/feeding");
  });

  it("does not notify the person who made the change", () => {
    const subs = [
      { endpoint: "a", partnerId: 1 },
      { endpoint: "b", partnerId: 2 },
      { endpoint: "c", partnerId: null },
    ];
    expect(notificationTargets(subs, 1).map((s) => s.endpoint)).toEqual(["b", "c"]);
  });
});
