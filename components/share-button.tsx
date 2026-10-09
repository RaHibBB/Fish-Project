"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the phone's share sheet (WhatsApp etc.); falls back to a WhatsApp link on desktop. */
export function ShareButton({ text, label = "WhatsApp এ পাঠান" }: { text: string; label?: string }) {
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // the person closed the share sheet
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }
  return (
    <Button variant="outline" className="h-11 w-full text-base" onClick={share}>
      <Share2 className="size-4" /> {label}
    </Button>
  );
}
