"use client";

import { cn } from "@/lib/utils";

/** Single-choice row of big pill buttons. */
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 rounded-full border px-4 text-base",
            o.value === value ? "border-primary bg-primary text-primary-foreground" : "bg-background",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
