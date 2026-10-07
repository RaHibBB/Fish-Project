"use client";

import { Delete } from "lucide-react";
import { toBnDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"] as const;

/** Big on-screen number pad (Bengali digits) so amounts never need the phone keyboard. */
export function Keypad({
  value,
  onChange,
  maxLength = 8,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  className?: string;
}) {
  function press(key: (typeof KEYS)[number]) {
    if (key === "del") return onChange(value.slice(0, -1));
    const next = (value + key).replace(/^0+/, "");
    if (next.length <= maxLength) onChange(next);
  }
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          onContextMenu={key === "del" ? (e) => (e.preventDefault(), onChange("")) : undefined}
          aria-label={key === "del" ? "মুছুন" : key}
          className={cn(
            "flex h-14 items-center justify-center rounded-xl bg-muted text-2xl font-semibold select-none active:scale-95 active:bg-muted-foreground/20",
            key === "del" && "text-muted-foreground",
          )}
        >
          {key === "del" ? <Delete className="size-7" /> : toBnDigits(key)}
        </button>
      ))}
    </div>
  );
}
