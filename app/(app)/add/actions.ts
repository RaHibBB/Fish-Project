"use server";

import { db } from "@/lib/db";
import { createExpense, updateExpense, type ExpenseInput } from "@/lib/db/mutations";
import { requirePartner } from "@/lib/server/auth";
import { toUserMessage, type ActionResult } from "@/lib/server/action-errors";
import { storeReceipt } from "@/lib/server/receipts";
import { eq } from "drizzle-orm";
import { expenses } from "@/lib/db/schema";

function optionalInt(v: FormDataEntryValue | null) {
  return v === null || v === "" ? null : Number(v);
}

/** Create (no `id`) or edit (with `id`) an expense. Edits are audit-logged with before/after. */
export async function saveExpenseAction(form: FormData): Promise<ActionResult> {
  const partner = await requirePartner();
  try {
    const id = optionalInt(form.get("id"));
    const paidBy = String(form.get("paidBy") ?? "fund");

    let receiptUrl: string | null = null;
    const file = form.get("receipt");
    if (file instanceof File && file.size > 0) {
      receiptUrl = await storeReceipt(file);
    } else if (id !== null && form.get("keepReceipt") === "1") {
      const [existing] = await db.select({ r: expenses.receiptUrl }).from(expenses).where(eq(expenses.id, id));
      receiptUrl = existing?.r ?? null;
    }

    const input: ExpenseInput = {
      date: String(form.get("date") ?? ""),
      categoryId: Number(form.get("categoryId") ?? 0),
      amount: Number(form.get("amount") ?? 0),
      description: String(form.get("description") ?? ""),
      paidByPartnerId: paidBy === "fund" ? null : Number(paidBy),
      labourCount: optionalInt(form.get("labourCount")),
      labourRate: optionalInt(form.get("labourRate")),
      receiptUrl,
    };
    const row = id === null ? await createExpense(db, partner.id, input) : await updateExpense(db, partner.id, id, input);
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
