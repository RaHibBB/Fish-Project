import { Suspense } from "react";
import { CategoryPicker, PeriodBar } from "@/components/category-filters";
import { CategoryList } from "@/components/category-list";
import { ExportButtons } from "@/components/export-buttons";
import { PageHeader } from "@/components/page-header";
import { buildCategoryView, categoryQuery, parseCategoryParams, payerLabel } from "@/lib/category-view";
import { taka } from "@/lib/format";
import { getCategories, getLedger, getPartners } from "@/lib/server/queries";

async function Categories({ searchParams }: { searchParams: PageProps<"/categories">["searchParams"] }) {
  const [sp, ledger, categories, partners] = await Promise.all([
    searchParams,
    getLedger(),
    getCategories(),
    getPartners(),
  ]);
  const params = parseCategoryParams(sp);
  const view = buildCategoryView(ledger.expenses, categories, params);
  const q = categoryQuery(params);
  const visible = categories.filter((c) => !c.archived || params.categoryIds.includes(c.id));

  return (
    <>
      <PeriodBar params={params} partners={partners} />
      <div className="space-y-4 py-4">
        <div className="mx-4 rounded-xl bg-muted/60 p-3">
          <div className="text-sm text-muted-foreground">
            {view.period.label} · {payerLabel(params.payer, partners)}
            {params.categoryIds.length > 0 && ` · ${params.categoryIds.length}টি খাত`}
          </div>
          <div className="text-2xl font-bold tabular-nums">{taka(view.total)}</div>
          {params.categoryIds.length > 1 && <div className="text-sm">বাছাই করা খাতগুলোর মোট</div>}
        </div>
        <CategoryPicker params={params} categories={visible} />
        <CategoryList view={view} hrefFor={(id) => `/categories/${id}${categoryQuery(params, { categoryIds: [] })}`} />
        <div className="mx-4">
          <ExportButtons pdf={`/print/categories${q}`} csv={`/export/categories${q}`} />
        </div>
      </div>
    </>
  );
}

export default function CategoriesPage(props: PageProps<"/categories">) {
  return (
    <>
      <PageHeader title="খাত — কোন খাতে কত খরচ" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Categories searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
