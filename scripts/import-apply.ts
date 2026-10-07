/**
 * Applies an import payload (from `pnpm import:sheet … --emit`) given in the IMPORT_DATA env var.
 * Runs in the Vercel build (see vercel.json) because that is where DATABASE_URL is available.
 * Does nothing when IMPORT_DATA is unset, or when the database already has expenses — so it is
 * safe to leave in the build command. Remove IMPORT_DATA after a successful import.
 */
import "dotenv/config";
import { createDb } from "../lib/db/client";
import { AlreadyImportedError, applyPayload, type ImportPayload } from "../lib/import/payload";

async function main() {
  const raw = process.env.IMPORT_DATA;
  if (!raw) {
    console.log("import:apply — IMPORT_DATA not set, nothing to import.");
    return;
  }
  const payload = JSON.parse(raw) as ImportPayload;
  try {
    const res = await applyPayload(createDb(), payload);
    console.log(
      `import:apply — imported ${res.expenses} expenses and ${res.contributions} contributions; ` +
        `app total ${res.total} ${res.ok ? "matches" : "DOES NOT match"} sheet total ${payload.sheetTotal}.`,
    );
    if (!res.ok) process.exitCode = 1;
  } catch (err) {
    if (err instanceof AlreadyImportedError) {
      console.log(`import:apply — skipped: ${err.message}. Remove the IMPORT_DATA env var.`);
      return;
    }
    throw err;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
