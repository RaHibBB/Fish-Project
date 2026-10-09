import "server-only";
import webpush from "web-push";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses, pushSubscriptions } from "@/lib/db/schema";
import { todayISO } from "@/lib/format";

export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function saveSubscription(partnerId: number, sub: BrowserSubscription) {
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, partnerId })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, partnerId },
    });
}

export async function removeSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Evening check: if nothing was written today, remind every subscribed phone. */
export async function sendDailyReminder(now = new Date()) {
  if (!pushConfigured()) return { sent: 0, reason: "push not configured" };
  const today = todayISO(now);
  const written = await db.$count(expenses, and(eq(expenses.date, today), isNull(expenses.voidedAt)));
  if (written > 0) return { sent: 0, reason: `${written} expense(s) already written today` };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://fish-project-theta.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const payload = JSON.stringify({
    title: "খামারের হিসাব",
    body: "আজ এখনো কোনো খরচ লেখা হয়নি। শ্রমিক বা অন্য খরচ থাকলে লিখে ফেলুন।",
    url: "/add",
  });
  const subs = await db.select().from(pushSubscriptions);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // The phone unsubscribed or the app was removed: forget this device.
      if (status === 404 || status === 410) await removeSubscription(s.endpoint);
    }
  }
  return { sent, reason: "no expenses today" };
}
