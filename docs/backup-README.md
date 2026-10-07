# Farm backups

Weekly snapshots of the খামারের হিসাব database, written by the `Weekly backup` GitHub Action.
Each folder is one backup, named by its date (Dhaka time):

```
2026-10-10/
  farm.dump          full database (pg_dump custom format) — use this to restore
  expenses.csv       one CSV per table, readable in Excel
  contributions.csv
  withdrawals.csv
  categories.csv
  partners.csv       (without PIN hashes)
  settings.csv
  audit_log.csv
```

Keep this repository **private** — it contains every money record.

## Restore into a new Neon database

1. Create an empty Neon project/database and copy its connection string (direct, not pooled).
2. Install the PostgreSQL client (same major version as Neon or newer).
3. Restore:

   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists -d "postgresql://…" 2026-10-10/farm.dump
   ```

   `--clean` drops tables that already exist. The app's triggers block `DELETE`/`TRUNCATE`, so
   restore into an **empty** database rather than over a live one.
4. Point the app at it: set `DATABASE_URL` in Vercel → Project → Settings → Environment Variables, redeploy.
5. Log in and check the Home totals against the last report.

The CSV files are for reading in Excel; restoring from them is a last resort (import them in table
order: settings, categories, partners, then expenses / contributions / withdrawals).
