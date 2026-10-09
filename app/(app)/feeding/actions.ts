"use server";

import { db } from "@/lib/db";
import { createFeeding, voidRow, type FeedingInput } from "@/lib/db/mutations";
import { requirePartner } from "@/lib/server/auth";
import { dataChanged } from "@/lib/server/cache";
import { toUserMessage, type ActionResult } from "@/lib/server/action-errors";

export async function saveFeedingAction(input: FeedingInput): Promise<ActionResult> {
  const me = await requirePartner();
  try {
    const row = await createFeeding(db, me.id, input);
    dataChanged();
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}

export async function voidFeedingAction(id: number, reason: string): Promise<ActionResult> {
  const me = await requirePartner();
  try {
    const row = await voidRow(db, me.id, "feedings", id, reason);
    dataChanged();
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
