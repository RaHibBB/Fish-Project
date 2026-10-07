import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("allows in-app paths only", () => {
    expect(safeNext("/add")).toBe("/add");
    expect(safeNext("/ledger/expense/3?x=1")).toBe("/ledger/expense/3?x=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext(String.raw`/\evil.com`)).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
