import { Suspense } from "react";
import { AutoPrint } from "@/components/auto-print";
import { ReportBody } from "@/components/report-body";
import { getCategories, getLedger, getPartners } from "@/lib/server/queries";

async function Report() {
  const [ledger, categories, partners] = await Promise.all([getLedger(), getCategories(), getPartners()]);
  return (
    <>
      <AutoPrint />
      <h1 className="mb-2 text-2xl font-bold">খরচ ও পার্টনার রিপোর্ট</h1>
      <ReportBody ledger={ledger} categories={categories} partners={partners} />
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
