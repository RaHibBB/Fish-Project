"use server";

import { db } from "@/lib/db";
import { createSale, updateSale } from "@/lib/db/mutations";
import { requirePartner } from "@/lib/server/auth";
import { dataChanged } from "@/lib/server/cache";
import { toUserMessage, type ActionResult } from "@/lib/server/action-errors";

export type SaleFormInput = {
  id?: number;
  clientId?: string | null;
  date: string;
  amount: number;
  fish: string;
  weightKg: number | null;
  buyer: string;
  pondId: number | null;
  receivedByPartnerId: number | null;
  note: string;
};

/** Record (or edit) a fish sale. */
export async function saveSaleAction(input: SaleFormInput): Promise<ActionResult> {
  const me = await requirePartner();
  try {
    const { id, ...data } = input;
    const row = id ? await updateSale(db, me.id, id, data) : await createSale(db, me.id, data);
    dataChanged();
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
