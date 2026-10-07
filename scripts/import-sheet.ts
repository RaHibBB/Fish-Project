/**
 * One-time import of the old Google Sheet ("খরচ (Expense)" tab, exported as .xlsx).
 *
 *   pnpm import:sheet ./sheet.xlsx              # dry run: prints the report, writes nothing
 *   pnpm import:sheet ./sheet.xlsx --commit     # asks the questions, then imports in one transaction
 *
 *   pnpm import:sheet ./sheet.xlsx --emit payload.json --answers answers.json
 *     no questions, no database: writes the import payload for scripts/import-apply.ts
 *     (for when the database is only reachable from a Vercel build)
 *
 * Options: --sheet "খরচ (Expense)"  --from 5  --to 38  --answers import-answers.json  --force
 * Uses DATABASE_URL (Neon) if set, otherwise the local PGlite database (stop `pnpm dev` first).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import ExcelJS from "exceljs";
import { asc } from "drizzle-orm";
import { createDb } from "../lib/db/client";
import { partners } from "../lib/db/schema";
import { SEED_CATEGORIES, SEED_PARTNERS } from "../lib/db/seed-data";
import { AlreadyImportedError, applyPayload, buildPayload, type Answers } from "../lib/import/payload";
import { buildProposals, describeFlag, parseAmount, type Proposal, type SheetRow } from "../lib/import/sheet";
import { ddmmyyyy, groupIndian, isISODate } from "../lib/format";

const FUND_TOTAL = 300000;

function args() {
  const a = process.argv.slice(2);
  const get = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const VALUE_FLAGS = ["--sheet", "--from", "--to", "--answers", "--emit"];
  const file = a.find((x, i) => !x.startsWith("--") && !VALUE_FLAGS.includes(a[i - 1]));
  return {
    file,
    sheet: get("--sheet") ?? "খরচ (Expense)",
    from: Number(get("--from") ?? 5),
    to: Number(get("--to") ?? 38),
    answers: get("--answers"),
    emit: get("--emit"),
    commit: a.includes("--commit"),
    force: a.includes("--force"),
  };
}

const tk = (n: number) => `৳${groupIndian(n)}`;
const catName = (slug: string) => SEED_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;

async function readSheet(file: string, sheetName: string, from: number, to: number) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws =
    wb.getWorksheet(sheetName) ??
    wb.worksheets.find((w) => w.name.toLowerCase().includes("expense")) ??
    undefined;
  if (!ws) throw new Error(`Sheet "${sheetName}" not found. Sheets: ${wb.worksheets.map((w) => w.name).join(", ")}`);

  const header = (ws.getRow(from - 1).values as unknown[]).slice(1).map((v) => String(v ?? "").trim());
  const col = (name: string) => {
    // Headers are bilingual, e.g. "তারিখ (Date)" on two lines — match the English name anywhere.
    const i = header.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()));
    if (i < 0) throw new Error(`Column "${name}" not found in header row ${from - 1}: ${header.join(" | ")}`);
    return i + 1;
  };
  const C = {
    date: col("Date"),
    labourer: col("Labourer"),
    voucher: col("Voucher"),
    category: col("Expense Category"),
    description: col("Description"),
    amount: col("Amount"),
    supplier: col("Supplier"),
    payment: col("Payment"),
    receipt: col("Receipt"),
    remarks: col("Remarks"),
  };
  const rows: SheetRow[] = [];
  for (let r = from; r <= to; r++) {
    const row = ws.getRow(r);
    const cell = (c: number) => row.getCell(c).value;
    const sheetRow: SheetRow = {
      row: r,
      date: cell(C.date),
      labourer: cell(C.labourer),
      voucher: cell(C.voucher),
      sheetCategory: cell(C.category),
      description: cell(C.description),
      amount: cell(C.amount),
      supplier: cell(C.supplier),
      paymentMethod: cell(C.payment),
      receipt: cell(C.receipt),
      remarks: cell(C.remarks),
    };
    const empty = [sheetRow.date, sheetRow.description, sheetRow.amount].every((v) => v === null || v === "");
    if (!empty) rows.push(sheetRow);
  }
  // Warn about data below the range.
  let below = 0;
  for (let r = to + 1; r <= Math.min(ws.rowCount, to + 200); r++) {
    if (parseAmount(ws.getRow(r).getCell(C.amount).value)) below++;
  }
  return { rows, below, sheetName: ws.name };
}

function printReport(proposals: Proposal[]) {
  console.log("\nRow  Date        Amount     Category              Payer   Description");
  console.log("─".repeat(100));
  for (const p of proposals) {
    console.log(
      `${String(p.row).padEnd(4)} ${ddmmyyyy(p.date || "????-??-??").padEnd(11)} ${tk(p.amount).padStart(10)} ` +
        `${catName(p.category).padEnd(21)} ${(p.payer ?? "???").padEnd(7)} ${p.description.slice(0, 40)}` +
        (p.labourCount ? `  [${p.labourCount}×${p.labourRate}]` : ""),
    );
    for (const f of p.flags) console.log(`       ⚑ ${describeFlag(f)}`);
  }
  const total = proposals.reduce((a, p) => a + p.amount, 0);
  const flagged = proposals.filter((p) => p.flags.length).length;
  console.log("─".repeat(100));
  console.log(`${proposals.length} rows · total ${tk(total)} · ${flagged} flagged`);
  const byCat = new Map<string, number>();
  for (const p of proposals) byCat.set(p.category, (byCat.get(p.category) ?? 0) + p.amount);
  console.log("\nSuggested categories (the sheet's 'Expense Category' column is ignored):");
  for (const [slug, amt] of [...byCat].sort((a, b) => b[1] - a[1])) console.log(`  ${catName(slug).padEnd(24)} ${tk(amt)}`);
  return total;
}

async function main() {
  const opt = args();
  if (!opt.file) {
    console.error(
      "Usage: pnpm import:sheet <file.xlsx> [--commit | --emit payload.json] [--answers file] [--sheet name] [--from 5] [--to 38]",
    );
    process.exit(1);
  }
  const { rows, below, sheetName } = await readSheet(opt.file, opt.sheet, opt.from, opt.to);
  console.log(`Sheet "${sheetName}", rows ${opt.from}–${opt.to}: ${rows.length} rows with data.`);
  if (below) console.log(`⚠ ${below} more rows with an amount below row ${opt.to} — widen with --to if they belong.`);

  const proposals = buildProposals(rows);
  const sheetTotal = printReport(proposals);

  const saved: Partial<Answers> =
    opt.answers && fs.existsSync(opt.answers) ? JSON.parse(fs.readFileSync(opt.answers, "utf8")) : {};
  const answers: Answers = {
    categories: saved.categories ?? {},
    payers: saved.payers ?? {},
    dates: saved.dates ?? {},
    contribution: saved.contribution ?? { date: "", method: "cash", split: {} },
  };
  const equalSplit = (names: string[]) =>
    Object.fromEntries(
      names.map((n, i) => [
        n,
        i === 0 ? FUND_TOTAL - Math.floor(FUND_TOTAL / names.length) * (names.length - 1) : Math.floor(FUND_TOTAL / names.length),
      ]),
    );

  // Non-interactive: answers file in, payload file out (no database needed).
  if (opt.emit) {
    if (!Object.keys(answers.contribution.split).length) {
      answers.contribution.split = equalSplit(SEED_PARTNERS.map((p) => p.name));
      console.log("\n⚑ No fund split in the answers — using the default equal split.");
    }
    const payload = buildPayload(proposals, answers);
    fs.writeFileSync(opt.emit, JSON.stringify(payload));
    const total = payload.expenses.reduce((a, e) => a + e.amount, 0);
    console.log(`\n✓ Wrote ${payload.expenses.length} expenses (${tk(total)}) and ${payload.contributions.length} contributions to ${opt.emit}`);
    for (const c of payload.contributions) console.log(`    ${c.partner} ${tk(c.amount)}`);
    process.exit(0);
  }

  if (!opt.commit) {
    console.log("\nDry run only — nothing written. Re-run with --commit to answer the questions and import.");
    process.exit(0);
  }

  const db = createDb();
  const ps = await db.select().from(partners).orderBy(asc(partners.sortOrder), asc(partners.id));
  if (ps.length === 0) throw new Error("No partners — run `pnpm db:setup` first.");

  // Line iterator instead of rl.question(): works for a terminal and for piped answers.
  const rl = readline.createInterface({ input: stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q: string) => {
    stdout.write(q);
    const next = await lines.next();
    if (next.done) throw new Error("Input ended before all questions were answered.");
    if (!stdin.isTTY) stdout.write(`${next.value}\n`);
    return String(next.value).trim();
  };

  // 1. Categories
  console.log("\n— Categories —");
  const slugs = SEED_CATEGORIES.map((c) => c.slug);
  slugs.forEach((s, i) => console.log(`  ${i + 1}. ${catName(s)}`));
  for (;;) {
    const a = await ask("Row number to change its category (Enter = accept all suggestions): ");
    if (!a) break;
    const p = proposals.find((x) => x.row === Number(a));
    if (!p) {
      console.log("  No such row.");
      continue;
    }
    const c = Number(await ask(`  Row ${p.row} "${p.description}" — category number: `));
    if (slugs[c - 1]) answers.categories[p.row] = slugs[c - 1];
  }

  // 2. Payers the partners must choose
  const named = proposals.filter((p) => p.payer === null);
  if (named.length) {
    console.log("\n— Who paid? (rows with a name in them) —");
    const options = ["fund", ...ps.map((x) => x.name)];
    options.forEach((o, i) => console.log(`  ${i}. ${o === "fund" ? "ফান্ড থেকে" : o}`));
    for (const p of named) {
      if (answers.payers[p.row]) continue;
      for (;;) {
        const name = p.flags.find((f) => f.kind === "payer_named");
        const a = await ask(
          `  Row ${p.row} ${ddmmyyyy(p.date)} ${tk(p.amount)} "${p.description}" (${name && "name" in name ? name.name : ""}): `,
        );
        if (options[Number(a)] !== undefined && a !== "") {
          answers.payers[p.row] = options[Number(a)];
          break;
        }
      }
    }
  }

  // 3. Flagged dates
  const dated = proposals.filter((p) => p.flags.some((f) => f.kind.startsWith("date_")));
  if (dated.length) {
    console.log("\n— Dates that were fixed or guessed —");
    for (const p of dated) {
      console.log(`  Row ${p.row}: ${ddmmyyyy(p.date)}  (${p.flags.filter((f) => f.kind.startsWith("date_")).map(describeFlag).join("; ")})`);
    }
    for (;;) {
      const a = await ask("Row number to correct its date (Enter = accept): ");
      if (!a) break;
      const d = await ask(`  Date for row ${a} as dd/mm/yyyy: `);
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d);
      const isoDate = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
      if (isISODate(isoDate)) answers.dates[Number(a)] = isoDate;
      else console.log("  Not a valid date.");
    }
  }

  // 4. The ৳3,00,000 common fund
  console.log(`\n— The ${tk(FUND_TOTAL)} common fund ("From 300K") —`);
  const firstDate = proposals.map((p) => answers.dates[p.row] ?? p.date).filter(Boolean).sort()[0];
  const defaults = equalSplit(ps.map((p) => p.name));
  for (;;) {
    let sum = 0;
    for (const p of ps) {
      const def = answers.contribution.split[p.name] ?? defaults[p.name];
      const a = await ask(`  How much did ${p.name} put in? [${def}]: `);
      answers.contribution.split[p.name] = a ? Number(a.replace(/[^\d]/g, "")) : def;
      sum += answers.contribution.split[p.name];
    }
    if (sum === FUND_TOTAL) break;
    console.log(`  These add up to ${tk(sum)}, not ${tk(FUND_TOTAL)}. Try again.`);
  }
  const cd = await ask(`  Date of the contribution as dd/mm/yyyy [${ddmmyyyy(answers.contribution.date || firstDate)}]: `);
  const cm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cd);
  answers.contribution.date = cm ? `${cm[3]}-${cm[2].padStart(2, "0")}-${cm[1].padStart(2, "0")}` : answers.contribution.date || firstDate;

  // 5. Confirm and import
  const payload = buildPayload(proposals, answers);
  const importTotal = payload.expenses.reduce((a, e) => a + e.amount, 0);
  console.log(`\nAbout to import ${payload.expenses.length} expenses totalling ${tk(importTotal)} (sheet total ${tk(sheetTotal)})`);
  console.log(`and ${payload.contributions.length} contributions: ${payload.contributions.map((c) => `${c.partner} ${tk(c.amount)}`).join(", ")}.`);
  const answersPath = opt.answers ?? "import-answers.json";
  fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2));
  console.log(`(answers saved to ${path.resolve(answersPath)}; reuse with --answers)`);
  if ((await ask('Type "yes" to import: ')).toLowerCase() !== "yes") {
    console.log("Cancelled — nothing written.");
    rl.close();
    process.exit(0);
  }
  rl.close();

  try {
    const res = await applyPayload(db, payload, { force: opt.force });
    console.log(
      `\n${res.ok ? "✓" : "✗"} App total ${tk(res.total)} ${res.ok ? "matches" : "does NOT match"} the sheet total ${tk(sheetTotal)}.`,
    );
    process.exit(res.ok ? 0 : 2);
  } catch (err) {
    if (err instanceof AlreadyImportedError) {
      console.error(`\nThe ${err.message}. Refusing to import twice (use --force if you really mean it).`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
