"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMoneyAction, type MoneyInput } from "@/app/(app)/contribute/actions";
import { isNetworkError, queue } from "@/lib/client/outbox";
import { ChoiceChips } from "@/components/choice-chips";
import { DateField } from "@/components/date-field";
import { Keypad } from "@/components/keypad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContributionMethod } from "@/lib/db/schema";
import { taka, todayISO } from "@/lib/format";
import type { PartnerOption } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const METHOD_LABELS: Record<ContributionMethod, string> = { cash: "নগদ", bkash: "বিকাশ", bank: "ব্যাংক" };

export function MoneyForm({
  partners,
  currentPartnerId,
  initial,
}: {
  partners: PartnerOption[];
  currentPartnerId: number;
  initial?: MoneyInput;
}) {
  const router = useRouter();
  const editing = initial?.id !== undefined;
  const [kind, setKind] = useState<MoneyInput["kind"]>(initial?.kind ?? "contribution");
  const [partnerId, setPartnerId] = useState(initial?.partnerId ?? currentPartnerId);
  const [amountStr, setAmountStr] = useState(initial ? String(initial.amount) : "");
  const [method, setMethod] = useState<ContributionMethod>(initial?.method ?? "cash");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [clientId] = useState(() => crypto.randomUUID());
  const amount = Number(amountStr || 0);
  const isWithdrawal = kind === "withdrawal";

  function save() {
    if (amount <= 0) return setError("টাকার অঙ্ক দিন।");
    const input: MoneyInput = {
      id: initial?.id,
      clientId: editing ? null : clientId,
      kind,
      date,
      partnerId,
      amount,
      method,
      note,
    };
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof saveMoneyAction>>;
      try {
        res = await saveMoneyAction(input);
      } catch (err) {
        if (editing || !isNetworkError(err)) return setError("সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন।");
        const who = partners.find((p) => p.id === partnerId)?.name ?? "";
        queue({
          id: clientId,
          kind: "money",
          payload: input,
          summary: `${who} ${isWithdrawal ? "ফেরত" : "জমা"} ${taka(amount)}`,
          savedAt: Date.now(),
        });
        router.push("/");
        return;
      }
      if (!res.ok) return setError(res.error);
      router.push(editing ? "/ledger" : "/?saved=1");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 p-4 pb-28">
      {!editing && (
        <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
          {(["contribution", "withdrawal"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn("h-11 rounded-lg text-base", kind === k && "bg-background font-semibold shadow-sm")}
            >
              {k === "contribution" ? "ফান্ডে টাকা দিন" : "ফান্ড থেকে ফেরত"}
            </button>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">{isWithdrawal ? "কে ফেরত নিলেন" : "কে দিলেন"}</h2>
        <ChoiceChips value={partnerId} onChange={setPartnerId} options={partners.map((p) => ({ value: p.id, label: p.name }))} />
      </section>

      <section className="space-y-3">
        <div className="rounded-2xl bg-muted/60 p-4 text-center">
          <div className={cn("text-4xl font-bold tabular-nums", !amountStr && "text-muted-foreground")}>{taka(amount)}</div>
          <div className="text-sm text-muted-foreground">{isWithdrawal ? "ফান্ড থেকে ফেরত" : "ফান্ডে জমা"}</div>
        </div>
        <Keypad value={amountStr} onChange={setAmountStr} />
      </section>

      {!isWithdrawal && (
        <section className="space-y-2">
          <h2 className="text-sm text-muted-foreground">কীভাবে</h2>
          <ChoiceChips
            value={method}
            onChange={setMethod}
            options={(Object.keys(METHOD_LABELS) as ContributionMethod[]).map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">তারিখ</h2>
        <DateField value={date} onChange={setDate} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">নোট (ইচ্ছা হলে)</h2>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="h-12 text-base" />
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </p>
      )}

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-md">
          <Button type="button" disabled={pending || amount <= 0} onClick={save} className="h-14 w-full text-lg">
            {pending ? "রাখা হচ্ছে…" : editing ? "পরিবর্তন রাখুন" : `সংরক্ষণ${amount ? ` ${taka(amount)}` : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
