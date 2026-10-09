import { Suspense } from "react";
import { connection } from "next/server";
import { FileDown } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";
import { PageHeader } from "@/components/page-header";
import { ReportBody } from "@/components/report-body";
import { getCategories, getLedger, getPartners, getPonds } from "@/lib/server/queries";

const CSVS = [
  { href: "/export/expenses", label: "সব খরচ" },
  { href: "/export/money", label: "জমা ও ফেরত" },
  { href: "/export/sales", label: "মাছ বিক্রি" },
  { href: "/export/monthly", label: "মাসিক মোট" },
  { href: "/export/categories", label: "খাত অনুযায়ী" },
  { href: "/export/partners", label: "পার্টনার ও সেটেলমেন্ট" },
];

async function Reports() {
  await connection(); // "this month" comparisons depend on today, so render per request (data itself is cached)
  const [ledger, categories, partners, ponds] = await Promise.all([getLedger(), getCategories(), getPartners(), getPonds()]);
  return (
    <div className="space-y-4 p-4">
      <ExportButtons pdf="/print/report" csv="/export/expenses" csvLabel="Excel/CSV" />
      <details className="no-print rounded-xl border">
        <summary className="flex h-11 cursor-pointer items-center px-3 text-sm">আরও CSV ফাইল…</summary>
        <ul className="divide-y border-t">
          {CSVS.map((c) => (
            <li key={c.href}>
              <a href={c.href} download className="flex h-11 items-center gap-2 px-3 text-sm active:bg-muted">
                <FileDown className="size-4 text-primary" /> {c.label}
              </a>
            </li>
          ))}
        </ul>
      </details>
      <ReportBody ledger={ledger} categories={categories} partners={partners} ponds={ponds} hrefForCategory={(id) => `/categories/${id}`} />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="রিপোর্ট" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Reports />
      </Suspense>
    </>
  );
}
