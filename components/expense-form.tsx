"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Minus, Pencil, Plus, Repeat2, X } from "lucide-react";
import { saveExpenseAction } from "@/app/(app)/add/actions";
import { CategoryIcon } from "@/components/category-icon";
import { ChoiceChips } from "@/components/choice-chips";
import { DateField } from "@/components/date-field";
import { Keypad } from "@/components/keypad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/client/compress-image";
import { taka, toBnDigits, todayISO } from "@/lib/format";
import type { CategoryOption, PartnerOption, PondOption } from "@/lib/server/queries";
import { PondChips } from "@/components/pond-chips";
import { fileToDataUrl, isNetworkError, queue, type ExpensePayload } from "@/lib/client/outbox";
import { cn } from "@/lib/utils";

/** Quick chips in display order; label overrides keep chips short. */
const QUICK: { slug: string; label?: string }[] = [
  { slug: "labour", label: "শ্রমিক" },
  { slug: "feed" },
  { slug: "lime_fertilizer" },
  { slug: "medicine" },
  { slug: "equipment", label: "পাইপ/যন্ত্র" },
  { slug: "transport" },
  { slug: "other" },
];

export type ExpenseDraft = {
  id?: number;
  date: string;
  categoryId: number;
  amount: number;
  description: string;
  paidByPartnerId: number | null;
  labourCount: number | null;
  labourRate: number | null;
  hasReceipt?: boolean;
  pondId?: number | null;
};

export function ExpenseForm({
  categories,
  partners,
  wage,
  last,
  initial,
  ponds = [],
}: {
  categories: CategoryOption[];
  partners: PartnerOption[];
  ponds?: PondOption[];
  wage: number;
  last?: ExpenseDraft | null;
  initial?: ExpenseDraft;
}) {
  const router = useRouter();
  const editing = initial?.id !== undefined;
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [amountStr, setAmountStr] = useState(initial && !initial.labourCount ? String(initial.amount) : "");
  const [countStr, setCountStr] = useState(initial?.labourCount ? String(initial.labourCount) : "");
  const [rate, setRate] = useState(initial?.labourRate ?? wage);
  const [editingRate, setEditingRate] = useState(false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [paidBy, setPaidBy] = useState<string>(initial?.paidByPartnerId ? String(initial.paidByPartnerId) : "fund");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [keepReceipt, setKeepReceipt] = useState(Boolean(initial?.hasReceipt));
  const [showAll, setShowAll] = useState(false);
  const [pondId, setPondId] = useState<number | null>(initial?.pondId ?? null);
  // One id per entry being written: a re-send after a dropped connection can't save it twice.
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const selected = categories.find((c) => c.id === categoryId) ?? null;
  const isLabour = selected?.slug === "labour";
  const count = Number(countStr || 0);
  const amount = isLabour ? count * rate : Number(amountStr || 0);
  const quickIds = new Set(QUICK.map((q) => bySlug.get(q.slug)?.id));
  const moreCategories = categories.filter((c) => !quickIds.has(c.id) && (!c.archived || c.id === categoryId));
  const canSave = selected !== null && amount > 0 && !pending;

  function pickCategory(id: number) {
    setCategoryId(id);
    setError(null);
    setFlash(null);
  }

  function repeatLast() {
    if (!last) return;
    setCategoryId(last.categoryId);
    setAmountStr(last.labourCount ? "" : String(last.amount));
    setCountStr(last.labourCount ? String(last.labourCount) : "");
    setRate(last.labourRate ?? wage);
    setDescription(last.description);
    setPaidBy(last.paidByPartnerId ? String(last.paidByPartnerId) : "fund");
    setFlash(null);
    setError(null);
  }

  async function onPickReceipt(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setReceipt(await compressImage(file));
    } catch {
      setError("ছবিটি ছোট করা গেল না, অন্য ছবি দিন।");
    }
  }

  function save(another: boolean) {
    if (!canSave) {
      setError(selected ? "টাকার অঙ্ক দিন।" : "খাত বাছুন।");
      return;
    }
    const fd = new FormData();
    if (editing) fd.set("id", String(initial!.id));
    fd.set("date", date);
    fd.set("categoryId", String(categoryId));
    fd.set("amount", String(amount));
    fd.set("description", description);
    fd.set("paidBy", paidBy);
    if (isLabour) {
      fd.set("labourCount", String(count));
      fd.set("labourRate", String(rate));
    }
    if (pondId) fd.set("pondId", String(pondId));
    if (!editing) fd.set("clientId", clientId);
    if (receipt) fd.set("receipt", receipt);
    else if (keepReceipt) fd.set("keepReceipt", "1");

    const resetForNext = () => {
      setCategoryId(null);
      setAmountStr("");
      setCountStr("");
      setRate(wage);
      setDescription("");
      setReceipt(null);
      setError(null);
      setClientId(crypto.randomUUID());
    };

    startTransition(async () => {
      let res: Awaited<ReturnType<typeof saveExpenseAction>>;
      try {
        res = await saveExpenseAction(fd);
      } catch (err) {
        if (editing || !isNetworkError(err)) {
          setError("সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন।");
          return;
        }
        // No connection: keep it on this phone and send it later.
        const payload: ExpensePayload = {};
        fd.forEach((v, k) => {
          if (typeof v === "string") payload[k] = v;
        });
        if (receipt) payload.receiptDataUrl = await fileToDataUrl(receipt);
        queue({
          id: clientId,
          kind: "expense",
          payload,
          summary: `${selected!.name} ${taka(amount)}`,
          savedAt: Date.now(),
        });
        if (another) {
          setFlash(`নেট নেই — ফোনে রাখা হলো: ${selected!.name} ${taka(amount)}`);
          resetForNext();
        } else router.push("/");
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (another) {
        // Stay on the form with the same date and payer.
        setFlash(`সংরক্ষিত: ${selected!.name} ${taka(amount)}`);
        resetForNext();
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
      } else {
        router.push(editing ? `/ledger?saved=${res.id}` : "/?saved=1");
        router.refresh();
      }
    });
  }

  const chipClass = (active: boolean) =>
    cn(
      "flex h-12 items-center gap-1.5 rounded-full border pr-4 pl-1.5 text-base",
      active ? "border-primary bg-primary/10 font-semibold text-primary ring-2 ring-primary" : "bg-background",
    );

  const tileClass = (active: boolean) =>
    cn(
      "flex min-h-18 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-sm leading-tight",
      active ? "border-primary bg-primary/10 font-semibold text-primary ring-2 ring-primary" : "bg-background",
    );

  return (
    <div className="space-y-5 p-4 pb-28">
      {flash && (
        <p className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-primary" role="status">
          <Check className="size-5" /> {flash}
        </p>
      )}

      {!editing && last && (
        <button
          type="button"
          onClick={repeatLast}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed p-3 text-left text-sm active:bg-muted"
        >
          <Repeat2 className="size-5 text-primary" />
          <span className="flex-1">
            আগেরটা আবার: {categories.find((c) => c.id === last.categoryId)?.name}
            {last.labourCount ? ` ${toBnDigits(last.labourCount)} জন` : ""} · {taka(last.amount)}
          </span>
        </button>
      )}

      {/* Category chips */}
      <section className="space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((q) => {
            const c = bySlug.get(q.slug);
            if (!c || (c.archived && c.id !== categoryId)) return null;
            return (
              <button key={c.id} type="button" onClick={() => pickCategory(c.id)} className={tileClass(c.id === categoryId)}>
                <CategoryIcon icon={c.icon} color={c.color} size="md" />
                <span className="w-full truncate">{q.label ?? c.name}</span>
              </button>
            );
          })}
          {moreCategories.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className={tileClass(moreCategories.some((c) => c.id === categoryId) && !showAll)}
            >
              <span className="flex size-9 items-center justify-center text-xl">{showAll ? "−" : "…"}</span>
              <span>{showAll ? "কম" : "আরও"}</span>
            </button>
          )}
        </div>
        {showAll && (
          <div className="flex flex-wrap gap-2">
            {moreCategories.map((c) => (
              <button key={c.id} type="button" onClick={() => pickCategory(c.id)} className={chipClass(c.id === categoryId)}>
                <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Amount / labour count */}
      <section className="space-y-3">
        {isLabour ? (
          <div className="flex h-32 flex-col justify-center rounded-2xl bg-muted/60 px-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="এক জন কম"
                onClick={() => setCountStr(String(Math.max(0, count - 1) || ""))}
                className="flex size-14 items-center justify-center rounded-full bg-background shadow-sm active:scale-95"
              >
                <Minus className="size-7" />
              </button>
              <div className="text-center">
                <div className="text-4xl leading-tight font-bold tabular-nums">{toBnDigits(count)}</div>
                <div className="text-sm text-muted-foreground">জন শ্রমিক</div>
              </div>
              <button
                type="button"
                aria-label="এক জন বেশি"
                onClick={() => setCountStr(String(count + 1))}
                className="flex size-14 items-center justify-center rounded-full bg-background shadow-sm active:scale-95"
              >
                <Plus className="size-7" />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-lg">
              {editingRate ? (
                <Input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  defaultValue={rate}
                  onBlur={(e) => {
                    const v = Math.round(Number(e.target.value));
                    if (v > 0) setRate(v);
                    setEditingRate(false);
                  }}
                  className="h-10 w-28 text-center text-lg"
                  aria-label="দৈনিক মজুরি"
                />
              ) : (
                <button type="button" onClick={() => setEditingRate(true)} className="flex items-center gap-1 underline-offset-4 hover:underline">
                  {toBnDigits(count)} × {taka(rate)} <Pencil className="size-3.5 text-muted-foreground" />
                </button>
              )}
              <span>=</span>
              <span className="text-2xl font-bold">{taka(amount)}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-32 flex-col justify-center rounded-2xl bg-muted/60 px-4 text-center">
            <div className={cn("text-4xl font-bold tabular-nums", !amountStr && "text-muted-foreground")}>
              {taka(amount)}
            </div>
            <div className="text-sm text-muted-foreground">{selected ? selected.name : "খাত বাছুন, তারপর টাকা"}</div>
          </div>
        )}
        <Keypad value={isLabour ? countStr : amountStr} onChange={isLabour ? setCountStr : setAmountStr} maxLength={isLabour ? 3 : 8} />
      </section>

      {/* Who paid */}
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

      <PondChips ponds={ponds} value={pondId} onChange={setPondId} />

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground">নোট (ইচ্ছা হলে)</h2>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="যেমন: খাবারের ২ বস্তা"
          className="h-12 text-base"
        />
      </section>

      <section className="space-y-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPickReceipt(e.target.files?.[0])}
        />
        {receipt || keepReceipt ? (
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <Camera className="size-5 text-primary" />
            <span className="flex-1 text-sm">
              {receipt ? `রসিদের ছবি (${toBnDigits(Math.round(receipt.size / 1024))} KB)` : "রসিদের ছবি আছে"}
            </span>
            <button
              type="button"
              aria-label="ছবি সরান"
              onClick={() => {
                setReceipt(null);
                setKeepReceipt(false);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="flex size-9 items-center justify-center rounded-full active:bg-muted"
            >
              <X className="size-5" />
            </button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={() => fileRef.current?.click()}>
            <Camera className="size-5" /> রসিদের ছবি (ইচ্ছা হলে)
          </Button>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </p>
      )}

      {/* Sticky save bar above the bottom nav */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-md gap-2">
          {!editing && (
            <Button type="button" variant="outline" disabled={!canSave} onClick={() => save(true)} className="h-14 flex-1 text-base">
              সংরক্ষণ + আরেকটা
            </Button>
          )}
          <Button type="button" disabled={!canSave} onClick={() => save(false)} className="h-14 flex-1 text-lg">
            {pending ? "রাখা হচ্ছে…" : editing ? "পরিবর্তন রাখুন" : `সংরক্ষণ${amount ? ` ${taka(amount)}` : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
