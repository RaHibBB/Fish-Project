import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/expense-form";
import { requirePartner } from "@/lib/server/auth";
import { getCategories, getLastExpense, getPartners, getPonds, getSettings } from "@/lib/server/queries";

async function AddExpense() {
  await requirePartner();
  const [categories, partners, settings, last, ponds] = await Promise.all([
    getCategories(),
    getPartners(),
    getSettings(),
    getLastExpense(),
    getPonds(),
  ]);
  return (
    <ExpenseForm
      categories={categories}
      partners={partners}
      ponds={ponds}
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
