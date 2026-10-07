import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AutoPrint } from "@/components/auto-print";
import { CategoryDetailBody } from "@/components/category-detail";
import { buildCategoryDetail, parseCategoryParams, payerLabel } from "@/lib/category-view";
import { requirePartner } from "@/lib/server/auth";
import { getCategories, getLedger, getPartners } from "@/lib/server/queries";

async function PrintCategory({
  params,
  searchParams,
}: {
  params: PageProps<"/print/categories/[id]">["params"];
  searchParams: PageProps<"/print/categories/[id]">["searchParams"];
}) {
  await requirePartner();
  const [{ id }, sp, ledger, categories, partners] = await Promise.all([
    params,
    searchParams,
    getLedger(),
    getCategories(),
    getPartners(),
  ]);
  const category = categories.find((c) => c.id === Number(id));
  if (!category) notFound();
  const filters = { ...parseCategoryParams(sp), categoryIds: [] };
  const detail = buildCategoryDetail(ledger.expenses, category.id, filters);
  const payerName = (pid: number | null) => (pid === null ? "ফান্ড" : (partners.find((p) => p.id === pid)?.name ?? "?"));
  return (
    <>
      <AutoPrint />
      <h1 className="text-2xl font-bold">{category.name}</h1>
      <p className="mb-3 text-sm">
        {detail.period.label} · কে দিল: {payerLabel(filters.payer, partners)}
      </p>
      <CategoryDetailBody
        detail={detail}
        isLabour={category.slug === "labour"}
        color={category.color}
        payerName={payerName}
        interactive={false}
      />
    </>
  );
}

export default function PrintCategoryPage(props: PageProps<"/print/categories/[id]">) {
  return (
    <Suspense fallback={<p>…</p>}>
      <PrintCategory params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
