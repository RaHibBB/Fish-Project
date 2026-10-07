import { parseCategoryParams } from "@/lib/category-view";
import { csvResponse } from "@/lib/csv";
import { categoryCsv, expensesCsv, moneyCsv, monthlyCsv, partnersCsv } from "@/lib/exports";
import { todayISO } from "@/lib/format";
import { getCategories, getLedger, getPartners } from "@/lib/server/queries";

/** CSV downloads: /export/categories?…, /export/expenses, /export/money, /export/monthly, /export/partners */
export async function GET(req: Request, ctx: RouteContext<"/export/[name]">) {
  const { name } = await ctx.params;
  const [ledger, categories, partners] = await Promise.all([getLedger(), getCategories(), getPartners()]);
  const stamp = todayISO();
  const sp = Object.fromEntries(new URL(req.url).searchParams);

  switch (name) {
    case "categories": {
      const entries = sp.entries === "1";
      const rows = categoryCsv(ledger, categories, partners, parseCategoryParams(sp), entries);
      return csvResponse(`farm-${entries ? "category-entries" : "categories"}-${stamp}.csv`, rows);
    }
    case "expenses":
      return csvResponse(`farm-expenses-${stamp}.csv`, expensesCsv(ledger, categories, partners));
    case "money":
      return csvResponse(`farm-contributions-${stamp}.csv`, moneyCsv(ledger, partners));
    case "monthly":
      return csvResponse(`farm-monthly-${stamp}.csv`, monthlyCsv(ledger));
    case "partners":
      return csvResponse(`farm-partners-${stamp}.csv`, partnersCsv(ledger, partners));
    default:
      return new Response("Not found", { status: 404 });
  }
}
