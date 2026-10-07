"use server";

import { db } from "@/lib/db";
import {
  createCategory,
  updateCategory,
  updatePartners,
  updateSettings,
  type categoryInput,
  type partnersInput,
  type settingsInput,
} from "@/lib/db/settings-mutations";
import { requirePartner } from "@/lib/server/auth";
import { toUserMessage } from "@/lib/server/action-errors";
import { ZodError, type z } from "zod";

export type SimpleResult = { ok: true } | { ok: false; error: string };

const EXTRA: Record<string, string> = {
  shares_sum: "সবার ভাগ মিলিয়ে ঠিক ১০০% হতে হবে।",
  duplicate_phone: "দুইজনের একই ফোন নম্বর হতে পারবে না।",
  invalid_phone: "ফোন নম্বর সঠিক নয় (০১XXXXXXXXX)।",
};

function fail(err: unknown): SimpleResult {
  if (err instanceof ZodError) {
    const msg = err.issues.find((i) => EXTRA[i.message])?.message;
    if (msg) return { ok: false, error: EXTRA[msg] };
  }
  const text = String((err as { message?: string })?.message ?? "");
  if (text.includes("partners_phone_unique")) return { ok: false, error: EXTRA.duplicate_phone };
  return { ok: false, error: toUserMessage(err) };
}

export async function saveSettingsAction(input: z.input<typeof settingsInput>): Promise<SimpleResult> {
  const me = await requirePartner();
  try {
    await updateSettings(db, me.id, input);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function savePartnersAction(input: z.input<typeof partnersInput>): Promise<SimpleResult> {
  const me = await requirePartner();
  try {
    await updatePartners(db, me.id, input);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function saveCategoryAction(
  id: number | null,
  input: z.input<typeof categoryInput>,
): Promise<SimpleResult> {
  const me = await requirePartner();
  try {
    if (id === null) await createCategory(db, me.id, input);
    else await updateCategory(db, me.id, id, input);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
