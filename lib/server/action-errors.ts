import "server-only";
import { ZodError } from "zod";
import { MutationError } from "@/lib/db/mutations";
import { ReceiptError } from "./receipts";

const MESSAGES: Record<string, string> = {
  invalid_date: "তারিখ সঠিক নয়।",
  future_date: "ভবিষ্যতের তারিখ দেওয়া যাবে না।",
  labour_fields: "শ্রমিকের সংখ্যা ও মজুরি দুটোই দিন।",
  labour_amount: "টাকা = শ্রমিক × মজুরি মিলছে না।",
  unknown_category: "খাত বাছুন।",
  unknown_partner: "পার্টনার পাওয়া যায়নি।",
  not_found: "এন্ট্রিটি পাওয়া যায়নি।",
  voided: "এন্ট্রিটি বাতিল করা হয়েছে, আর বদলানো যাবে না।",
  bad_type: "রসিদের ছবি JPG/PNG হতে হবে।",
  too_big: "রসিদের ছবি ২০০ KB এর বেশি।",
  not_configured: "রসিদ আপলোড চালু নেই।",
  phone_taken: "এই ফোন নম্বর দিয়ে আগে থেকেই একটি অ্যাকাউন্ট আছে।",
  invalid_phone: "ফোন নম্বর সঠিক নয় — বাংলাদেশি 01XXXXXXXXX, অন্য দেশের হলে +কোড সহ (যেমন +971…)।",
};

const FIELD_MESSAGES: Record<string, string> = {
  amount: "টাকার অঙ্ক দিন (১ থেকে ১ কোটি)।",
  categoryId: "খাত বাছুন।",
  partnerId: "পার্টনার বাছুন।",
  labourCount: "শ্রমিকের সংখ্যা দিন।",
  labourRate: "মজুরি সঠিক নয়।",
  date: "তারিখ সঠিক নয়।",
  description: "নোট ২০০ অক্ষরের মধ্যে রাখুন।",
  note: "নোট ২০০ অক্ষরের মধ্যে রাখুন।",
  reason: "বাতিলের কারণ লিখুন।",
  method: "কীভাবে দিলেন বাছুন।",
};

/** Turn any error from a write into a short Bengali message for the form. */
export function toUserMessage(err: unknown): string {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    if (issue && MESSAGES[issue.message]) return MESSAGES[issue.message];
    const field = String(issue?.path[0] ?? "");
    return FIELD_MESSAGES[field] ?? "তথ্য সঠিক নয়।";
  }
  if (err instanceof MutationError || err instanceof ReceiptError) {
    return MESSAGES[err.message] ?? "সংরক্ষণ করা যায়নি।";
  }
  console.error(err);
  return "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।";
}

export type ActionResult = { ok: true; id: number } | { ok: false; error: string };
