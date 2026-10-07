import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { MoneyForm } from "@/components/money-form";
import { requirePartner } from "@/lib/server/auth";
import { getPartners } from "@/lib/server/queries";

async function Contribute() {
  const partner = await requirePartner();
  const partners = await getPartners();
  return <MoneyForm partners={partners} currentPartnerId={partner.id} />;
}

export default function ContributePage() {
  return (
    <>
      <PageHeader title="টাকা দিন" back="/" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Contribute />
      </Suspense>
    </>
  );
}
