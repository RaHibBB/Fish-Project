import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PeriodBar } from "@/components/category-filters";
import { CategoryDetailBody } from "@/components/category-detail";
import { CategoryIcon } from "@/components/category-icon";
import { ExportButtons } from "@/components/export-buttons";
import { PageHeader } from "@/components/page-header";
import { buildCategoryDetail, categoryQuery, parseCategoryParams, payerLabel } from "@/lib/category-view";
import { getCategories, getLedger, getPartners } from "@/lib/server/queries";

async function Detail({
  params,
  searchParams,
}: {
  params: PageProps<"/categories/[id]">["params"];
  searchParams: PageProps<"/categories/[id]">["searchParams"];
}) {
  await connection(); // uses today's date — render per request (the data itself is cached)
  const [{ id: rawId }, sp, ledger, categories, partners] = await Promise.all([
    params,
    searchParams,
    getLedger(),
    getCategories(),
    getPartners(),
  ]);
  const category = categories.find((c) => c.id === Number(rawId));
  if (!category) notFound();
  const filters = { ...parseCategoryParams(sp), categoryIds: [] };
  const detail = buildCategoryDetail(ledger.expenses, category.id, filters);
  const q = categoryQuery(filters);
  const payerName = (id: number | null) => (id === null ? "ফান্ড" : (partners.find((p) => p.id === id)?.name ?? "?"));

  return (
    <>
      <PeriodBar params={filters} partners={partners} />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={category.icon} color={category.color} size="lg" />
          <div>
            <h2 className="text-xl font-bold">{category.name}</h2>
            <p className="text-sm text-muted-foreground">
              {detail.period.label} · {payerLabel(filters.payer, partners)}
            </p>
          </div>
        </div>
        <CategoryDetailBody
          detail={detail}
          isLabour={category.slug === "labour"}
          color={category.color}
          payerName={payerName}
        />
        <ExportButtons
          pdf={`/print/categories/${category.id}${q}`}
          csv={`/export/categories${categoryQuery(filters, { categoryIds: [category.id] })}&entries=1`}
        />
      </div>
    </>
  );
}

export default function CategoryDetailPage(props: PageProps<"/categories/[id]">) {
  return (
    <>
      <PageHeader title="খাতের বিস্তারিত" back="/categories" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Detail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
