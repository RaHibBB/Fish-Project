import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { describeActivity } from "@/lib/activity";
import { bnDateLong, bnDateTime, todayISO } from "@/lib/format";
import { getActivity, getCategories, getPeople, getPonds } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

const TONE = {
  add: "bg-primary",
  edit: "bg-amber-500",
  void: "bg-destructive",
  other: "bg-muted-foreground",
} as const;

async function Activity() {
  const [rows, people, categories, ponds] = await Promise.all([getActivity(), getPeople(), getCategories(), getPonds()]);
  const lines = describeActivity(rows, {
    people: new Map(people.map((p) => [p.id, p.name])),
    categories: new Map(categories.map((c) => [c.id, c.name])),
    ponds: new Map(ponds.map((p) => [p.id, p.name])),
  });
  if (lines.length === 0) return <p className="p-8 text-center text-muted-foreground">এখনো কোনো পরিবর্তন নেই।</p>;

  // Group by Dhaka calendar day.
  const dayOf = (iso: string) => todayISO(new Date(iso));
  const days: { day: string; items: typeof lines }[] = [];
  for (const l of lines) {
    const d = dayOf(l.at);
    if (days.at(-1)?.day !== d) days.push({ day: d, items: [] });
    days.at(-1)!.items.push(l);
  }

  return (
    <>
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        সবার করা সব পরিবর্তন — কে, কখন, কী। সবুজ = যোগ, হলুদ = বদল, লাল = বাতিল।
      </p>
      {days.map((d) => (
        <section key={d.day}>
          <h2 className="sticky top-14 z-10 bg-muted px-4 py-1.5 text-sm font-medium">{bnDateLong(d.day)}</h2>
          <ul className="divide-y">
            {d.items.map((l) => {
              const body = (
                <>
                  <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", TONE[l.tone])} />
                  <span className="flex-1">
                    <b>{l.who}</b> {l.verb}
                    <span className="block text-sm text-muted-foreground">{l.what}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{bnDateTime(l.at).split(", ")[1]}</span>
                </>
              );
              return (
                <li key={l.id}>
                  {l.href ? (
                    <Link href={l.href} className="flex gap-3 px-4 py-2.5 active:bg-muted">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 px-4 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

export default function ActivityPage() {
  return (
    <>
      <PageHeader title="পরিবর্তন" back="/" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Activity />
      </Suspense>
    </>
  );
}
