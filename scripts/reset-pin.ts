/**
 * Give a partner a new temporary PIN (forgotten PIN or lockout). They must change it at next login.
 *   pnpm reset-pin 01711111111
 */
import "dotenv/config";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { normalizePhone } from "../lib/auth/pin";
import { writeAudit } from "../lib/db/audit";
import { createDb } from "../lib/db/client";
import { partners } from "../lib/db/schema";

async function main() {
  const phone = normalizePhone(process.argv[2] ?? "");
  if (!phone) {
    console.error("Usage: pnpm reset-pin 01XXXXXXXXX");
    process.exit(1);
  }
  const db = createDb();
  const [p] = await db.select().from(partners).where(eq(partners.phone, phone));
  if (!p) {
    console.error(`No partner with phone ${phone}`);
    process.exit(1);
  }
  const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.transaction(async (tx) => {
    await tx
      .update(partners)
      .set({ pinHash: await bcrypt.hash(pin, 10), mustChangePin: true, failedLogins: 0, lockedUntil: null })
      .where(eq(partners.id, p.id));
    await writeAudit(tx, { actorId: null, action: "reset_pin", tableName: "partners", rowId: p.id });
  });
  console.log(`${p.name} (${phone}): temporary PIN ${pin} — must be changed at next login.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
