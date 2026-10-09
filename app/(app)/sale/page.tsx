import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SaleForm } from "@/components/sale-form";
import { requirePartner } from "@/lib/server/auth";
import { getLedger, getPartners, getPonds } from "@/lib/server/queries";

async function Sale() {
  await requirePartner();
  const [partners, ponds, ledger] = await Promise.all([getPartners(), getPonds(), getLedger()]);
  const fishSuggestions = [...new Set(ledger.sales.map((s) => s.fish).filter(Boolean))].slice(0, 20);
  return <SaleForm partners={partners} ponds={ponds} fishSuggestions={fishSuggestions} />;
}

export default function SalePage() {
  return (
    <>
      <PageHeader title="মাছ বিক্রি" back="/" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Sale />
      </Suspense>
    </>
  );
}
