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
import { createAdmin, resetPinFor, updateAccount, type adminInput } from "@/lib/db/account-mutations";
import { requirePartner } from "@/lib/server/auth";
import { dataChanged } from "@/lib/server/cache";
import { toUserMessage } from "@/lib/server/action-errors";
import { ZodError, type z } from "zod";

export type SimpleResult = { ok: true } | { ok: false; error: string };

const EXTRA: Record<string, string> = {
  shares_sum: "সবার ভাগ মিলিয়ে ঠিক ১০০% হতে হবে।",
  duplicate_phone: "দুইজনের একই ফোন নম্বর হতে পারবে না।",
  invalid_phone: "ফোন নম্বর সঠিক নয় — বাংলাদেশি 01XXXXXXXXX, অন্য দেশের হলে +কোড সহ (যেমন +971…)।",
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
    dataChanged();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function savePartnersAction(input: z.input<typeof partnersInput>): Promise<SimpleResult> {
  const me = await requirePartner();
  try {
    await updatePartners(db, me.id, input);
    dataChanged();
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
    dataChanged();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export type PinResult = { ok: true; name: string; phone: string; pin: string } | { ok: false; error: string };

/** Add a login-only admin; returns the temporary PIN to show once. */
export async function addAdminAction(input: z.input<typeof adminInput>): Promise<PinResult> {
  const me = await requirePartner();
  try {
    const r = await createAdmin(db, me.id, input);
    dataChanged();
    return { ok: true, name: r.name, phone: r.phone, pin: r.pin };
  } catch (err) {
    return fail(err) as PinResult;
  }
}

/** New temporary PIN for another account (forgotten PIN / locked out). */
export async function resetPinAction(targetId: number): Promise<PinResult> {
  const me = await requirePartner();
  if (targetId === me.id) return { ok: false, error: "নিজের পিন বদলাতে 'পিন বদলান' ব্যবহার করুন।" };
  try {
    const r = await resetPinFor(db, me.id, targetId);
    return { ok: true, name: r.name, phone: r.phone, pin: r.pin };
  } catch (err) {
    return fail(err) as PinResult;
  }
}

export async function saveAccountAction(id: number, input: z.input<typeof adminInput>): Promise<SimpleResult> {
  const me = await requirePartner();
  try {
    await updateAccount(db, me.id, id, input);
    dataChanged();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
