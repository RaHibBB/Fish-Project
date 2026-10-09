"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { discard, flushOutbox, onOutboxChange, readOutbox, type OutboxItem } from "@/lib/client/outbox";
import { toBnDigits } from "@/lib/format";

/**
 * Shows entries saved on this phone while offline and sends them when the connection is back
 * (automatically on reconnect, or with the button).
 */
export function OutboxBanner() {
  const router = useRouter();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const refresh = () => setItems(readOutbox());
    refresh();
    const off = onOutboxChange(refresh);
    const send = () =>
      flushOutbox().then((n) => {
        if (n) router.refresh();
      });
    send();
    window.addEventListener("online", send);
    return () => {
      off();
      window.removeEventListener("online", send);
    };
  }, [router]);

  if (items.length === 0) return null;
  const failed = items.filter((i) => i.error);

  return (
    <div className="no-print mx-auto w-full max-w-md px-4 pt-3">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <div className="flex items-center gap-2">
          <CloudOff className="size-5 shrink-0 text-amber-600" />
          <button type="button" className="flex-1 text-left" onClick={() => setOpen((o) => !o)}>
            <b>{toBnDigits(items.length)}টি entry পাঠানো বাকি</b>
            <span className="block text-xs text-muted-foreground">ফোনে রাখা আছে — নেট এলে নিজেই চলে যাবে</span>
          </button>
          <Button
            size="sm"
            className="h-9"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (await flushOutbox()) router.refresh();
              })
            }
          >
            <RotateCw className="size-4" /> পাঠান
          </Button>
        </div>
        {(open || failed.length > 0) && (
          <ul className="mt-2 space-y-1 border-t border-amber-500/30 pt-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <span className="flex-1">
                  {i.summary}
                  {i.error && <span className="block text-xs text-destructive">{i.error}</span>}
                </span>
                {i.error && (
                  <button
                    type="button"
                    aria-label="বাদ দিন"
                    onClick={() => discard(i.id)}
                    className="p-1.5 text-muted-foreground"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
