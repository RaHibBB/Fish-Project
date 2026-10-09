import { Suspense } from "react";
import { connection } from "next/server";
import { AutoPrint } from "@/components/auto-print";
import { ReportBody } from "@/components/report-body";
import { getCategories, getLedger, getPartners, getPonds } from "@/lib/server/queries";

async function Report() {
  await connection(); // "this month" comparisons depend on today, so render per request (data itself is cached)
  const [ledger, categories, partners, ponds] = await Promise.all([getLedger(), getCategories(), getPartners(), getPonds()]);
  return (
    <>
      <AutoPrint />
      <h1 className="mb-2 text-2xl font-bold">খরচ ও পার্টনার রিপোর্ট</h1>
      <ReportBody ledger={ledger} categories={categories} partners={partners} ponds={ponds} />
    </>
  );
}

export default function PrintReportPage() {
  return (
    <Suspense fallback={<p>…</p>}>
      <Report />
    </Suspense>
  );
}
