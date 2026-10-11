/**
 * One-time expenses from the EXPENSES_SETUP env var (JSON array), run in the Vercel build:
 *   [{ "clientId": "setup-…", "date": "2026-10-11", "categorySlug": "other", "amount": 1000,
 *      "description": "…", "paidBy": "fund" }]
 * Idempotent (clientId); does nothing without the variable. Prints the cash box before and after.
 * Remove the variable afterwards — later entries are made in the app.
 */
import "dotenv/config";
import { createDb } from "../lib/db/client";
import { applyExpenseSetup, type ExpenseSetup } from "../lib/db/expense-setup";
import { contributions, expenses, sales, withdrawals } from "../lib/db/schema";
import { fundBalance } from "../lib/money";

async function main() {
  const raw = process.env.EXPENSES_SETUP;
  if (!raw) {
    console.log("expenses:apply — EXPENSES_SETUP not set, nothing to do.");
    return;
  }
  const db = createDb();
  const fund = async () =>
    fundBalance({
      expenses: await db.select().from(expenses),
      contributions: await db.select().from(contributions),
      withdrawals: await db.select().from(withdrawals),
      sales: await db.select().from(sales),
    });
  const before = await fund();
  const results = await applyExpenseSetup(db, JSON.parse(raw) as ExpenseSetup);
  for (const r of results) console.log(`expenses:apply — ${r.action} (expense #${r.id})`);
  console.log(`expenses:apply — cash box ${before} → ${await fund()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
