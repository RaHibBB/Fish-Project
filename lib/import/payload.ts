// Turns reviewed sheet proposals + answers into a self-contained import payload, and applies it.
// Used by scripts/import-sheet.ts (local DB access) and scripts/import-apply.ts (inside a Vercel build).
import { asc, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { contributionInput, expenseInput } from "@/lib/db/mutations";
import { categories, contributions, expenses, partners } from "@/lib/db/schema";
import type { CategorySlug } from "@/lib/db/seed-data";
import type { Proposal } from "./sheet";

export type Answers = {
  /** row → category slug (only where the suggestion is changed) */
  categories: Record<number, CategorySlug>;
  /** row → "fund" or a partner name; required for rows with a name in them */
  payers: Record<number, string>;
  /** row → yyyy-mm-dd (only where the resolved date is changed) */
  dates: Record<number, string>;
  contribution: { date: string; method: "cash" | "bkash" | "bank"; split: Record<string, number> };
};

export type ImportPayload = {
  sheetTotal: number;
  expenses: {
    row: number;
    date: string;
    category: string;
    amount: number;
    description: string;
    payer: string; // "fund" or partner name
    labourCount: number | null;
    labourRate: number | null;
  }[];
  contributions: { partner: string; amount: number; date: string; method: "cash" | "bkash" | "bank"; note: string }[];
};

export function buildPayload(proposals: Proposal[], answers: Answers): ImportPayload {
  const unresolved = proposals.filter((p) => p.payer === null && !answers.payers[p.row]);
  if (unresolved.length) throw new Error(`Who paid? rows ${unresolved.map((p) => p.row).join(", ")}`);
  const exps = proposals.map((p) => {
    const category = answers.categories[p.row] ?? p.category;
    return {
      row: p.row,
      date: answers.dates[p.row] ?? p.date,
      category,
      amount: p.amount,
      description: p.description,
      payer: answers.payers[p.row] ?? p.payer ?? "fund",
      labourCount: category === "labour" ? p.labourCount : null,
      labourRate: category === "labour" ? p.labourRate : null,
    };
  });
  const firstDate = exps.map((e) => e.date).sort()[0];
  return {
    sheetTotal: proposals.reduce((a, p) => a + p.amount, 0),
    expenses: exps,
    contributions: Object.entries(answers.contribution.split)
      .filter(([, amount]) => amount > 0)
      .map(([partner, amount]) => ({
        partner,
        amount,
        date: answers.contribution.date || firstDate,
        method: answers.contribution.method,
        note: "পুরনো শিট থেকে (From 300K)",
      })),
  };
}

export class AlreadyImportedError extends Error {}

/** Insert everything in one transaction (audit action "import"); refuses if expenses already exist. */
export async function applyPayload(db: DB, payload: ImportPayload, opts: { force?: boolean } = {}) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(expenses);
  if (n > 0 && !opts.force) throw new AlreadyImportedError(`database already has ${n} expenses`);

  const ps = await db.select().from(partners).orderBy(asc(partners.sortOrder));
  const cats = await db.select().from(categories);
  const partnerId = (name: string) => {
    const p = ps.find((x) => x.name === name);
    if (!p) throw new Error(`unknown partner "${name}" (have: ${ps.map((x) => x.name).join(", ")})`);
    return p.id;
  };
  const catId = (slug: string) => {
    const c = cats.find((x) => x.slug === slug);
    if (!c) throw new Error(`unknown category "${slug}"`);
    return c.id;
  };

  const rows = payload.expenses.map((e) =>
    expenseInput.parse({
      date: e.date,
      categoryId: catId(e.category),
      amount: e.amount,
      description: e.description,
      paidByPartnerId: e.payer === "fund" ? null : partnerId(e.payer),
      labourCount: e.labourCount,
      labourRate: e.labourRate,
    }),
  );
  const contribs = payload.contributions.map((c) =>
    contributionInput.parse({ date: c.date, partnerId: partnerId(c.partner), amount: c.amount, method: c.method, note: c.note }),
  );

  await db.transaction(async (tx) => {
    for (const r of rows) {
      const [row] = await tx.insert(expenses).values({ ...r, createdBy: null }).returning();
      await writeAudit(tx, { actorId: null, action: "import", tableName: "expenses", rowId: row.id, after: row });
    }
    for (const c of contribs) {
      const [row] = await tx.insert(contributions).values({ ...c, createdBy: null }).returning();
      await writeAudit(tx, { actorId: null, action: "import", tableName: "contributions", rowId: row.id, after: row });
    }
  });

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)::int` })
    .from(expenses)
    .where(sql`${expenses.voidedAt} is null`);
  return { expenses: rows.length, contributions: contribs.length, total, ok: total === payload.sheetTotal };
}
