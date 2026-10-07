/**
 * One-time account setup from the ACCOUNTS_SETUP env var (JSON), run in the Vercel build:
 *   { "phones": { "রাফি": "+880 1755-000111" }, "admins": [{ "name": "রাহিব", "phone": "01766000222" }] }
 * Sets partners' phone numbers (by name) and creates login-only admins whose phone isn't used yet,
 * printing their temporary PINs. Idempotent; does nothing without ACCOUNTS_SETUP. Remove the
 * variable afterwards — later changes are made in Settings → অ্যাকাউন্ট.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { normalizePhone } from "../lib/auth/pin";
import { createDb } from "../lib/db/client";
import { createAdmin, updateAccount } from "../lib/db/account-mutations";
import { partners } from "../lib/db/schema";

type Setup = { phones?: Record<string, string>; admins?: { name: string; phone: string }[] };

async function main() {
  const raw = process.env.ACCOUNTS_SETUP;
  if (!raw) {
    console.log("accounts:apply — ACCOUNTS_SETUP not set, nothing to do.");
    return;
  }
  const setup = JSON.parse(raw) as Setup;
  const db = createDb();

  for (const [name, phoneRaw] of Object.entries(setup.phones ?? {})) {
    const phone = normalizePhone(phoneRaw);
    const [p] = await db.select().from(partners).where(eq(partners.name, name));
    if (!p || !phone) {
      console.log(`accounts:apply — skipped phone for "${name}" (${!p ? "no such person" : "invalid number"})`);
      continue;
    }
    if (p.phone === phone) continue;
    await updateAccount(db, p.id, p.id, { name: p.name, phone });
    console.log(`accounts:apply — ${name}: phone set to ${phone}`);
  }

  for (const a of setup.admins ?? []) {
    const phone = normalizePhone(a.phone);
    const [existing] = phone ? await db.select().from(partners).where(eq(partners.phone, phone)) : [];
    if (existing) {
      console.log(`accounts:apply — ${a.name} already has an account (${phone})`);
      continue;
    }
    const r = await createAdmin(db, null, a);
    console.log(`accounts:apply — admin ${r.name} ${r.phone} PIN ${r.pin} (temporary)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
