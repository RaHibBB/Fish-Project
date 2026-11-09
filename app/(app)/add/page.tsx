import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/expense-form";
import { requirePartner } from "@/lib/server/auth";
import { duesByShop } from "@/lib/dues";
import { getCategories, getLastExpense, getLedger, getPartners, getPonds, getSettings } from "@/lib/server/queries";

async function AddExpense() {
  await requirePartner();
  const [categories, partners, settings, last, ponds, ledger] = await Promise.all([
    getCategories(),
    getPartners(),
    getSettings(),
    getLastExpense(),
    getPonds(),
    getLedger(),
  ]);
  const shops = duesByShop(ledger.expenses, ledger.duePayments).map((s) => s.shop);
  return (
    <ExpenseForm
      categories={categories}
      partners={partners}
      ponds={ponds}
      shops={shops}
      wage={settings.labourDailyWage}
      last={
        last && {
          date: last.date,
          categoryId: last.categoryId,
          amount: last.amount,
          description: last.description,
          paidByPartnerId: last.paidByPartnerId,
          labourCount: last.labourCount,
          labourRate: last.labourRate,
          onCredit: last.onCredit,
          shop: last.shop,
        }
      }
    />
  );
}

export default function AddExpensePage() {
  return (
    <>
      <PageHeader title="নতুন খরচ" back="/" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <AddExpense />
      </Suspense>
    </>
  );
}
