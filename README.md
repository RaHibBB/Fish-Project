# খামারের হিসাব — Chowdhury Brothers Agro

A small, mobile-first Bengali web app for the farm's three partners (রাফি, রিয়াজ, অভি):
record daily expenses, record the money each partner puts in or takes out, and always see the
cash box (ক্যাশ বাক্স) and each partner's position. Spec: [FISH_PROJECT_SPEC.md](FISH_PROJECT_SPEC.md);
judgment calls: [DECISIONS.md](DECISIONS.md).

Stack: Next.js 16 (App Router, Server Actions) · Tailwind + shadcn/ui · Drizzle ORM · Neon Postgres ·
Vercel Blob (receipts) · Zod · Vitest. Runs free on Vercel Hobby + Neon Free.

## Screens

| Tab | What it does |
| --- | --- |
| হোম | Cash box (red when negative) + টাকা দিন, today / this month / total, partner cards with settle-up, last 10 entries. ⚙ opens Settings. |
| হিসাব | Every entry by day with daily subtotals; filter by month, type, category, payer; search. Tap to view, edit (logged) or void (বাতিল) with a reason. |
| **+** | Add expense. Daily labour: **শ্রমিক → count → সংরক্ষণ**. |
| খাত | Spending per category for a period, payer and category selection; category detail; PDF/CSV. |
| রিপোর্ট | Monthly totals, category breakdown, partner statements, settle-up; PDF and CSV exports. |

**Viewing is open** to anyone with the link (no login); **login is only needed to add, edit, void or change
settings**. Search engines are blocked via `robots.txt`; share the link only with the family.

Nothing is ever deleted: wrong entries are voided and stay visible. The database blocks `DELETE`,
and every write is recorded in `audit_log`.

## Local development

Requires Node 20+ and pnpm.

```bash
pnpm install
pnpm db:setup        # migrations + seed; prints the 3 partners' temporary PINs
pnpm dev             # http://localhost:3000
```

Without `DATABASE_URL` the app uses a local PGlite database in `.pglite/` (real Postgres, in-process),
so no account is needed for development. Stop `pnpm dev` before running scripts against `.pglite/`.

```bash
pnpm typecheck       # next typegen + tsc
pnpm test            # Vitest (money logic, DB triggers, auth, import parsing, exports)
pnpm lint
pnpm build
```

## Deploy (free)

1. **Neon**: create a project (Free plan). Copy the connection string.
2. **Vercel**: import this repo (Hobby plan). Add a **Blob** store to the project (Storage tab) —
   it sets `BLOB_READ_WRITE_TOKEN`.
3. Environment variables (Vercel → Settings → Environment Variables), see `.env.example`:
   - `DATABASE_URL` — Neon connection string
   - `SESSION_SECRET` — 32+ random characters, e.g. `openssl rand -base64 48`
   - `BLOB_READ_WRITE_TOKEN` — set by the Blob store
4. Tables and partner accounts are created automatically: `vercel.json` runs `pnpm db:setup` before
   every build (it only applies new migrations and never touches existing partners). On the very first
   deploy the build log prints the 3 partners' temporary PINs; phones are placeholders
   (01700000001/2/3) unless the `SEED_PHONES` env var is set (রাফি, রিয়াজ, অভি order). Log in, change
   the phone numbers in Settings, and give each partner their PIN privately — they must change it at
   first login.
5. Deploy. On each phone open the site and use **Add to Home Screen** to install it.

Later schema changes: edit `lib/db/schema.ts`, run `pnpm db:generate`, commit the new file in
`drizzle/`, and run `pnpm db:setup` against Neon (it only applies new migrations).

## Import the old Google Sheet (one time)

1. In Google Sheets: File → Download → Microsoft Excel (.xlsx).
2. Dry run — prints every row with the resolved date, suggested category, payer and ⚑ flags.
   Nothing is written:

   ```bash
   DATABASE_URL="postgresql://…" pnpm import:sheet ./sheet.xlsx
   ```

   Defaults: tab `খরচ (Expense)`, header row 4, data rows 5–38 (`--sheet`, `--from`, `--to` to change;
   it warns if there are amounts below the range).
3. Real run with the partners present — it asks them to confirm or change categories, choose who
   paid for rows with a name in them (e.g. "Rahib", "[rafi]"), check fixed dates, and enter each
   partner's real share of the ৳3,00,000 fund. Then it imports everything in one transaction:

   ```bash
   DATABASE_URL="postgresql://…" pnpm import:sheet ./sheet.xlsx --commit
   ```

   Answers are saved to `import-answers.json` (reuse with `--answers import-answers.json`). The script
   refuses to run on a database that already has expenses, and finishes by checking that the app
   total equals the sheet total (৳3,02,830).

## Backups

`.github/workflows/backup.yml` runs every Saturday 02:00 Dhaka time (and on demand from the Actions
tab). It writes a `pg_dump` plus one CSV per table into a dated folder of a **private** repo.

Setup: create a private repo (e.g. `farm-backups`), a fine-grained GitHub token with *Contents: read
and write* on that repo only, and add these secrets to this repo: `DATABASE_URL`, `BACKUP_REPO`
(`owner/farm-backups`), `BACKUP_REPO_TOKEN`. Run the workflow once by hand to check it.
Restore steps are in [docs/backup-README.md](docs/backup-README.md) (copied into the backup repo).

CSV exports are also available any time from the রিপোর্ট tab.

## Forgotten PIN / locked out

Five wrong PINs lock an account for 15 minutes. To issue a new temporary PIN:

```bash
DATABASE_URL="postgresql://…" pnpm reset-pin 01711111111
```

## Project layout

```
app/(app)/        screens with the bottom nav (home, ledger, add, categories, reports, settings, contribute)
app/print/        A4 print pages for PDF (browser print keeps Bengali conjuncts correct)
app/export/       CSV downloads (UTF-8 with BOM)
lib/money.ts      all money rules (fund balance, positions, settle-up, totals) — unit-tested
lib/db/           schema, migrations setup, validated writes + audit log
lib/import/       sheet import parsing (dates, categories, payers)
drizzle/          SQL migrations, incl. the no-delete triggers
scripts/          db-setup, import-sheet, reset-pin
```
