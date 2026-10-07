"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { addDays, bnDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Date chosen only from the native date picker (never typed), shown as dd/mm/yyyy in
 * Bengali digits, with one-tap আজ / গতকাল.
 */
export function DateField({
  value,
  onChange,
  max = todayISO(),
  min,
  quick = true,
  label,
}: {
  value: string;
  onChange: (iso: string) => void;
  max?: string;
  min?: string;
  quick?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const today = todayISO();
  const yesterday = addDays(today, -1);

  function open() {
    const el = ref.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  const chip = (iso: string, text: string) => (
    <button
      type="button"
      onClick={() => onChange(iso)}
      className={cn(
        "h-11 rounded-full border px-4 text-sm",
        value === iso ? "border-primary bg-primary text-primary-foreground" : "bg-background",
      )}
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="w-full text-sm text-muted-foreground">{label}</span>}
      {quick && chip(today, "আজ")}
      {quick && chip(yesterday, "গতকাল")}
      <button
        type="button"
        onClick={open}
        className="relative flex h-11 items-center gap-2 rounded-full border bg-background px-4 text-base font-medium"
      >
        <CalendarDays className="size-5 text-muted-foreground" />
        {value ? bnDate(value) : "তারিখ বাছুন"}
        <input
          ref={ref}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={value}
          max={max}
          min={min}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onKeyDown={(e) => e.preventDefault()}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </button>
    </div>
  );
}
