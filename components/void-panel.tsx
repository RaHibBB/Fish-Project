"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { voidEntryAction } from "@/app/(app)/ledger/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EntryKind } from "@/lib/ledger";

/** "বাতিল করুন" with a required reason. Nothing is ever deleted. */
export function VoidPanel({ kind, id }: { kind: EntryKind; id: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="destructive" className="h-12 flex-1 text-base" onClick={() => setOpen(true)}>
        <Ban className="size-5" /> বাতিল করুন
      </Button>
    );
  }

  function confirm() {
    if (reason.trim().length < 2) return setError("বাতিলের কারণ লিখুন।");
    startTransition(async () => {
      const res = await voidEntryAction(kind, id, reason);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="w-full space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm">
        বাতিল করলে এন্ট্রিটি তালিকায় থাকবে কিন্তু কোনো হিসাবে যোগ হবে না। এটা আর ফেরানো যাবে না।
      </p>
      <Textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={200}
        placeholder="কারণ, যেমন: দুইবার লেখা হয়েছে"
        className="min-h-20 text-base"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" className="h-12 flex-1" onClick={() => setOpen(false)} disabled={pending}>
          থাক
        </Button>
        <Button variant="destructive" className="h-12 flex-1" onClick={confirm} disabled={pending}>
          {pending ? "…" : "হ্যাঁ, বাতিল"}
        </Button>
      </div>
    </div>
  );
}
