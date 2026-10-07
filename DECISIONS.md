# Decisions

Judgment calls made while building from `FISH_PROJECT_SPEC.md`.

## Step 1 — Scaffold
- **Next.js 16.4 with Cache Components** (the current `create-next-app` default). Pages are a static shell; anything that reads the DB or the session cookie renders inside `<Suspense>` so it streams per request. No `use cache` on money data — numbers must always be fresh.
- **Route slugs are English** (`/ledger`, `/add`, `/categories`, `/reports`, `/settings`) while all visible text is Bengali. Keeps URLs readable in logs and avoids percent-encoded paths.
- **Partner display names**: Rafi = রাফি, Reaz = রিয়াজ, Ovi = অভি (spec example uses "অভি → রাফি"). Editable in Settings.
- **Money display**: Bengali digits with Indian grouping (৳৩,০০,০০০); negatives as `−৳২,৮৩০` using the real minus sign.
- **Dates** are stored as Postgres `date` / ISO `yyyy-mm-dd` strings and only ever displayed as `dd/mm/yyyy`. "Today" is computed in Asia/Dhaka.
- **PWA icons** are generated PNGs (`/icons/192`, `/icons/512`, `apple-icon`) from one SVG fish so there are no binary assets to maintain. No service worker / offline mode: the spec only asks for installability, and offline writes to a money ledger would need conflict handling.
- **shadcn/ui** initialised with its current default (Base UI primitives, `cn` package). Theme primary changed to a farm green.

## Step 2 — Schema, migrations, seeds
- **`paid_by` is a nullable FK `paid_by_partner_id`**: `NULL` = ফান্ড থেকে, otherwise the partner who paid personally. Gives referential integrity instead of a free-text `'fund' | id` column.
- **Contribution `method`** stored as codes `cash | bkash | bank` (displayed as নগদ/বিকাশ/ব্যাংক).
- **Categories have a stable `slug`** (labour, feed, …) used by quick chips and the importer, so renaming a category in Settings never breaks them. Categories are never deleted; they can be `archived` (hidden from the add form).
- **DB-level guarantees** (migration `0001_no_delete_triggers.sql`): DELETE and TRUNCATE blocked on every table; `audit_log` is append-only; a voided money row is frozen (cannot be edited or un-voided); a void needs a non-blank reason; amounts must be > 0.
- **Local dev / tests use PGlite** (in-process Postgres) when `DATABASE_URL` is unset — the same SQL migrations and triggers run in tests, no Neon account needed. Production refuses to start without `DATABASE_URL`.
- **Neon WebSocket driver (`neon-serverless` Pool)** rather than `neon-http`, because every write is a transaction together with its `audit_log` row.
- **Seeding** creates the 3 partners with random temporary 6-digit PINs printed once (phones via `SEED_PHONES`), `must_change_pin = true`. Re-running the seed never touches existing partners.

## Step 3 — Auth
- **Lockout**: 5 wrong PINs in a row lock that account for **15 minutes** (spec gives no duration). A correct PIN resets the counter. Unknown phone numbers get the same error and the same bcrypt delay as a wrong PIN.
- **Session**: HS256 JWT (jose) in an httpOnly, SameSite=Lax cookie for 90 days, `Secure` in production. `proxy.ts` only does the cheap signature check; `requirePartner()` re-reads the partner from the DB on every page/action and enforces the forced PIN change.
- **PIN rules**: exactly 6 digits (Bengali digits accepted), must differ from the current PIN, and trivial PINs (`111111`, `123456`, `654321`, …) are refused.
- **Audit**: logins, failed logins, lockouts and PIN changes are written to `audit_log`; `pin_hash` is always stripped from audit snapshots.
- Phone numbers are normalised to `01XXXXXXXXX` (accepts `+880`, spaces, dashes, Bengali digits).

## Step 4 — Money logic (`lib/money.ts`)
- Pure functions over plain rows (no DB), so the same code feeds Home, খাত, Reports and the CSV/PDF views, and is unit-tested directly.
- **Rounding**: every split (fair share of total expense, share of the fund balance) rounds each part toward zero and gives the leftover taka to the largest share (first in order on a tie); negative amounts are split symmetrically. Net positions therefore sum to exactly 0 (also checked by a 200-case randomised test).
- **Fund share in the net**: the current fund balance is treated as belonging to the partners by share, so a positive fund lowers everyone's net equally and a negative (overspent) fund raises it — the deficit is shown on the red ক্যাশ বাক্স card, not as a debt between partners.
- **Consequence of the spec's default shares (3334/3333/3333)**: Rafi carries 0.01% more of every cost. With the sheet's numbers (৳3,00,000 in equally, ৳3,02,830 spent from the fund) positions come out −৳20 / +৳10 / +৳10 instead of exactly 0. That is correct for those shares; if the partners are truly equal they can keep it or adjust shares in Settings.
- **Settle-up** is greedy (largest debtor pays largest creditor), giving at most n−1 = 2 transfers for 3 partners.
- `categoryTotals()` computes rows and grand total from the same filtered set, so the grand total always equals the sum of the rows. Percent is a float; display rounds it.
- "Month-on-month change" percent is `null` when last month was 0 (shown as "নতুন").

## Step 5 — Add expense & contributions
- **Fastest path** for daily labour: `+` → **শ্রমিক** → tap the count on the keypad (e.g. ৬) → **সংরক্ষণ**. Amount = count × daily wage and is never typed. The wage can be overridden for one entry (tap the `× ৳৮২০ ✎`), e.g. half-days; the server rejects any labour row where amount ≠ count × rate.
- The amount panel and the labour panel have the same fixed height so the keypad never moves when a chip is picked (found while testing: a shifting keypad caused mis-taps).
- **On-screen Bengali keypad** for amounts/counts instead of the phone keyboard; the bottom nav is hidden on full-screen forms so the Save bar sits at the bottom.
- **Quick chips** (spec list): শ্রমিক, খাবার, চুন ও সার, ওষুধ, পাইপ/যন্ত্র (= যন্ত্রপাতি ও পাইপ), পরিবহন, অন্যান্য, plus **আরও** for the remaining categories. No category = Save disabled.
- **Save** returns to Home; **সংরক্ষণ + আরেকটা** keeps date and payer, clears the rest and shows a confirmation line.
- **আগেরটা আবার** (repeat last) copies the most recent non-voided entry's category, count/rate or amount, note and payer; the date stays as picked (today by default).
- **Dates**: chosen only via the native date picker behind a button that shows dd/mm/yyyy in Bengali digits, plus one-tap আজ / গতকাল. Future dates are refused (client `max` and server validation).
- **Amount limits**: whole taka, 1 to ৳1 crore (guards against an extra zero).
- **Receipts** are compressed in the browser (JPEG, ≤1600px, quality stepped down until ≤200 KB) and stored as **private** Vercel Blobs; they are only served through `/receipts/[id]` to logged-in partners. Without `BLOB_READ_WRITE_TOKEN` in development they are stored inline as a data URL so the feature can be tried locally.
- **Withdrawals** have no separate screen: the টাকা দিন page has a second tab "ফান্ড থেকে ফেরত" (spec says they are rare). The partner defaults to whoever is logged in.
- All screens load the full ledger and compute with `lib/money.ts` (a few hundred rows a year), rather than duplicating money logic in SQL.

## Step 6 — Ledger, void, edit, audit
- **হিসাব shows expenses and money movements together** (জমা/ফেরত rows in green/amber), grouped by day, newest first. The day subtotal counts only non-voided expenses. A "ধরন" filter switches between all / expenses only / জমা-ফেরত. Filters (month, category, payer, search) live in the URL.
- **Search** matches category name, note, payer and amount (Latin or Bengali digits, commas ignored).
- **Edit** reuses the add forms; every edit writes an `update` audit row with before/after, and the entry page shows a readable history ("কে, কখন, কী বদলেছে: টাকা ৳১০০ → ৳১৫০").
- **Void** needs a reason (≥2 chars), warns that it cannot be undone, and is final (the DB trigger freezes voided rows). Voided rows stay in the list struck through with a red **বাতিল** badge and show who voided it, when and why.
- The bottom nav reads the URL, so with Cache Components it renders inside `<Suspense>` with a static fallback bar.

## Step 7 — Home, settle-up, Settings
- **Partner cards** show দিয়েছেন, ভাগের খরচ and অবস্থান (+ green / − red) plus one settle-up line for that partner ("রাফিকে দেবেন ৳…" / "রিয়াজ দেবেন ৳…" / "হিসাব সমান"), all from the same `settleUp()` transfers.
- **"Last 10 entries"** are the 10 most recently *recorded* rows (any kind), so a back-dated entry still shows up right after it is added.
- **Today / this month** use the Dhaka calendar; "this month" runs from the 1st to today.
- **Settings**: farm name, daily wage (affects new entries only), start date; partner names, phones and shares in % with two decimals (stored as basis points; Save is disabled unless they total exactly 100%); categories can be added, renamed, re-iconed, re-coloured and hidden — never deleted. Every change is audit-logged. Phone numbers can be swapped between partners in one save.
- **Not built (outside spec)**: resetting another partner's forgotten PIN from the app. A command-line reset is provided with the Step 9 scripts instead.

## Step 8 — খাত, Reports, PDF, CSV
- **খাত state is in the URL** (`?p=last_month&payer=fund&cats=2,3`, plus `from`/`to` for কাস্টম), so the PDF and CSV links carry exactly the current view. Default period: শুরু থেকে.
- **Category multi-select** (খাত বাছুন) narrows the list, the donut and the grand total to the chosen categories, so the headline number is their combined total for the period.
- Only categories **with spending in the period** are listed; the grand total row always equals the sum of the rows (both come from one `categoryTotals()` call).
- **এই মাস বনাম গত মাস** is always this calendar month vs last, shown under each category regardless of the period chosen (it respects the payer and category filters). Red = spent more, green = less; "নতুন" when last month was 0.
- **Category detail**: month-by-month covers the whole selected period (empty months shown as ০), capped at the current month; for শুরু থেকে it starts at the category's first entry. **Average per month** = period total ÷ number of those months. For শ্রমিক মজুরি: total labour-days (Σ labour_count), working days, and average labourers per working day.
- **Charts** are plain server-rendered SVG (donut + bars) — no chart library, and they print cleanly.
- **PDF** = dedicated `/print/...` pages with no app chrome, A4 print CSS, auto `window.print()` once fonts are loaded and the data has streamed in. No JS PDF library (Bengali conjuncts).
- **CSV**: UTF-8 with BOM, dates dd/mm/yyyy, amounts as plain integers so Excel can sum them. Reports offers: all expenses (voided rows included and marked), contributions/withdrawals, monthly totals, category summary, partner positions + settle-up. The খাত list exports a category summary; the category detail exports its entries.
- **Reports** "Category breakdown" is all-time (শুরু থেকে); period-specific breakdowns live on the খাত screen.

## Step 9 — Backup, import, README
- **Import is interactive but scriptable**: the dry run prints a full report; `--commit` asks the questions (category changes, payer for named rows, date corrections, each partner's share of ৳3,00,000), saves the answers to `import-answers.json`, and imports everything in **one transaction**. It refuses to import into a database that already has expenses (unless `--force`) and exits non-zero if the app total ≠ sheet total.
- **Date resolution**: real date cells get three candidates — as stored, day/month swapped (Sheets mis-read dd/mm as mm/dd), and with the previous row's year; the earliest one not before the previous row wins. Text dates (e.g. `6/070/26`, `27/04/27`) were typed by people as dd/mm, so they are never swapped, only typo-fixed (`070` → 07, year → neighbours' year). Every change from the stored value, and every inherited empty date, is flagged.
- **Payer**: "From 300K" → fund. A name in the Labourer column, a `[name]` in the description, or a known name (Rafi/Reaz/Ovi/Rahib) → the partners must choose (fund or a partner). Rows with no remark and no name default to fund but are flagged "assumed".
- **Labour rows**: "Cut to Fill…" with a numeric Labourer count → শ্রমিক মজুরি with count and rate = amount ÷ count; if that isn't a whole number the row keeps its amount, the head-count goes into the note, and it is flagged.
- **Supplier and voucher number** are appended to the description so nothing from the sheet is lost; the sheet's "Expense Category", "Payment Method" and "Receipt?" columns are not stored.
- The ৳3,00,000 is imported as one contribution per partner (amounts asked at import time, default equal, must total ৳3,00,000), dated the first expense date unless changed, method নগদ.
- Imported rows have `created_by = NULL` and an `import` audit action, shown as "পুরনো শিট থেকে আনা হয়েছে".
- **Backups** go to a separate private repo via a fine-grained token; partner CSVs omit PIN hashes (the `pg_dump` contains them, which is why the repo must be private). `pg_dump` major version is pinned to 17 (Neon's current default) and can be changed in the workflow.
- `scripts/reset-pin.ts` covers forgotten PINs / lockouts from the command line (there is no in-app reset, see Step 7).

## Change after launch — viewing without login (requested by the owner)
- **Anyone with the link can view** Home, হিসাব (incl. entry details and history), খাত, রিপোর্ট, the PDF print pages, CSV exports and receipt photos. **Login is needed only to change data**: add expense, টাকা দিন/ফেরত, edit, void, Settings, change PIN. This overrides spec §3 ("3 partner accounts") for reading only.
- `proxy.ts` now guards only `/add`, `/contribute`, `/settings`, `/change-pin`, `/ledger/*/*/edit` and sends visitors to `/login?next=…`; after login (and the forced PIN change) they land where they were going. `next` only accepts in-app paths (no open redirect). Every server action still calls `requirePartner()`, so writes are protected even if a page is reached some other way.
- Logged out, Home shows a **লগ ইন** button instead of ⚙, and the entry page shows "সম্পাদনা বা বাতিল করতে লগ ইন করুন" instead of the edit/void buttons. Logging out returns to Home.
- Partner phone numbers stay private (only shown in Settings). `robots.txt` disallows all crawling so the site doesn't appear in search engines — but the link itself should still be shared only with the family.
- Since pages no longer read the session cookie, every DB read now calls `connection()` so the numbers are always fetched per request and never frozen into the build.
