"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus } from "lucide-react";
import {
  saveCategoryAction,
  savePondAction,
  saveSettingsAction,
  type SimpleResult,
} from "@/app/(app)/settings/actions";
import { CATEGORY_ICONS, CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  function run(fn: () => Promise<SimpleResult>, onOk?: () => void) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg({ ok: true, text: "সংরক্ষিত" });
        onOk?.();
        router.refresh();
      } else setMsg({ ok: false, text: res.error });
    });
  }
  const status = msg && (
    <p role="status" className={cn("text-sm", msg.ok ? "text-primary" : "text-destructive")}>
      {msg.ok && <Check className="mr-1 inline size-4" />}
      {msg.text}
    </p>
  );
  return { pending, run, status };
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function FarmSettingsForm({
  initial,
}: {
  initial: { farmName: string; labourDailyWage: number; startDate: string | null; lowFundAlert: number };
}) {
  const [farmName, setFarmName] = useState(initial.farmName);
  const { pending, run, status } = useSave();
  return (
    <Card title="খামার">
      <div className="space-y-1.5">
        <Label htmlFor="farmName">খামারের নাম</Label>
        <Input id="farmName" value={farmName} onChange={(e) => setFarmName(e.target.value)} className="h-12 text-base" />
      </div>
      {status}
      <Button
        className="h-12 w-full text-base"
        disabled={pending}
        onClick={() => run(() => saveSettingsAction({
              farmName,
              labourDailyWage: initial.labourDailyWage,
              startDate: initial.startDate ?? "",
              lowFundAlert: initial.lowFundAlert,
            }))}
      >
        সংরক্ষণ
      </Button>
    </Card>
  );
}

type CategoryRow = { id: number; name: string; icon: string; color: string; archived: boolean };

function CategoryEditor({ initial, onDone }: { initial: CategoryRow | null; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "ellipsis");
  const [color, setColor] = useState(initial?.color ?? "#6b7280");
  const [archived, setArchived] = useState(initial?.archived ?? false);
  const { pending, run, status } = useSave();
  return (
    <div className="space-y-3 rounded-lg bg-muted/50 p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="খাতের নাম" className="h-11 bg-background text-base" />
      <div className="grid grid-cols-6 gap-2">
        {Object.keys(CATEGORY_ICONS).map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k}
            onClick={() => setIcon(k)}
            className={cn("flex justify-center rounded-lg p-1", icon === k && "ring-2 ring-primary")}
          >
            <CategoryIcon icon={k} color={color} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Label htmlFor={`color-${initial?.id ?? "new"}`}>রং</Label>
        <input
          id={`color-${initial?.id ?? "new"}`}
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-16 rounded border"
        />
        {initial && (
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="size-5" />
            লুকিয়ে রাখুন
          </label>
        )}
      </div>
      {status}
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={onDone}>
          বন্ধ
        </Button>
        <Button
          className="h-11 flex-1"
          disabled={pending || !name.trim()}
          onClick={() => run(() => saveCategoryAction(initial?.id ?? null, { name, icon: icon as "fish", color, archived }), onDone)}
        >
          সংরক্ষণ
        </Button>
      </div>
    </div>
  );
}

export function CategoriesForm({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  return (
    <Card title="খাত">
      <p className="text-xs text-muted-foreground">
        খাত মুছে ফেলা যায় না; দরকার না হলে লুকিয়ে রাখুন — পুরনো এন্ট্রি আগের মতোই থাকবে।
      </p>
      <ul className="space-y-1">
        {categories.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <CategoryEditor initial={c} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={c.id} className={cn("flex items-center gap-3 py-1", c.archived && "opacity-50")}>
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              <span className="flex-1">
                {c.name}
                {c.archived && <span className="ml-2 text-xs">(লুকানো)</span>}
              </span>
              <button
                type="button"
                aria-label={`${c.name} বদলান`}
                onClick={() => setEditing(c.id)}
                className="flex size-10 items-center justify-center rounded-full active:bg-muted"
              >
                <Pencil className="size-4" />
              </button>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <CategoryEditor initial={null} onDone={() => setEditing(null)} />
      ) : (
        <Button variant="outline" className="h-11 w-full" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> নতুন খাত
        </Button>
      )}
    </Card>
  );
}

type PondRow = { id: number; name: string; archived: boolean };

/** Ponds: add, rename, hide. Optional — the app works the same with none. */
export function PondsForm({ ponds }: { ponds: PondRow[] }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [name, setName] = useState("");
  const [archived, setArchived] = useState(false);
  const { pending, run, status } = useSave();
  const open = (p: PondRow | null) => {
    setEditing(p ? p.id : "new");
    setName(p?.name ?? "");
    setArchived(p?.archived ?? false);
  };
  return (
    <Card title="পুকুর">
      <p className="text-xs text-muted-foreground">
        পুকুর যোগ করলে খরচ, বিক্রি আর খাবার লগে পুকুর বাছাই করা যাবে, রিপোর্টে পুকুরভিত্তিক হিসাব আসবে।
      </p>
      <ul className="space-y-1">
        {ponds.map((p) => (
          <li key={p.id} className={cn("flex items-center gap-2 py-1", p.archived && "opacity-50")}>
            <span className="flex-1">
              {p.name}
              {p.archived && <span className="ml-2 text-xs">(লুকানো)</span>}
            </span>
            <button
              type="button"
              aria-label={`${p.name} বদলান`}
              onClick={() => open(p)}
              className="flex size-10 items-center justify-center rounded-full active:bg-muted"
            >
              <Pencil className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {editing !== null ? (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="পুকুরের নাম" className="h-11 bg-background text-base" />
          {editing !== "new" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="size-5" />
              লুকিয়ে রাখুন
            </label>
          )}
          {status}
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setEditing(null)}>
              বন্ধ
            </Button>
            <Button
              className="h-11 flex-1"
              disabled={pending || !name.trim()}
              onClick={() =>
                run(() => savePondAction(editing === "new" ? null : editing, { name, archived }), () => setEditing(null))
              }
            >
              সংরক্ষণ
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="h-11 w-full" onClick={() => open(null)}>
          <Plus className="size-4" /> নতুন পুকুর
        </Button>
      )}
    </Card>
  );
}
