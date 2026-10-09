"use client";

import { ChoiceChips } from "@/components/choice-chips";
import type { PondOption } from "@/lib/server/queries";

/** Optional pond picker; renders nothing when no ponds are set up. */
export function PondChips({
  ponds,
  value,
  onChange,
}: {
  ponds: PondOption[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const visible = ponds.filter((p) => !p.archived || p.id === value);
  if (visible.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm text-muted-foreground">পুকুর (ইচ্ছা হলে)</h2>
      <ChoiceChips
        value={value ?? 0}
        onChange={(v) => onChange(v === 0 ? null : v)}
        options={[{ value: 0, label: "নির্দিষ্ট না" }, ...visible.map((p) => ({ value: p.id, label: p.name }))]}
      />
    </section>
  );
}
