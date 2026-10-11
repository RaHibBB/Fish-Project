"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { subscribeReminderAction, unsubscribeReminderAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

/** Notification state of THIS phone, plus switches to turn it on or off. */
function usePush() {
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

  const turnOn = useCallback(() => {
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
  }, [key]);

  const turnOff = useCallback(() => {
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeReminderAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }, []);

  return { state, error, pending, turnOn, turnOff };
}

/** Settings card: switch notifications on/off for this phone. */
export function ReminderToggle() {
  const { state, error, pending, turnOn, turnOff } = usePush();
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="font-semibold">নোটিফিকেশন</h2>
      <p className="text-xs text-muted-foreground">
        • কেউ নতুন এন্ট্রি দিলে বা বদলালে বা বাতিল করলে — কে করেছেন সহ।
        <br />• প্রতিদিন সন্ধ্যা ৭টার দিকে, সেদিন কোনো খরচ লেখা না হলে।
      </p>
      {state === "on" && (
        <>
          <p className="text-sm text-primary">✓ এই ফোনে চালু আছে</p>
          <Button variant="outline" className="h-11 w-full" disabled={pending} onClick={turnOff}>
            <BellOff className="size-4" /> এই ফোনে বন্ধ করুন
          </Button>
        </>
      )}
      {state === "off" && (
        <Button className="h-11 w-full" disabled={pending} onClick={turnOn}>
          <Bell className="size-4" /> এই ফোনে চালু করুন
        </Button>
      )}
      {state === "ios-install" && (
        <p className="text-sm">iPhone এ আগে অ্যাপটি হোম স্ক্রিনে রাখুন (শেয়ার → Add to Home Screen), তারপর সেখান থেকে খুলে চালু করুন।</p>
      )}
      {state === "denied" && <p className="text-sm">ফোনের সেটিংসে এই সাইটের নোটিফিকেশন বন্ধ করা আছে — সেখান থেকে চালু করুন।</p>}
      {state === "unsupported" && <p className="text-sm text-muted-foreground">এই ব্রাউজারে নোটিফিকেশন চলে না।</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

const DISMISS_KEY = "notify-prompt-dismissed";

/** Home card shown (once per phone, until dismissed) to logged-in people who haven't turned notifications on. */
export function NotifyPrompt() {
  const { state, error, pending, turnOn } = usePush();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      // Reveal client-side only: whether this phone dismissed the card lives in localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden || state !== "off") return null;
  return (
    <section className="relative mx-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <button
        type="button"
        aria-label="পরে"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
        }}
        className="absolute top-1.5 right-1.5 p-1.5 text-muted-foreground"
      >
        <X className="size-4" />
      </button>
      <Bell className="mt-0.5 size-6 shrink-0 text-primary" />
      <div className="flex-1 pr-5 text-sm">
        <p className="font-semibold">কেউ এন্ট্রি দিলে জানতে চান?</p>
        <p className="text-muted-foreground">কে কী লিখলেন, সাথে সাথে এই ফোনে নোটিফিকেশন আসবে।</p>
        <Button className="mt-2 h-10" disabled={pending} onClick={turnOn}>
          চালু করুন
        </Button>
        {error && <p className="mt-1 text-destructive">{error}</p>}
      </div>
    </section>
  );
}
