"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDuePaymentAction } from "@/app/(app)/dues/actions";
import { ChoiceChips } from "@/components/choice-chips";
import { DateField } from "@/components/date-field";
import { Keypad } from "@/components/keypad";
import { ReceiptField } from "@/components/receipt-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileToDataUrl, isNetworkError, queue, type ExpensePayload } from "@/lib/client/outbox";
import { taka, todayISO } from "@/lib/format";
import type { PartnerOption } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export type DuePaymentDraft = {
  id: number;
  date: string;
  shop: string;
  amount: number;
  paidByPartnerId: number | null;
  note: string;
  hasReceipt: boolean;
};

/** Pay what is owed to a shop: pick the shop, the amount (or "all"), and who paid. */
export function DuePaymentForm({
  shops,
  partners,
  presetShop,
  initial,
}: {
  /** shops that still have something owed (when editing, the one being edited) */
  shops: { shop: string; due: number }[];
  partners: PartnerOption[];
  presetShop?: string;
  initial?: DuePaymentDraft;
}) {
  const router = useRouter();
  const editing = initial !== undefined;
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [shop, setShop] = useState(initial?.shop ?? presetShop ?? (shops.length === 1 ? shops[0].shop : ""));
  const [amountStr, setAmountStr] = useState(initial ? String(initial.amount) : "");
  const [paidBy, setPaidBy] = useState<string>(initial?.paidByPartnerId ? String(initial.paidByPartnerId) : "fund");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [keepReceipt, setKeepReceipt] = useState(Boolean(initial?.hasReceipt));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amount = Number(amountStr || 0);
  const owed = shops.find((s) => s.shop === shop)?.due ?? 0;

  function save() {
    if (!shop) return setError("কোন দোকানে টাকা দিলেন বাছুন।");
    if (amount <= 0) return setError("টাকার অঙ্ক দিন।");
    if (amount > owed) return setError(`এই দোকানের বাকি ${taka(owed)} — এর বেশি দেওয়া যাবে না।`);
    const fd = new FormData();
    if (editing) fd.set("id", String(initial!.id));
    else fd.set("clientId", clientId);
    fd.set("date", date);
    fd.set("shop", shop);
    fd.set("amount", String(amount));
    fd.set("paidBy", paidBy);
    fd.set("note", note);
    if (receipt) fd.set("receipt", receipt);
    else if (keepReceipt) fd.set("keepReceipt", "1");
    startTransition(async () => {
      try {
        const res = await saveDuePaymentAction(fd);
        if (!res.ok) return setError(res.error);
        router.push(editing ? `/ledger/duepayment/${initial!.id}` : "/dues");
      } catch (err) {
        if (editing || !isNetworkError(err)) return setError("সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন।");
        // No connection: keep it on this phone and send it later.
        const payload: ExpensePayload = {};
        fd.forEach((v, k) => {
          if (typeof v === "string") payload[k] = v;
        });
        if (receipt) payload.receiptDataUrl = await fileToDataUrl(receipt);
        queue({ id: clientId, kind: "due", payload, summary: `${shop} বাকি শোধ ${taka(amount)}`, savedAt: Date.now() });
        setClientId(crypto.randomUUID());
        router.push("/dues");
      }
    });
  }

  return (
    <div className="space-y-5 p-4 pb-28">
      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">কোন দোকান</h2>
        {editing ? (
          <p className="rounded-xl border p-3 text-lg font-semibold">{shop}</p>
        ) : shops.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground">কোনো দোকানের বাকি নেই।</p>
        ) : (
          <ChoiceChips
            value={shop}
            onChange={(v) => {
              setShop(v);
              setError(null);
            }}
            options={shops.map((s) => ({ value: s.shop, label: s.shop }))}
          />
        )}
        {shop && <p className="text-sm">এখন বাকি আছে: <b className="tabular-nums">{taka(owed)}</b></p>}
      </section>

      <section className="space-y-3">
        <div className="rounded-2xl bg-muted/60 p-4 text-center">
          <div className={cn("text-4xl font-bold tabular-nums", !amountStr && "text-muted-foreground")}>{taka(amount)}</div>
          <div className="text-sm text-muted-foreground">এখন যত টাকা দিচ্ছেন</div>
        </div>
        {owed > 0 && (
          <Button type="button" variant="outline" className="h-11 w-full text-base" onClick={() => setAmountStr(String(owed))}>
            পুরো বাকি দিলাম ({taka(owed)})
          </Button>
        )}
        <Keypad value={amountStr} onChange={setAmountStr} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">কে দিল</h2>
        <ChoiceChips
          value={paidBy}
          onChange={setPaidBy}
          options={[{ value: "fund", label: "ফান্ড থেকে" }, ...partners.map((p) => ({ value: String(p.id), label: p.name }))]}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">তারিখ</h2>
        <DateField value={date} onChange={setDate} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">নোট (ইচ্ছা হলে)</h2>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="h-12 text-base" />
      </section>

      <ReceiptField file={receipt} keep={keepReceipt} onFile={setReceipt} onKeep={setKeepReceipt} onError={setError} />

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
          <Button type="button" disabled={pending || amount <= 0 || !shop} onClick={save} className="h-14 w-full text-lg">
            {pending ? "রাখা হচ্ছে…" : editing ? "পরিবর্তন রাখুন" : `বাকি শোধ${amount ? ` ${taka(amount)}` : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
