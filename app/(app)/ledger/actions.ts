"use server";

import { db } from "@/lib/db";
import { after } from "next/server";
import { sendEntryNotification } from "@/lib/server/push";
import { voidRow, type VoidableTable } from "@/lib/db/mutations";
import { requirePartner } from "@/lib/server/auth";
import { dataChanged } from "@/lib/server/cache";
import { toUserMessage, type ActionResult } from "@/lib/server/action-errors";
import type { EntryKind } from "@/lib/ledger";

const TABLE: Record<EntryKind, VoidableTable> = {
  expense: "expenses",
  contribution: "contributions",
  withdrawal: "withdrawals",
  sale: "sales",
};

/** Mark an entry বাতিল with a reason. The row stays; it just stops counting. */
export async function voidEntryAction(kind: EntryKind, id: number, reason: string): Promise<ActionResult> {
  const partner = await requirePartner();
  try {
    if (!(kind in TABLE)) throw new Error("bad kind");
    const row = await voidRow(db, partner.id, TABLE[kind], id, reason);
    dataChanged();
    after(() => sendEntryNotification({ actorId: partner.id, action: "void", tableName: TABLE[kind], row }));
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
