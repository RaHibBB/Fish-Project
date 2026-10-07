/**
 * Run migrations and seed. Uses DATABASE_URL (Neon) if set, otherwise local PGlite in .pglite/.
 *   pnpm db:setup
 *   SEED_PHONES=01711111111,01722222222,01733333333 pnpm db:setup   (Rafi, Reaz, Ovi)
 */
import "dotenv/config";
import { createDb } from "../lib/db/client";
import { runMigrations, seed } from "../lib/db/setup";

async function main() {
  const driver = process.env.DATABASE_URL ? "neon" : "pglite";
  console.log(`Database: ${driver === "neon" ? "Neon (DATABASE_URL)" : "local PGlite (.pglite/)"}`);
  const db = createDb();
  await runMigrations(db, driver);
  console.log("✓ migrations applied");
  const phones = process.env.SEED_PHONES?.split(",").map((p) => p.trim());
  const { partners } = await seed(db, { phones });
  console.log("✓ settings and categories seeded");
  if (partners.length) {
    console.log("\nPartner accounts created — temporary PINs (shown once, must be changed at first login):");
    for (const p of partners) console.log(`  ${p.name.padEnd(8)} ${p.phone}  PIN ${p.pin}`);
  } else {
    console.log("Partners already exist — left unchanged.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
