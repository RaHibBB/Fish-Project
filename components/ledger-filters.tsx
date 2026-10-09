"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { DateField } from "@/components/date-field";
import { Input } from "@/components/ui/input";
import { bnMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 min-w-0 shrink-0 rounded-full border bg-background px-3 text-sm",
        value && "border-primary bg-primary/10 font-medium text-primary",
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Filter bar for হিসাব; state lives in the URL so links and back/forward work. */
export function LedgerFilters({
  months,
  categories,
  partners,
  ponds = [],
}: {
  months: string[];
  categories: { id: number; name: string }[];
  partners: { id: number; name: string }[];
  ponds?: { id: number; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  const [range, setRange] = useState(Boolean(params.get("from") || params.get("to")));

  function setMany(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }
  const set = (key: string, value: string) => setMany({ [key]: value });

  function pickMonth(v: string) {
    if (v === "range") {
      setRange(true);
      setMany({ month: "" });
    } else {
      setRange(false);
      setMany({ month: v, from: "", to: "" });
    }
  }

  // Debounce the search box.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => set("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="no-print sticky top-14 z-20 space-y-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="খুঁজুন: নোট, খাত, টাকা…"
          className="h-10 rounded-full pl-9 text-base"
          type="search"
        />
        {q && (
          <button
            type="button"
            aria-label="মুছুন"
            onClick={() => setQ("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Select
          label="মাস"
          value={range ? "range" : (params.get("month") ?? "")}
          onChange={pickMonth}
          options={[
            { value: "", label: "সব মাস" },
            ...months.map((m) => ({ value: m, label: bnMonth(m) })),
            { value: "range", label: "তারিখ থেকে তারিখ…" },
          ]}
        />
        <Select
          label="ধরন"
          value={params.get("type") ?? ""}
          onChange={(v) => set("type", v)}
          options={[
            { value: "", label: "সব এন্ট্রি" },
            { value: "expense", label: "শুধু খরচ" },
            { value: "money", label: "জমা/ফেরত" },
            { value: "sale", label: "মাছ বিক্রি" },
            { value: "receipt", label: "রসিদের ছবি" },
          ]}
        />
        {ponds.length > 0 && (
          <Select
            label="পুকুর"
            value={params.get("pond") ?? ""}
            onChange={(v) => set("pond", v)}
            options={[{ value: "", label: "সব পুকুর" }, ...ponds.map((p) => ({ value: String(p.id), label: p.name }))]}
          />
        )}
        <Select
          label="খাত"
          value={params.get("cat") ?? ""}
          onChange={(v) => set("cat", v)}
          options={[{ value: "", label: "সব খাত" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
        />
        <Select
          label="কে দিল"
          value={params.get("payer") ?? ""}
          onChange={(v) => set("payer", v)}
          options={[
            { value: "", label: "সবাই" },
            { value: "fund", label: "ফান্ড" },
            ...partners.map((p) => ({ value: String(p.id), label: p.name })),
          ]}
        />
      </div>
      {range && (
        <div className="flex flex-wrap items-center gap-2">
          <DateField value={params.get("from") ?? ""} onChange={(v) => set("from", v)} quick={false} />
          <span className="text-sm">থেকে</span>
          <DateField value={params.get("to") ?? ""} onChange={(v) => set("to", v)} quick={false} min={params.get("from") ?? undefined} />
        </div>
      )}
    </div>
  );
}
