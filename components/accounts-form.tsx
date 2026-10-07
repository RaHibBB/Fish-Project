"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { addAdminAction, resetPinAction, saveAccountAction, type PinResult } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toBnDigits } from "@/lib/format";

type Person = { id: number; name: string; phone: string; isPartner: boolean };

/** Shows a new temporary PIN once, with who it belongs to. */
function PinNotice({ result, onClose }: { result: Extract<PinResult, { ok: true }>; onClose: () => void }) {
  return (
    <div role="status" className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
      <p>
        <b>{result.name}</b> ({result.phone}) এর অস্থায়ী পিন:
      </p>
      <p className="text-center font-mono text-3xl font-bold tracking-[0.3em]">{toBnDigits(result.pin)}</p>
      <p className="text-muted-foreground">
        এটা শুধু এখনই দেখা যাবে। তাঁকে আলাদাভাবে দিন — প্রথমবার ঢুকে তিনি নিজের পিন ঠিক করবেন।
      </p>
      <Button variant="outline" className="h-10 w-full" onClick={onClose}>
        লিখে রেখেছি, বন্ধ করুন
      </Button>
    </div>
  );
}

function AccountRow({
  person,
  isMe,
  onPin,
}: {
  person: Person;
  isMe: boolean;
  onPin: (r: PinResult) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [phone, setPhone] = useState(person.phone);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <li className="space-y-2 rounded-lg bg-muted/50 p-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="নাম" className="h-11 bg-background text-base" />
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          aria-label="ফোন"
          className="h-11 bg-background text-base"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 flex-1" onClick={() => setEditing(false)}>
            বন্ধ
          </Button>
          <Button
            className="h-10 flex-1"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveAccountAction(person.id, { name, phone });
                if (!r.ok) return setError(r.error);
                setEditing(false);
                router.refresh();
              })
            }
          >
            সংরক্ষণ
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {person.name}
          <span className="ml-2 rounded bg-muted px-1.5 text-xs font-normal">{person.isPartner ? "অ্যাডমিন · পার্টনার" : "অ্যাডমিন"}</span>
          {isMe && <span className="ml-1 text-xs text-primary">(আপনি)</span>}
        </div>
        <div className="text-sm text-muted-foreground">{person.phone}</div>
      </div>
      <button
        type="button"
        aria-label={`${person.name} এর নাম/ফোন বদলান`}
        onClick={() => setEditing(true)}
        className="flex size-10 items-center justify-center rounded-full active:bg-muted"
      >
        <Pencil className="size-4" />
      </button>
      {!isMe && (
        <Button
          variant="outline"
          className="h-10"
          disabled={pending}
          onClick={() => {
            if (!confirm(`${person.name} এর জন্য নতুন অস্থায়ী পিন বানাবেন? পুরনো পিন আর কাজ করবে না।`)) return;
            start(async () => onPin(await resetPinAction(person.id)));
          }}
        >
          <KeyRound className="size-4" /> পিন রিসেট
        </Button>
      )}
    </li>
  );
}

/** Everyone who can log in: partners and login-only admins. */
export function AccountsForm({ people, meId }: { people: Person[]; meId: number }) {
  const router = useRouter();
  const [result, setResult] = useState<PinResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, start] = useTransition();

  const onPin = (r: PinResult) => {
    setResult(r);
    if (r.ok) router.refresh();
  };

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">অ্যাকাউন্ট (যারা লগ ইন করতে পারেন)</h2>
      <p className="text-xs text-muted-foreground">
        সবাই অ্যাডমিন — সবার সমান অধিকার: প্রতিদিনের খরচ ও জমা লেখা, সম্পাদনা, বাতিল, সেটিংস ও অ্যাকাউন্ট। শুধু "পার্টনার"দের টাকার ভাগ আছে; যারা শুধু "অ্যাডমিন" তাঁরা ভাগের হিসাবে আসেন না।
        বিদেশি নম্বর +কোড সহ লিখুন (যেমন +971…)।
      </p>
      {result?.ok && <PinNotice result={result} onClose={() => setResult(null)} />}
      {result && !result.ok && <p className="text-sm text-destructive">{result.error}</p>}
      <ul className="divide-y">
        {people.map((p) => (
          <AccountRow key={p.id} person={p} isMe={p.id === meId} onPin={onPin} />
        ))}
      </ul>
      {adding ? (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম" className="h-11 bg-background text-base" />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            placeholder="ফোন: 01XXXXXXXXX বা +971…"
            className="h-11 bg-background text-base"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 flex-1" onClick={() => setAdding(false)}>
              বন্ধ
            </Button>
            <Button
              className="h-10 flex-1"
              disabled={pending || !name.trim() || !phone.trim()}
              onClick={() =>
                start(async () => {
                  const r = await addAdminAction({ name, phone });
                  onPin(r);
                  if (r.ok) {
                    setAdding(false);
                    setName("");
                    setPhone("");
                  }
                })
              }
            >
              যোগ করুন
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="h-11 w-full" onClick={() => setAdding(true)}>
          <UserPlus className="size-4" /> নতুন অ্যাডমিন
        </Button>
      )}
    </section>
  );
}
