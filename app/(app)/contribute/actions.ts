"use server";

import { db } from "@/lib/db";
import {
  createContribution,
  createWithdrawal,
  updateContribution,
  updateWithdrawal,
} from "@/lib/db/mutations";
import type { ContributionMethod } from "@/lib/db/schema";
import { requirePartner } from "@/lib/server/auth";
import { dataChanged } from "@/lib/server/cache";
import { toUserMessage, type ActionResult } from "@/lib/server/action-errors";

export type MoneyInput = {
  id?: number;
  /** set by the phone for new entries; makes a re-send safe */
  clientId?: string | null;
  kind: "contribution" | "withdrawal";
  date: string;
  partnerId: number;
  amount: number;
  method: ContributionMethod;
  note: string;
};

/** Money a partner puts into the fund (contribution) or takes back out (withdrawal). */
export async function saveMoneyAction(input: MoneyInput): Promise<ActionResult> {
  const partner = await requirePartner();
  try {
    const { id, kind, method, ...rest } = input;
    if (kind === "contribution") {
      const data = { ...rest, method };
      const row = id ? await updateContribution(db, partner.id, id, data) : await createContribution(db, partner.id, data);
      dataChanged();
      return { ok: true, id: row.id };
    }
    const row = id ? await updateWithdrawal(db, partner.id, id, rest) : await createWithdrawal(db, partner.id, rest);
    dataChanged();
    return { ok: true, id: row.id };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
