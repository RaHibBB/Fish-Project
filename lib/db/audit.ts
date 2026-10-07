import type { Executor } from "./client";
import { auditLog } from "./schema";

const SECRET_KEYS = new Set(["pinHash", "pin_hash"]);

/** Strip secrets and make the row JSON-safe (Dates -> ISO strings). */
function snapshot(row: unknown): unknown {
  if (row == null) return null;
  return JSON.parse(
    JSON.stringify(row, (key, value) => (SECRET_KEYS.has(key) ? undefined : value)),
  );
}

export type AuditEntry = {
  actorId: number | null;
  action: string;
  tableName: string;
  rowId?: number | null;
  before?: unknown;
  after?: unknown;
};

/** Append one row to audit_log. Call inside the same transaction as the write it describes. */
export async function writeAudit(tx: Executor, entry: AuditEntry) {
  await tx.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    tableName: entry.tableName,
    rowId: entry.rowId ?? null,
    before: snapshot(entry.before),
    after: snapshot(entry.after),
  });
}
