"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { after } from "next/server";
import { sendEntryNotification } from "@/lib/server/push";
import { createSale, updateSale, type SaleInput } from "@/lib/db/mutations";
import { sales } from "@/lib/db/schema";
import { requirePartner } from "@/lib/server/auth";
import { dataChanged } from "@/lib/server/cache";
import { toUserMessage, type ActionResult } from "@/lib/server/action-errors";
import { storeReceipt } from "@/lib/server/receipts";

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
  hasReceipt?: boolean;
};

function optionalNumber(v: FormDataEntryValue | null) {
  return v === null || v === "" ? null : Number(v);
}

/** Record (or edit) a fish sale, with an optional receipt photo. */
export async function saveSaleAction(form: FormData): Promise<ActionResult> {
  const me = await requirePartner();
  try {
    const id = optionalNumber(form.get("id"));
    const clientId = id === null ? String(form.get("clientId") ?? "") || null : null;

    // A re-send of a sale that already arrived: done, don't upload the photo again.
    if (clientId) {
      const [already] = await db.select({ id: sales.id }).from(sales).where(eq(sales.clientId, clientId));
      if (already) return { ok: true, id: already.id };
    }

    let receiptUrl: string | null = null;
    const file = form.get("receipt");
    if (file instanceof File && file.size > 0) {
      receiptUrl = await storeReceipt(file);
    } else if (id !== null && form.get("keepReceipt") === "1") {
      const [existing] = await db.select({ r: sales.receiptUrl }).from(sales).where(eq(sales.id, id));
      receiptUrl = existing?.r ?? null;
    }

    const data: SaleInput = {
      date: String(form.get("date") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      fish: String(form.get("fish") ?? ""),
      weightKg: optionalNumber(form.get("weightKg")),
      buyer: String(form.get("buyer") ?? ""),
      pondId: optionalNumber(form.get("pondId")),
      receivedByPartnerId: optionalNumber(form.get("receivedByPartnerId")),
      note: String(form.get("note") ?? ""),
      receiptUrl,
      clientId,
    };
    const row = id === null ? await createSale(db, me.id, data) : await updateSale(db, me.id, id, data);
    dataChanged();
    after(() => sendEntryNotification({ actorId: me.id, action: id === null ? "create" : "update", tableName: "sales", row }));
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
