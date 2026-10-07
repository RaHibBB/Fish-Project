import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Paperclip } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { bnDate, taka, toBnDigits } from "@/lib/format";
import type { LedgerEntry } from "@/lib/ledger";
import { cn } from "@/lib/utils";

/** One tappable line in the ledger / recent list. Voided rows stay visible, struck through. */
export function EntryRow({ entry, showDate = false }: { entry: LedgerEntry; showDate?: boolean }) {
  const isMoney = entry.kind !== "expense";
  return (
    <Link
      href={`/ledger/${entry.kind}/${entry.id}`}
      className={cn("flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-muted", entry.voided && "opacity-60")}
    >
      {entry.icon && entry.color ? (
        <CategoryIcon icon={entry.icon} color={entry.color} />
      ) : (
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            entry.kind === "contribution" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600",
          )}
        >
          {entry.kind === "contribution" ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate font-medium", entry.voided && "line-through")}>{entry.title}</span>
          {entry.labourCount ? (
            <span className="shrink-0 text-sm text-muted-foreground">· {toBnDigits(entry.labourCount)} জন</span>
          ) : null}
          {entry.hasReceipt && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="রসিদ আছে" />}
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {showDate && `${bnDate(entry.date)} · `}
          {entry.payerLabel}
          {entry.note && ` · ${entry.note}`}
        </div>
      </div>
      <div className="text-right">
        <div
          className={cn(
            "font-semibold tabular-nums",
            entry.voided && "line-through",
            entry.kind === "contribution" && "text-primary",
          )}
        >
          {isMoney && entry.kind === "contribution" ? "+" : ""}
          {taka(entry.amount)}
        </div>
        {entry.voided && (
          <span className="rounded bg-destructive/10 px-1.5 text-xs font-semibold text-destructive">বাতিল</span>
        )}
      </div>
    </Link>
  );
}
