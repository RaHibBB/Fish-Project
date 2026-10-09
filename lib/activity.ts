// Turns audit_log rows into one readable line each for the "পরিবর্তন" page.
import { taka, toBnDigits } from "./format";

type Row = {
  id: number;
  actorId: number | null;
  action: string;
  tableName: string;
  rowId: number | null;
  before: unknown;
  after: unknown;
  createdAt: Date | string;
};

export type ActivityLine = {
  id: number;
  at: string; // ISO timestamp
  who: string;
  verb: string; // লিখেছেন / বদলেছেন / বাতিল করেছেন …
  what: string;
  href: string | null;
  tone: "add" | "edit" | "void" | "other";
};

const VERB: Record<string, [string, ActivityLine["tone"]]> = {
  create: ["যোগ করেছেন", "add"],
  update: ["বদলেছেন", "edit"],
  void: ["বাতিল করেছেন", "void"],
  import: ["শিট থেকে এনেছেন", "add"],
};

const KIND: Record<string, string> = {
  expenses: "expense",
  contributions: "contribution",
  withdrawals: "withdrawal",
  sales: "sale",
};

export function describeActivity(
  rows: Row[],
  lookup: { people: Map<number, string>; categories: Map<number, string>; ponds: Map<number, string> },
): ActivityLine[] {
  return rows.map((r) => {
    const rec = ((r.after ?? r.before ?? {}) as Record<string, unknown>) || {};
    const amount = typeof rec.amount === "number" ? ` ${taka(rec.amount)}` : "";
    const person = (id: unknown) => (typeof id === "number" ? (lookup.people.get(id) ?? "?") : "");
    let what: string;
    switch (r.tableName) {
      case "expenses": {
        const cat = lookup.categories.get(rec.categoryId as number) ?? "খরচ";
        const labour = typeof rec.labourCount === "number" ? ` (${toBnDigits(rec.labourCount)} জন)` : "";
        what = `খরচ: ${cat}${labour}${amount}`;
        break;
      }
      case "contributions":
        what = `${person(rec.partnerId)} এর জমা${amount}`;
        break;
      case "withdrawals":
        what = `${person(rec.partnerId)} এর ফেরত${amount}`;
        break;
      case "sales":
        what = `মাছ বিক্রি${rec.fish ? ` (${rec.fish})` : ""}${amount}`;
        break;
      case "feedings":
        what = `খাবার লগ ${typeof rec.feedKg === "number" ? `${toBnDigits(rec.feedKg)} কেজি` : ""}`.trim();
        break;
      case "categories":
        what = `খাত "${rec.name ?? ""}"`;
        break;
      case "ponds":
        what = `পুকুর "${rec.name ?? ""}"`;
        break;
      case "partners":
        what = `অ্যাকাউন্ট: ${rec.name ?? ""}`;
        break;
      case "settings":
        what = "সেটিংস";
        break;
      default:
        what = r.tableName;
    }
    const [verb, tone] = VERB[r.action] ?? [r.action, "other"];
    const kind = KIND[r.tableName];
    return {
      id: r.id,
      at: new Date(r.createdAt).toISOString(),
      who: r.actorId ? (lookup.people.get(r.actorId) ?? "?") : "সিস্টেম",
      verb,
      what,
      href: kind && r.rowId ? `/ledger/${kind}/${r.rowId}` : null,
      tone,
    };
  });
}
