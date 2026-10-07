"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { DateField } from "@/components/date-field";
import { CategoryIcon } from "@/components/category-icon";
import { PERIODS, categoryQuery, type CategoryParams } from "@/lib/category-view";
import { cn } from "@/lib/utils";

function useNavigate(params: CategoryParams) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const go = (over: Partial<CategoryParams>) =>
    start(() => router.replace(`${pathname}${categoryQuery(params, over)}`, { scroll: false }));
  return { go, pending };
}

/** Sticky period chips (+ custom from–to pickers) and payer filter. */
export function PeriodBar({
  params,
  partners,
}: {
  params: CategoryParams;
  partners: { id: number; name: string }[];
}) {
  const { go, pending } = useNavigate(params);
  const payers = [
    { value: "all", label: "সবাই" },
    { value: "fund", label: "ফান্ড" },
    ...partners.map((p) => ({ value: String(p.id), label: p.name })),
  ];
  return (
    <div className={cn("no-print sticky top-14 z-20 space-y-2 border-b bg-background/95 py-2 backdrop-blur", pending && "opacity-70")}>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => go({ period: p.key })}
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-sm",
              params.period === p.key ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-background",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {params.period === "custom" && (
        <div className="flex flex-wrap items-center gap-2 px-4">
          <DateField value={params.from ?? ""} onChange={(from) => go({ from })} quick={false} />
          <span>থেকে</span>
          <DateField value={params.to ?? ""} onChange={(to) => go({ to })} quick={false} min={params.from} />
        </div>
      )}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4">
        <span className="shrink-0 self-center pr-1 text-sm whitespace-nowrap text-muted-foreground">কে দিল:</span>
        {payers.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => go({ payer: p.value === "all" ? "all" : p.value === "fund" ? "fund" : Number(p.value) })}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3 text-sm",
              String(params.payer) === p.value ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-background",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "খাত বাছুন": multi-select chips; the list and totals then cover only the chosen categories. */
export function CategoryPicker({
  params,
  categories,
}: {
  params: CategoryParams;
  categories: { id: number; name: string; icon: string; color: string }[];
}) {
  const { go } = useNavigate(params);
  const selected = new Set(params.categoryIds);
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    go({ categoryIds: [...next].sort((a, b) => a - b) });
  };
  return (
    <details className="no-print mx-4 rounded-xl border" open={selected.size > 0}>
      <summary className="flex h-12 cursor-pointer items-center justify-between px-3 font-medium">
        খাত বাছুন {selected.size > 0 && `(${selected.size})`}
      </summary>
      <div className="flex flex-wrap gap-2 px-3 pb-3">
        {categories.map((c) => {
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.id)}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-full border pr-3 pl-1 text-sm",
                on ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-background",
              )}
            >
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              {c.name}
              {on && <Check className="size-4" />}
            </button>
          );
        })}
        {selected.size > 0 && (
          <button type="button" onClick={() => go({ categoryIds: [] })} className="h-10 px-3 text-sm text-primary underline">
            সব খাত
          </button>
        )}
      </div>
    </details>
  );
}
