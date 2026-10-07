"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { attemptLogin, changePin, type ChangePinError } from "@/lib/auth/pin";
import { endSession, requirePartner, startSession } from "@/lib/server/auth";
import { toBnDigits } from "@/lib/format";

export type FormState = { error?: string };

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await attemptLogin(db, String(form.get("phone") ?? ""), String(form.get("pin") ?? ""));
  if (!result.ok) {
    if (result.reason === "locked") {
      const time = result.lockedUntil.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Dhaka",
        hour: "2-digit",
        minute: "2-digit",
      });
      return { error: `অনেকবার ভুল পিন দেওয়া হয়েছে। ${toBnDigits(time)} এর পর আবার চেষ্টা করুন।` };
    }
    return { error: "ফোন নম্বর বা পিন সঠিক নয়।" };
  }
  await startSession(result.partner.id);
  redirect(result.partner.mustChangePin ? "/change-pin" : "/");
}

const PIN_ERRORS: Record<ChangePinError, string> = {
  wrong_current: "বর্তমান পিন সঠিক নয়।",
  invalid: "নতুন পিন ৬ সংখ্যার হতে হবে।",
  mismatch: "দুইবার দেওয়া নতুন পিন মিলছে না।",
  same: "নতুন পিন আগের পিনের মতো হতে পারবে না।",
  weak: "পিনটি খুব সহজ (যেমন ১২৩৪৫৬ বা ১১১১১১)। অন্য পিন দিন।",
};

export async function changePinAction(_prev: FormState, form: FormData): Promise<FormState> {
  const partner = await requirePartner({ allowPinChange: true });
  const result = await changePin(db, partner.id, {
    current: String(form.get("current") ?? ""),
    next: String(form.get("next") ?? ""),
    confirm: String(form.get("confirm") ?? ""),
  });
  if (!result.ok) return { error: PIN_ERRORS[result.error] };
  redirect("/");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}
