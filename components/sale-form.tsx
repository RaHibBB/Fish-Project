"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSaleAction, type SaleFormInput } from "@/app/(app)/sale/actions";
import { ChoiceChips } from "@/components/choice-chips";
import { DateField } from "@/components/date-field";
import { Keypad } from "@/components/keypad";
import { PondChips } from "@/components/pond-chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isNetworkError, queue } from "@/lib/client/outbox";
import { taka, todayISO } from "@/lib/format";
import type { PartnerOption, PondOption } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

/** Fish sale: amount on the keypad; kg, fish, buyer, pond and who got the cash are optional. */
export function SaleForm({
  partners,
  ponds,
  fishSuggestions,
  initial,
}: {
  partners: PartnerOption[];
  ponds: PondOption[];
  fishSuggestions: string[];
  initial?: SaleFormInput;
}) {
  const router = useRouter();
  const editing = initial?.id !== undefined;
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [amountStr, setAmountStr] = useState(initial ? String(initial.amount) : "");
  const [fish, setFish] = useState(initial?.fish ?? "");
  const [kg, setKg] = useState(initial?.weightKg ? String(initial.weightKg) : "");
  const [buyer, setBuyer] = useState(initial?.buyer ?? "");
  const [pondId, setPondId] = useState<number | null>(initial?.pondId ?? null);
  const [receivedBy, setReceivedBy] = useState<number>(initial?.receivedByPartnerId ?? 0);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amount = Number(amountStr || 0);

  function save() {
    if (amount <= 0) return setError("টাকার অঙ্ক দিন।");
    const input: SaleFormInput = {
      id: initial?.id,
      clientId: editing ? null : clientId,
      date,
      amount,
      fish,
      weightKg: kg ? Number(kg) : null,
      buyer,
      pondId,
      receivedByPartnerId: receivedBy || null,
      note,
    };
    startTransition(async () => {
      try {
        const res = await saveSaleAction(input);
        if (!res.ok) return setError(res.error);
        router.push(editing ? "/ledger?type=sale" : "/?saved=1");
        router.refresh();
      } catch (err) {
        if (editing || !isNetworkError(err)) return setError("সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন।");
        queue({ id: clientId, kind: "sale", payload: input, summary: `মাছ বিক্রি ${taka(amount)}`, savedAt: Date.now() });
        setClientId(crypto.randomUUID());
        router.push("/");
      }
    });
  }

  return (
    <div className="space-y-5 p-4 pb-28">
      <section className="space-y-3">
        <div className="flex h-28 flex-col justify-center rounded-2xl bg-primary/5 px-4 text-center">
          <div className={cn("text-4xl font-bold tabular-nums text-primary", !amountStr && "opacity-50")}>{taka(amount)}</div>
          <div className="text-sm text-muted-foreground">বিক্রি করে পাওয়া টাকা</div>
        </div>
        <Keypad value={amountStr} onChange={setAmountStr} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">টাকা কোথায় গেল</h2>
        <ChoiceChips
          value={receivedBy}
          onChange={setReceivedBy}
          options={[{ value: 0, label: "ফান্ডে" }, ...partners.map((p) => ({ value: p.id, label: `${p.name} নিয়েছেন` }))]}
        />
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <h2 className="text-sm text-muted-foreground">মাছ (ইচ্ছা হলে)</h2>
          <Input value={fish} onChange={(e) => setFish(e.target.value)} list="fish-list" placeholder="যেমন: রুই" className="h-12 text-base" />
          <datalist id="fish-list">
            {fishSuggestions.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <h2 className="text-sm text-muted-foreground">ওজন (কেজি)</h2>
          <Input
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            className="h-12 text-base"
          />
        </div>
      </section>

      <PondChips ponds={ponds} value={pondId} onChange={setPondId} />

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">তারিখ</h2>
        <DateField value={date} onChange={setDate} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">ক্রেতা ও নোট (ইচ্ছা হলে)</h2>
        <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="ক্রেতা / আড়ত" className="h-12 text-base" />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট" maxLength={200} className="h-12 text-base" />
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </p>
      )}

      <div
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md">
          <Button type="button" disabled={pending || amount <= 0} onClick={save} className="h-14 w-full text-lg">
            {pending ? "রাখা হচ্ছে…" : editing ? "পরিবর্তন রাখুন" : `সংরক্ষণ${amount ? ` ${taka(amount)}` : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
