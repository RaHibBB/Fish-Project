import { Suspense } from "react";
import { AutoPrint } from "@/components/auto-print";
import { CategoryList } from "@/components/category-list";
import { buildCategoryView, parseCategoryParams, payerLabel } from "@/lib/category-view";
import { getCategories, getLedger, getPartners } from "@/lib/server/queries";

async function PrintCategories({ searchParams }: { searchParams: PageProps<"/print/categories">["searchParams"] }) {
  const [sp, ledger, categories, partners] = await Promise.all([searchParams, getLedger(), getCategories(), getPartners()]);
  const params = parseCategoryParams(sp);
  const view = buildCategoryView(ledger.expenses, categories, params);
  const chosen = categories.filter((c) => params.categoryIds.includes(c.id)).map((c) => c.name);
  return (
    <>
      <AutoPrint />
      <h1 className="text-2xl font-bold">খাত অনুযায়ী খরচ</h1>
      <p className="mb-3 text-sm">
        {view.period.label} · কে দিল: {payerLabel(params.payer, partners)}
        {chosen.length > 0 && ` · খাত: ${chosen.join(", ")}`}
      </p>
      <CategoryList view={view} />
    </>
  );
}

export default function PrintCategoriesPage(props: PageProps<"/print/categories">) {
  return (
    <Suspense fallback={<p>…</p>}>
      <PrintCategories searchParams={props.searchParams} />
    </Suspense>
  );
}
