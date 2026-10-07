# Chowdhury Brothers Agro — Expense & Partner Money Tracker (Build Spec v3)

A tiny, super simple, mobile-first web app (Bengali UI) for a fish farm run by 3 partner cousins. **Scope is deliberately small:** record daily expenses, record how much each partner has put in, and always show the cash balance and each partner's position. No pond/fish/feeding/water/harvest modules now.

Read this whole file first. Build step by step, verify each step, and record judgment calls in `DECISIONS.md`.

## 1. Context (from the current Google Sheet)
- Partners: **Rafi, Reaz, Ovi**. They put in a common fund of **৳3,00,000** ("From 300K"). Per-partner split must be entered in the app (do not assume equal unless confirmed; default share 1/3 each, editable).
- ~45 expense rows so far, total ≈ ৳3,02,830 → fund balance ≈ −৳2,830 (fund overspent).
- Most rows are **daily labour**: number of labourers × ৳820/day (e.g. 6 × 820 = 4,920). This must be a one-tap entry.
- Some expenses were paid by a person directly, not from the fund (e.g. a ৳50,000 row with "Rahib", a ৳2,750 feed bag noted "[rafi]"). The app must record **who paid** every expense.

## 2. Hard constraints
- **Zero cost**: Next.js on Vercel Hobby, Neon Free (Postgres) + Drizzle ORM, Vercel Blob for receipt photos. Weekly backup via GitHub Actions. No paid APIs, no SMS.
- **Never delete**: wrong entries are voided with a reason; voided rows stay visible as "বাতিল" but are excluded from totals. DB trigger blocks DELETE. Every write goes to `audit_log`.
- Money as integer taka. Timezone Asia/Dhaka. **Dates always dd/mm/yyyy, picked from a date picker (never free-typed)** — the old sheet mixed dd/mm and mm/dd and had typos like `6/070/26` and `27/04/27`.
- Bengali UI with Bengali digits for display. Mobile-first at 360px, big tap targets, one-hand use.
- Adding a daily labour cost: **3 taps + 1 number**, under 10 seconds.

## 3. Stack
Next.js (App Router, TS, Server Actions), Tailwind + shadcn/ui, Drizzle + Neon serverless driver, Zod, Vitest, Noto Sans Bengali via next/font. Installable as a PWA (manifest + icon) so partners can "Add to Home Screen".
Auth: 3 partner accounts, phone + 6-digit PIN (bcryptjs), signed httpOnly cookie via jose (90 days), lockout after 5 wrong PINs, forced PIN change on first login. All 3 have equal rights.

## 4. Data model
- `partners`: id, name, phone, pin_hash, share_bp (basis points; default 3334/3333/3333), must_change_pin, failed_logins, locked_until.
- `settings`: labour_daily_wage (820), farm_name, start_date.
- `categories` (seeded, editable): শ্রমিক মজুরি, খাবার, পোনা, চুন ও সার, ওষুধ, লিজ/ভাড়া, পুকুর খনন ও প্রস্তুতি, যন্ত্রপাতি ও পাইপ, পানি সেচ ও পাম্প, পরিবহন, পাহারা, অন্যান্য. Each has an icon and colour.
- `expenses`: id, date, category_id, amount, description, **paid_by** (`fund` | partner_id), labour_count (nullable), labour_rate (nullable), receipt_url (nullable), void_reason/voided_by/voided_at, created_by, created_at.
- `contributions`: id, date, partner_id, amount, method (নগদ/বিকাশ/ব্যাংক), note, void fields. (Money a partner puts into the common fund.)
- `withdrawals`: id, date, partner_id, amount, note, void fields. (Money a partner takes back out — rare.)
- `audit_log`: actor, action, table, row_id, before, after, created_at.

## 5. Money logic (`lib/money.ts`, unit-tested with Vitest)
- **Fund balance (ক্যাশ বাক্স)** = Σ contributions − Σ expenses paid_by fund − Σ withdrawals. Red when negative.
- **Total expense** = Σ all expenses (fund + paid personally).
- **Per partner**:
  - দিয়েছেন (put in) = their contributions + expenses they paid personally − their withdrawals.
  - ভাগের খরচ (fair share) = total expense × share_bp / 10000.
  - অবস্থান (net) = দিয়েছেন − ভাগের খরচ − (their share of the current fund balance).
  Positive = others owe them; negative = they owe. Net positions must sum to exactly 0 (handle taka rounding by giving the remainder to the largest share).
- **Settle-up**: minimal list of transfers, e.g. "অভি → রাফি ৳১২,৫০০".
- Per day, per month and per category totals; `categoryTotals({from, to, payer, categoryIds})` returning total, count, % and labour-days, used by the খাত screen and its PDF/CSV.
- Tests: personal payment, unequal shares, voided rows, rounding sums to zero, negative fund.

## 6. Screens (bottom nav: হোম · হিসাব · [+] · খাত · রিপোর্ট — the + is the raised centre button)
1. **হোম (Home)**
   - Big card: fund balance (red if negative) and a "টাকা দিন" (add contribution) button.
   - Today's total, this month's total, total expense to date.
   - 3 partner cards: put in, fair share, net (+/−) and one-line settle-up.
   - Last 10 entries.
2. **+ খরচ (Add expense)** — the main screen, opened by a big floating + button:
   - **Quick chips at top**: "শ্রমিক" (labour) shows a number stepper for labourer count; amount = count × daily wage, auto-filled. Other chips: খাবার, চুন ও সার, ওষুধ, পাইপ/যন্ত্র, পরিবহন, অন্যান্য.
   - Amount keypad (numeric, big), optional short note, date (defaults to today; one tap for "গতকাল"), **কে দিল**: "ফান্ড থেকে" (default) / Rafi / Reaz / Ovi, optional receipt photo (compressed to ≤200 KB before upload).
   - "Save" and "Save + আরেকটা" (stays on the form with the same date and payer).
   - Repeat last entry button (labour repeats daily).
3. **হিসাব (Ledger)**: list grouped by day with a daily subtotal; filters for month, category, payer; search. Tap an entry to view, edit (edit is logged) or void with reason.
4. **খাত (Categories)** — answer "কোন খাতে কত খরচ হয়েছে?" at a glance:
   - **Period selector** at top (sticky chips): এই মাস / গত মাস / এই বছর / শুরু থেকে / কাস্টম তারিখ (from–to date pickers). Default: শুরু থেকে. Optional payer filter: সবাই / ফান্ড / Rafi / Reaz / Ovi.
   - **Category list** sorted by amount (highest first): icon, name, total ৳, % of total, entry count, and a thin horizontal bar showing its share. A donut/bar chart of the same data above the list. Grand total at the bottom must equal the sum of the rows.
   - **Category dropdown/selector** ("খাত বাছুন"): pick one or more categories (multi-select chips) to see their combined total for the selected period.
   - **Tap a category** → detail page: total for the period, month-by-month totals (bar chart + table), average per month, and every entry in that category (date, amount, note, who paid, receipt). For শ্রমিক মজুরি also show total labour-days (Σ labour_count) and average labourers per day.
   - Compare: "এই মাস বনাম গত মাস" change (৳ and %) shown per category.
   - PDF and CSV of the current view (respecting period, payer and category filters).
   - Category is **required** when adding an expense (no blank category), so this view is always complete.
5. **রিপোর্ট (Reports)**: monthly totals with a simple bar chart, category breakdown, partner statement for each partner, settle-up sheet. Buttons: **PDF** (print page + `window.print()`; do not use @react-pdf or jsPDF — Bengali conjuncts break) and **Excel/CSV export** (UTF-8 with BOM).

Settings (from Home header): partners & shares, daily wage, categories, change PIN.

## 7. Backup
- Weekly GitHub Actions `pg_dump` + CSV of each table committed to a private `farm-backups` repo; README explains restore.
- CSV export available any time from Reports.

## 8. Import from the existing Google Sheet (one-time)
Script `scripts/import-sheet.ts` reading an exported `.xlsx` of the sheet "খরচ (Expense)" tab (rows 5–38; header row 4: Date, Labourer, Voucher No., Expense Category, Description, Amount, Supplier, Payment Method, Receipt?, Remarks). Dry-run first, print a report, then import.
- Labour rows: description "Cut to Fill, Prep tools & Food" with a Labourer count → category শ্রমিক মজুরি, labour_count, rate = amount / count.
- Remarks "From 300K" → paid_by `fund`. A name in the Labourer column or in brackets in the description (e.g. "[rafi]", "Rahib") → flag for the partners to choose the payer; do not guess.
- The "Expense Category" column mostly says "Lease" for everything — ignore it and suggest a category from the description (pipe → যন্ত্রপাতি ও পাইপ, chun/lime → চুন ও সার, osudh/gas tablet → ওষুধ, khawa/khabar → খাবার, pani sech → পানি সেচ ও পাম্প, gari bara → পরিবহন, else অন্যান্য); show suggestions for confirmation.
- **Dates**: some were stored as mm/dd by mistake (e.g. a value read as 2026-01-05 is really 01/05/2026 = 1 May; 2026-06-05 is 6 May). Rows are in chronological order, so use neighbouring rows to resolve. Rows with no date inherit the previous row's date and are flagged. Fix typos `6/070/26` → 06/07/2026 and `27/04/27` → 27/04/2026, flagged.
- Create one contribution of ৳3,00,000 split per the partners' real amounts (ask at import time).
- After import, the app total must equal the sheet total (৳3,02,830) unless a row is deliberately changed.

## 9. Build order
1. Scaffold, font, PWA manifest, bottom nav.
2. Schema, migrations, no-delete trigger, seeds.
3. Auth.
4. `lib/money.ts` + tests.
5. Add expense screen (labour chip first), contributions.
6. Ledger with void/edit + audit.
7. Home cards and settle-up.
8. খাত screen (period selector, category list, multi-select, category detail), then Reports, PDF print pages, CSV export.
9. Backup workflow, import script, README.

## 10. Later (do NOT build now)
Fish sales/income and profit, ponds, stocking, feeding log, harvest, staff attendance, water quality.

## 11. Done when
- A partner adds "6 শ্রমিক" for today in under 10 seconds on a phone.
- Fund balance and partner positions are correct and net positions sum to 0.
- Imported total matches the sheet total.
- On the খাত screen, picking "গত মাস" + "খাবার" shows the right total and its entries, and category totals always add up to the overall total for the same period.
- Voided rows drop out of totals but stay visible.
- Tests pass, `pnpm build` passes, PDF shows correct Bengali.

Env: `DATABASE_URL`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`.
