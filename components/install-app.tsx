"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "install-dismissed";

/** Registers the service worker (production only). Rendered once in the root layout. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/**
 * "অ্যাপ হিসেবে ইনস্টল করুন" card on Home. Android/Chrome: one-tap install. iPhone/iPad
 * Safari has no install API, so it shows the Share → Add to Home Screen steps instead.
 * Hidden when already running as an installed app or after "পরে".
 */
export function InstallApp() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    // Effects run once on mount; setting state here only reveals the card client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIos(isIos);
    if (isIos) setHidden(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!ios && !event)) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <section className="relative mx-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <button type="button" aria-label="পরে" onClick={dismiss} className="absolute top-1.5 right-1.5 p-1.5 text-muted-foreground">
        <X className="size-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/192" alt="" className="size-11 rounded-xl" />
      <div className="flex-1 pr-5 text-sm">
        <p className="font-semibold">ফোনে অ্যাপ হিসেবে রাখুন</p>
        {ios ? (
          <p className="text-muted-foreground">
            নিচের <Share className="inline size-4 align-text-bottom" /> শেয়ার বোতাম → <b>Add to Home Screen</b> চাপুন।
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">হোম স্ক্রিন থেকে এক চাপে খুলবে, অ্যাপের মতো।</p>
            <Button
              className="mt-2 h-10"
              onClick={async () => {
                await event!.prompt();
                await event!.userChoice;
                setEvent(null);
                setHidden(true);
              }}
            >
              <Download className="size-4" /> ইনস্টল করুন
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
