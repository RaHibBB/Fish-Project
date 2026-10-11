/**
 * One-time correction of partners' "ফান্ডে জমা" from the CONTRIBUTIONS_SETUP env var (JSON), run in
 * the Vercel build (the production DB URL isn't readable from a laptop):
 *   { "contributions": { "রাফি": { "amount": 70000, "note": "…" }, … } }
 * Idempotent; does nothing without the variable. Remove the variable afterwards — later changes are
 * made in the app (হিসাব → জমা → সম্পাদনা).
 */
import "dotenv/config";
import { createDb } from "../lib/db/client";
import { applyFundContributions, type FundSetup } from "../lib/db/contribution-fix";

async function main() {
  const raw = process.env.CONTRIBUTIONS_SETUP;
  if (!raw) {
    console.log("contributions:apply — CONTRIBUTIONS_SETUP not set, nothing to do.");
    return;
  }
  const results = await applyFundContributions(createDb(), JSON.parse(raw) as FundSetup);
  for (const r of results) console.log(`contributions:apply — ${r.partner}: ${r.action} (${r.detail})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
