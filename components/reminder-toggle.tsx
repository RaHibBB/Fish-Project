"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { subscribeReminderAction, unsubscribeReminderAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

/** Per-phone switch for the 7pm "nothing written today" reminder. */
export function ReminderToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!key || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [key]);

  function turnOn() {
    setError(null);
    start(async () => {
      try {
        if ((await Notification.requestPermission()) !== "granted") return setState("denied");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key!),
        });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const res = await subscribeReminderAction({ endpoint: json.endpoint, keys: json.keys });
        if (!res.ok) return setError(res.error);
        setState("on");
      } catch {
        setError("চালু করা গেল না। অ্যাপটি ইনস্টল করে আবার চেষ্টা করুন।");
      }
    });
  }

  function turnOff() {
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeReminderAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  return (
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="font-semibold">সন্ধ্যার রিমাইন্ডার</h2>
      <p className="text-xs text-muted-foreground">
        প্রতিদিন সন্ধ্যা ৭টার দিকে, সেদিন কোনো খরচ লেখা না হলে এই ফোনে একটা নোটিফিকেশন আসবে।
      </p>
      {state === "on" && (
        <Button variant="outline" className="h-11 w-full" disabled={pending} onClick={turnOff}>
          <BellOff className="size-4" /> এই ফোনে বন্ধ করুন
        </Button>
      )}
      {state === "off" && (
        <Button className="h-11 w-full" disabled={pending} onClick={turnOn}>
          <Bell className="size-4" /> এই ফোনে চালু করুন
        </Button>
      )}
      {state === "on" && <p className="text-sm text-primary">✓ এই ফোনে চালু আছে</p>}
      {state === "ios-install" && (
        <p className="text-sm">iPhone এ আগে অ্যাপটি হোম স্ক্রিনে রাখুন (শেয়ার → Add to Home Screen), তারপর সেখান থেকে খুলে চালু করুন।</p>
      )}
      {state === "denied" && <p className="text-sm">ফোনের সেটিংসে এই সাইটের নোটিফিকেশন বন্ধ করা আছে — সেখান থেকে চালু করুন।</p>}
      {state === "unsupported" && <p className="text-sm text-muted-foreground">এই ব্রাউজারে নোটিফিকেশন চলে না।</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
