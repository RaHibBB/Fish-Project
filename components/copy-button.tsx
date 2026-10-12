"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copies the text to the clipboard (to paste anywhere, e.g. a WhatsApp group). */
export function CopyButton({ text, label = "মেসেজ কপি করুন" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // older browsers / blocked clipboard: copy through a temporary text box
      const box = document.createElement("textarea");
      box.value = text;
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      try {
        document.execCommand("copy");
      } catch {}
      box.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }

  return (
    <Button variant="outline" className="h-11 w-full text-base" onClick={copy}>
      {done ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />} {done ? "কপি হয়েছে" : label}
    </Button>
  );
}
