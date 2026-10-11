/**
 * One-time "start fresh" from the LEDGER_RESET env var (JSON), run in the Vercel build:
 * voids every existing expense, sets each partner's fund contribution, adds ONE total-cost expense.
 * Idempotent (clientId); does nothing without the variable. Remove the variable afterwards.
 */
import "dotenv/config";
import { createDb } from "../lib/db/client";
import { applyLedgerReset, type LedgerReset } from "../lib/db/ledger-reset";
import { contributions, expenses, sales, withdrawals } from "../lib/db/schema";
import { fundBalance } from "../lib/money";

async function main() {
  const raw = process.env.LEDGER_RESET;
  if (!raw) {
    console.log("ledger-reset — LEDGER_RESET not set, nothing to do.");
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
  const res = await applyLedgerReset(db, JSON.parse(raw) as LedgerReset);
  console.log(
    res.skipped
      ? `ledger-reset — already done (expense #${res.expenseId})`
      : `ledger-reset — voided ${res.voided} expenses, added total-cost expense #${res.expenseId}`,
  );
  console.log(`ledger-reset — cash box ${before} → ${await fund()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
