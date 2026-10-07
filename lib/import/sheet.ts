// Pure logic for the one-time Google Sheet import (scripts/import-sheet.ts does the I/O).
import { isISODate } from "@/lib/format";
import type { CategorySlug } from "@/lib/db/seed-data";

/** One spreadsheet row as read from the "খরচ (Expense)" tab. Cell values are raw. */
export type SheetRow = {
  row: number; // spreadsheet row number
  date: unknown; // Date | number (Excel serial) | string | null
  labourer: unknown; // count or a name
  voucher: unknown;
  sheetCategory: unknown; // ignored ("Lease" for almost everything)
  description: unknown;
  amount: unknown;
  supplier: unknown;
  paymentMethod: unknown;
  receipt: unknown;
  remarks: unknown;
};

export type Flag =
  | { kind: "date_swapped"; raw: string }
  | { kind: "date_typo"; raw: string }
  | { kind: "date_year_fixed"; raw: string }
  | { kind: "date_inherited" }
  | { kind: "date_out_of_order"; raw: string }
  | { kind: "payer_named"; name: string }
  | { kind: "payer_assumed_fund" }
  | { kind: "labour_rate_not_whole"; count: number }
  | { kind: "amount_missing" };

export type Proposal = {
  row: number;
  date: string; // resolved yyyy-mm-dd
  amount: number;
  description: string;
  category: CategorySlug; // suggestion — confirm before import
  labourCount: number | null;
  labourRate: number | null;
  /** "fund", or null = must be chosen by the partners */
  payer: "fund" | null;
  flags: Flag[];
};

const text = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("").trim();
  }
  if (typeof v === "object" && v !== null && "result" in v) return text((v as { result: unknown }).result);
  return String(v).trim();
};

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const s = text(v)
    .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
    .replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** `text`: typed by a person as dd/mm/yy, so never day/month-swapped (only real date cells can be). */
type RawDate = { y: number; m: number; d: number; raw: string; typo: boolean; text: boolean } | null;

/** Read a date cell into y/m/d *as stored* (no guessing yet). */
export function readDate(v: unknown): RawDate {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // ExcelJS gives dates as UTC midnight.
    return {
      y: v.getUTCFullYear(),
      m: v.getUTCMonth() + 1,
      d: v.getUTCDate(),
      raw: v.toISOString().slice(0, 10),
      typo: false,
      text: false,
    };
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return readDate(dt);
  }
  const s = text(v);
  if (!s) return null;
  const parts = s.split(/[/.\-\s]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  let typo = false;
  // yyyy-mm-dd
  if (parts[0].length === 4) {
    const [y, m, d] = parts.map(Number);
    return { y, m, d, raw: s, typo, text: true };
  }
  const d = Number(parts[0]);
  let m = Number(parts[1]);
  let y = Number(parts[2]);
  if (parts[1].length > 2 || m > 12) {
    // e.g. "070" → 7
    const trimmed = Number(parts[1].replace(/0+$/, "") || "0");
    if (trimmed >= 1 && trimmed <= 12) {
      m = trimmed;
      typo = true;
    }
  }
  if (parts[2].length <= 2) y = 2000 + y;
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  return { y, m, d, raw: s, typo, text: true };
}

const valid = (y: number, m: number, d: number) => isISODate(iso(y, m, d));

/**
 * Resolve dates using the fact that rows are in chronological order:
 * - the value as stored, the day/month-swapped value for real date cells (stored mm/dd by mistake) and the
 *   value with the previous row's year are candidates;
 * - pick the earliest candidate that is not before the previous row, else the closest one;
 * - anything other than "as stored" is flagged; empty dates inherit the previous row's date.
 */
export function resolveDates(raws: RawDate[], fallbackStart?: string): { date: string | null; flags: Flag[] }[] {
  let prev: string | null = fallbackStart ?? null;
  return raws.map((r) => {
    if (!r) {
      return prev ? { date: prev, flags: [{ kind: "date_inherited" } as Flag] } : { date: null, flags: [] };
    }
    type Cand = { date: string; flag: Flag | null };
    const cands: Cand[] = [];
    if (valid(r.y, r.m, r.d)) cands.push({ date: iso(r.y, r.m, r.d), flag: r.typo ? { kind: "date_typo", raw: r.raw } : null });
    if (!r.text && r.d !== r.m && valid(r.y, r.d, r.m)) {
      cands.push({ date: iso(r.y, r.d, r.m), flag: { kind: "date_swapped", raw: r.raw } });
    }
    const prevYear = prev ? Number(prev.slice(0, 4)) : null;
    if (prevYear && prevYear !== r.y) {
      if (valid(prevYear, r.m, r.d)) cands.push({ date: iso(prevYear, r.m, r.d), flag: { kind: "date_year_fixed", raw: r.raw } });
      if (!r.text && r.d !== r.m && valid(prevYear, r.d, r.m)) {
        cands.push({ date: iso(prevYear, r.d, r.m), flag: { kind: "date_year_fixed", raw: r.raw } });
      }
    }
    if (!cands.length) return { date: prev, flags: [{ kind: "date_inherited" } as Flag] };

    let chosen: Cand;
    if (!prev) {
      chosen = cands[0];
    } else {
      const after = cands.filter((c) => c.date >= prev!).sort((a, b) => a.date.localeCompare(b.date));
      if (after.length) {
        // Prefer the value as stored when it is just as close as an alternative.
        chosen = after[0];
      } else {
        const dist = (c: Cand) => Math.abs(Date.parse(c.date) - Date.parse(prev!));
        chosen = [...cands].sort((a, b) => dist(a) - dist(b))[0];
      }
    }
    const flags: Flag[] = chosen.flag ? [chosen.flag] : [];
    if (prev && chosen.date < prev) flags.push({ kind: "date_out_of_order", raw: r.raw });
    prev = chosen.date;
    return { date: chosen.date, flags };
  });
}

const CATEGORY_RULES: [RegExp, CategorySlug][] = [
  [/pipe|পাইপ/i, "equipment"],
  [/chun|lime|চুন/i, "lime_fertilizer"],
  [/osudh|oshudh|ওষুধ|gas\s*tablet|গ্যাস ট্যাবলেট/i, "medicine"],
  [/khawa|khabar|khaba|feed|খাবার|খাওয়া/i, "feed"],
  [/pani\s*sech|সেচ/i, "irrigation"],
  [/gari\s*bh?ara|গাড়ি ভাড়া/i, "transport"],
];

const LABOUR_DESCRIPTION = /cut\s*to\s*fill/i;

export function suggestCategory(description: string, isLabour: boolean): CategorySlug {
  if (isLabour) return "labour";
  for (const [re, slug] of CATEGORY_RULES) if (re.test(description)) return slug;
  return "other";
}

const KNOWN_NAMES = /\b(rafi|reaz|riaz|ovi|rahib)\b|রাফি|রিয়াজ|অভি|রাহিব/i;

/** Turn sheet rows into proposals. Never guesses a payer from a name — those are flagged. */
export function buildProposals(rows: SheetRow[], fallbackStart?: string): Proposal[] {
  const dates = resolveDates(rows.map((r) => readDate(r.date)), fallbackStart);
  return rows.map((r, i) => {
    const flags: Flag[] = [...dates[i].flags];
    const description = text(r.description);
    const amount = parseAmount(r.amount);
    if (amount === null || amount <= 0) flags.push({ kind: "amount_missing" });

    const labourerText = text(r.labourer);
    const labourerCount = /^\d+$/.test(labourerText) ? Number(labourerText) : null;
    const isLabour = labourerCount !== null && labourerCount > 0 && LABOUR_DESCRIPTION.test(description);
    let labourCount: number | null = null;
    let labourRate: number | null = null;
    if (isLabour && amount) {
      if (amount % labourerCount! === 0) {
        labourCount = labourerCount;
        labourRate = amount / labourerCount!;
      } else {
        flags.push({ kind: "labour_rate_not_whole", count: labourerCount! });
      }
    }

    // Payer
    const remarks = text(r.remarks);
    const bracket = /\[([^\]]+)\]/.exec(description)?.[1];
    const nameInLabourer = labourerText && labourerCount === null ? labourerText : null;
    const named = nameInLabourer ?? bracket ?? KNOWN_NAMES.exec(`${description} ${remarks}`)?.[0] ?? null;
    let payer: Proposal["payer"] = null;
    if (named) flags.push({ kind: "payer_named", name: named });
    else if (/300\s*k/i.test(remarks)) payer = "fund";
    else {
      payer = "fund";
      flags.push({ kind: "payer_assumed_fund" });
    }

    // Keep the head-count visible when the rate isn't a whole number (no labour fields then).
    const headCount = isLabour && labourCount === null ? `${labourerCount} জন` : "";
    const extras = [text(r.supplier), text(r.voucher) && `ভাউচার ${text(r.voucher)}`];
    const fullDescription = [description, headCount, ...extras].filter(Boolean).join(" · ").slice(0, 200);

    return {
      row: r.row,
      date: dates[i].date ?? "",
      amount: amount ?? 0,
      description: fullDescription,
      category: suggestCategory(description, isLabour),
      labourCount,
      labourRate,
      payer,
      flags,
    };
  });
}

export function describeFlag(f: Flag): string {
  switch (f.kind) {
    case "date_swapped":
      return `date was stored mm/dd (${f.raw}) — day and month swapped`;
    case "date_typo":
      return `date typo fixed (${f.raw})`;
    case "date_year_fixed":
      return `year fixed to match neighbours (${f.raw})`;
    case "date_inherited":
      return "no date — copied from the previous row";
    case "date_out_of_order":
      return `date is earlier than the previous row (${f.raw}) — check`;
    case "payer_named":
      return `name "${f.name}" — partners must choose who paid`;
    case "payer_assumed_fund":
      return 'no "From 300K" remark — assumed paid from the fund';
    case "labour_rate_not_whole":
      return `amount ÷ ${f.count} labourers is not a whole number — saved without a rate`;
    case "amount_missing":
      return "amount missing or zero";
  }
}
