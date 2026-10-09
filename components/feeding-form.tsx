"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { saveFeedingAction, voidFeedingAction } from "@/app/(app)/feeding/actions";
import { DateField } from "@/components/date-field";
import { PondChips } from "@/components/pond-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/format";
import type { PondOption } from "@/lib/server/queries";

export function FeedingForm({ ponds, feedTypes }: { ponds: PondOption[]; feedTypes: string[] }) {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [pondId, setPondId] = useState<number | null>(null);
  const [kg, setKg] = useState("");
  const [feedType, setFeedType] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!(Number(kg) > 0)) return setError("কত কেজি খাবার দিলেন লিখুন।");
    start(async () => {
      const res = await saveFeedingAction({ date, pondId, feedKg: Number(kg), feedType, note });
      if (!res.ok) return setError(res.error);
      router.push("/feeding");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 p-4 pb-28">
      <section className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <h2 className="text-sm text-muted-foreground">কত কেজি</h2>
          <Input
            autoFocus
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            className="h-14 text-2xl font-bold"
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm text-muted-foreground">খাবারের ধরন</h2>
          <Input value={feedType} onChange={(e) => setFeedType(e.target.value)} list="feed-types" placeholder="যেমন: ভাসমান" className="h-14 text-base" />
          <datalist id="feed-types">
            {feedTypes.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      </section>
      <PondChips ponds={ponds} value={pondId} onChange={setPondId} />
      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">তারিখ</h2>
        <DateField value={date} onChange={setDate} />
      </section>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট (ইচ্ছা হলে)" maxLength={200} className="h-12 text-base" />
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-destructive">{error}</p>}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md">
          <Button disabled={pending} onClick={save} className="h-14 w-full text-lg">
            {pending ? "রাখা হচ্ছে…" : "সংরক্ষণ"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small ✕ on a feeding row (logged-in only): asks for a reason, then voids it. */
export function VoidFeedingButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="বাতিল"
      disabled={pending}
      className="p-1.5 text-muted-foreground"
      onClick={() => {
        const reason = prompt("বাতিলের কারণ লিখুন");
        if (!reason || reason.trim().length < 2) return;
        start(async () => {
          const res = await voidFeedingAction(id, reason);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      <X className="size-4" />
    </button>
  );
}
