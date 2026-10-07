"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Opens the browser print dialog once fonts are ready ("Save as PDF" there).
 * Browser printing shapes Bengali conjuncts correctly, unlike JS PDF libraries.
 */
export function AutoPrint() {
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setTimeout(() => window.print(), 300);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="no-print mb-4 flex gap-2">
      <Button className="h-11 flex-1 text-base" onClick={() => window.print()}>
        <Printer className="size-4" /> প্রিন্ট / PDF সেভ
      </Button>
      <Button variant="outline" className="h-11 text-base" onClick={() => history.back()}>
        ফিরে যান
      </Button>
    </div>
  );
}
