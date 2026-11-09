"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db";
import { createDuePayment, updateDuePayment, type DuePaymentInput } from "@/lib/db/mutations";
import { duePayments } from "@/lib/db/schema";
import { requirePartner } from "@/lib/server/auth";
import { dataChanged } from "@/lib/server/cache";
import { toUserMessage, type ActionResult } from "@/lib/server/action-errors";
import { sendEntryNotification } from "@/lib/server/push";
import { storeReceipt } from "@/lib/server/receipts";

function optionalInt(v: FormDataEntryValue | null) {
  return v === null || v === "" ? null : Number(v);
}

/** Pay (part of) what is owed to a shop — from the fund or from a partner's pocket. Create or edit. */
export async function saveDuePaymentAction(form: FormData): Promise<ActionResult> {
  const me = await requirePartner();
  try {
    const id = optionalInt(form.get("id"));
    const clientId = id === null ? String(form.get("clientId") ?? "") || null : null;

    // A re-send of a payment that already arrived: done, don't upload the photo again.
    if (clientId) {
      const [already] = await db.select({ id: duePayments.id }).from(duePayments).where(eq(duePayments.clientId, clientId));
      if (already) return { ok: true, id: already.id };
    }

    let receiptUrl: string | null = null;
    const file = form.get("receipt");
    if (file instanceof File && file.size > 0) {
      receiptUrl = await storeReceipt(file);
    } else if (id !== null && form.get("keepReceipt") === "1") {
      const [existing] = await db.select({ r: duePayments.receiptUrl }).from(duePayments).where(eq(duePayments.id, id));
      receiptUrl = existing?.r ?? null;
    }

    const paidBy = String(form.get("paidBy") ?? "fund");
    const data: DuePaymentInput = {
      date: String(form.get("date") ?? ""),
      shop: String(form.get("shop") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      paidByPartnerId: paidBy === "fund" ? null : Number(paidBy),
      note: String(form.get("note") ?? ""),
      receiptUrl,
      clientId,
    };
    const row = id === null ? await createDuePayment(db, me.id, data) : await updateDuePayment(db, me.id, id, data);
    dataChanged();
    after(() => sendEntryNotification({ actorId: me.id, action: id === null ? "create" : "update", tableName: "due_payments", row }));
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
