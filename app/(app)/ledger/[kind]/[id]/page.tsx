import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LogIn, Pencil } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { VoidPanel } from "@/components/void-panel";
import { bnDate, bnDateLong, bnDateTime, taka, toBnDigits } from "@/lib/format";
import type { EntryKind } from "@/lib/ledger";
import { getCategory, getContribution, getExpense, getWithdrawal, getEntryHistory, isEntryKind } from "@/lib/server/entry";
import { getCurrentPartner } from "@/lib/server/auth";
import { getCategories, getPartners } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

const METHOD: Record<string, string> = { cash: "নগদ", bkash: "বিকাশ", bank: "ব্যাংক" };
const ACTION: Record<string, string> = {
  create: "লিখেছেন",
  update: "বদলেছেন",
  void: "বাতিল করেছেন",
  import: "পুরনো শিট থেকে আনা হয়েছে",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

async function Detail({ params }: { params: PageProps<"/ledger/[kind]/[id]">["params"] }) {
  const { kind: k, id: rawId } = await params;
  const id = Number(rawId);
  if (!isEntryKind(k) || !Number.isInteger(id)) notFound();
  const kind: EntryKind = k;

  const [me, partners, categories, history] = await Promise.all([
    getCurrentPartner(),
    getPartners(),
    getCategories(),
    getEntryHistory(kind, id),
  ]);
  const name = (pid: number | null | undefined) =>
    pid == null ? "ফান্ড" : (partners.find((p) => p.id === pid)?.name ?? "?");

  let title: ReactNode;
  let body: ReactNode;
  let voided: { reason: string | null; by: number | null; at: Date | null } | null = null;

  if (kind === "expense") {
    const e = await getExpense(id);
    if (!e) notFound();
    const cat = await getCategory(e.categoryId);
    if (e.voidedAt) voided = { reason: e.voidReason, by: e.voidedBy, at: e.voidedAt };
    title = (
      <div className="flex items-center gap-3">
        {cat && <CategoryIcon icon={cat.icon} color={cat.color} size="lg" />}
        <div>
          <div className="text-lg font-semibold">{cat?.name}</div>
          <div className={cn("text-3xl font-bold", e.voidedAt && "line-through")}>{taka(e.amount)}</div>
        </div>
      </div>
    );
    body = (
      <>
        <Row label="তারিখ">{bnDateLong(e.date)}</Row>
        {e.labourCount && e.labourRate && (
          <Row label="শ্রমিক">
            {toBnDigits(e.labourCount)} জন × {taka(e.labourRate)}
          </Row>
        )}
        <Row label="কে দিল">{e.paidByPartnerId === null ? "ফান্ড থেকে" : `${name(e.paidByPartnerId)} (নিজে)`}</Row>
        {e.description && <Row label="নোট">{e.description}</Row>}
        {e.receiptUrl && (
          <div className="py-2.5">
            <dt className="mb-2 text-muted-foreground">রসিদ</dt>
            <a href={`/receipts/${e.id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/receipts/${e.id}`} alt="রসিদের ছবি" className="max-h-72 rounded-lg border" />
            </a>
          </div>
        )}
      </>
    );
  } else {
    const c = kind === "contribution" ? await getContribution(id) : null;
    const m = kind === "contribution" ? c : await getWithdrawal(id);
    if (!m) notFound();
    if (m.voidedAt) voided = { reason: m.voidReason, by: m.voidedBy, at: m.voidedAt };
    title = (
      <div>
        <div className="text-lg font-semibold">{kind === "contribution" ? "ফান্ডে জমা" : "ফান্ড থেকে ফেরত"}</div>
        <div className={cn("text-3xl font-bold", m.voidedAt && "line-through")}>{taka(m.amount)}</div>
      </div>
    );
    body = (
      <>
        <Row label="তারিখ">{bnDateLong(m.date)}</Row>
        <Row label="পার্টনার">{name(m.partnerId)}</Row>
        {c && <Row label="কীভাবে">{METHOD[c.method]}</Row>}
        {m.note && <Row label="নোট">{m.note}</Row>}
      </>
    );
  }

  const fmt = (key: string, v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    switch (key) {
      case "amount":
      case "labourRate":
        return taka(Number(v));
      case "date":
        return bnDate(String(v));
      case "categoryId":
        return categories.find((c) => c.id === v)?.name ?? "?";
      case "paidByPartnerId":
      case "partnerId":
        return name(v as number);
      case "labourCount":
        return `${toBnDigits(Number(v))} জন`;
      case "method":
        return METHOD[String(v)] ?? String(v);
      case "receiptUrl":
        return "ছবি";
      default:
        return String(v);
    }
  };
  const LABELS: Record<string, string> = {
    date: "তারিখ",
    categoryId: "খাত",
    amount: "টাকা",
    description: "নোট",
    note: "নোট",
    paidByPartnerId: "কে দিল",
    partnerId: "পার্টনার",
    labourCount: "শ্রমিক",
    labourRate: "মজুরি",
    method: "কীভাবে",
    receiptUrl: "রসিদ",
  };

  return (
    <div className="space-y-4 p-4">
      {title}
      {voided && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="mr-2 rounded bg-destructive px-1.5 py-0.5 text-xs font-semibold text-white">বাতিল</span>
          {name(voided.by)} · {voided.at && bnDateTime(voided.at)}
          <p className="mt-1">কারণ: {voided.reason}</p>
        </div>
      )}
      <dl className="divide-y rounded-xl border px-3">{body}</dl>

      {!voided && !me && (
        <Link
          href={`/login?next=${encodeURIComponent(`/ledger/${kind}/${id}`)}`}
          className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full text-base")}
        >
          <LogIn className="size-5" /> সম্পাদনা বা বাতিল করতে লগ ইন করুন
        </Link>
      )}
      {!voided && me && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/ledger/${kind}/${id}/edit`} className={cn(buttonVariants({ variant: "outline" }), "h-12 flex-1 text-base")}>
            <Pencil className="size-5" /> সম্পাদনা
          </Link>
          <VoidPanel kind={kind} id={id} />
        </div>
      )}

      <section>
        <h2 className="mb-2 font-semibold">ইতিহাস</h2>
        <ol className="space-y-2 text-sm">
          {history.map((h) => {
            const before = (h.before ?? {}) as Record<string, unknown>;
            const after = (h.after ?? {}) as Record<string, unknown>;
            const changes =
              h.action === "update"
                ? Object.keys(LABELS).filter((k) => k in after && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
                : [];
            return (
              <li key={h.id} className="rounded-lg bg-muted/60 p-2.5">
                <div>
                  <span className="font-medium">{h.actorId ? name(h.actorId) : "ইমপোর্ট"}</span>{" "}
                  {ACTION[h.action] ?? h.action} · {bnDateTime(h.createdAt)}
                </div>
                {changes.map((k) => (
                  <div key={k} className="text-muted-foreground">
                    {LABELS[k]}: {fmt(k, before[k])} → {fmt(k, after[k])}
                  </div>
                ))}
                {h.action === "void" && <div className="text-muted-foreground">কারণ: {String(after.voidReason ?? "")}</div>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export default function EntryPage(props: PageProps<"/ledger/[kind]/[id]">) {
  return (
    <>
      <PageHeader title="এন্ট্রি" back="/ledger" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Detail params={props.params} />
      </Suspense>
    </>
  );
}
