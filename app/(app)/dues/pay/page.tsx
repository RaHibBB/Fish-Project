import { Suspense } from "react";
import { DuePaymentForm } from "@/components/due-payment-form";
import { PageHeader } from "@/components/page-header";
import { duesByShop } from "@/lib/dues";
import { requirePartner } from "@/lib/server/auth";
import { getLedger, getPartners } from "@/lib/server/queries";

async function Pay({ searchParams }: { searchParams: PageProps<"/dues/pay">["searchParams"] }) {
  await requirePartner();
  const [sp, ledger, partners] = await Promise.all([searchParams, getLedger(), getPartners()]);
  const shops = duesByShop(ledger.expenses, ledger.duePayments)
    .filter((s) => s.due > 0)
    .map(({ shop, due }) => ({ shop, due }));
  const wanted = Array.isArray(sp.shop) ? sp.shop[0] : sp.shop;
  const presetShop = shops.find((s) => s.shop === wanted)?.shop;
  return <DuePaymentForm shops={shops} partners={partners} presetShop={presetShop} />;
}

export default function PayDuePage(props: PageProps<"/dues/pay">) {
  return (
    <>
      <PageHeader title="বাকি শোধ" back="/dues" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Pay searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
