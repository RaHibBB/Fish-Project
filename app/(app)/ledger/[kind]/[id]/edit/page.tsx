import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ExpenseForm } from "@/components/expense-form";
import { MoneyForm } from "@/components/money-form";
import { PageHeader } from "@/components/page-header";
import { requirePartner } from "@/lib/server/auth";
import { SaleForm } from "@/components/sale-form";
import { DuePaymentForm } from "@/components/due-payment-form";
import { duesByShop } from "@/lib/dues";
import { getContribution, getDuePayment, getExpense, getSale, getWithdrawal, isEntryKind } from "@/lib/server/entry";
import { getCategories, getLedger, getPartners, getPonds, getSettings } from "@/lib/server/queries";

async function Edit({ params }: { params: PageProps<"/ledger/[kind]/[id]/edit">["params"] }) {
  const partner = await requirePartner();
  const { kind, id: rawId } = await params;
  const id = Number(rawId);
  if (!isEntryKind(kind) || !Number.isInteger(id)) notFound();
  const [partners, ponds] = await Promise.all([getPartners(), getPonds()]);

  if (kind === "sale") {
    const s = await getSale(id);
    if (!s || s.voidedAt) notFound();
    return (
      <SaleForm
        partners={partners}
        ponds={ponds}
        fishSuggestions={[]}
        initial={{
          id: s.id,
          date: s.date,
          amount: s.amount,
          fish: s.fish,
          weightKg: s.weightKg,
          buyer: s.buyer,
          pondId: s.pondId,
          receivedByPartnerId: s.receivedByPartnerId,
          note: s.note,
          hasReceipt: Boolean(s.receiptUrl),
        }}
      />
    );
  }

  if (kind === "duepayment") {
    const [d, ledger] = await Promise.all([getDuePayment(id), getLedger()]);
    if (!d || d.voidedAt) notFound();
    // The most this payment may be edited up to: what is owed to the shop plus what this payment already covers.
    const owed = duesByShop(ledger.expenses, ledger.duePayments).find((s) => s.shop.toLowerCase() === d.shop.trim().toLowerCase())?.due ?? 0;
    return (
      <DuePaymentForm
        shops={[{ shop: d.shop, due: owed + d.amount }]}
        partners={partners}
        initial={{
          id: d.id,
          date: d.date,
          shop: d.shop,
          amount: d.amount,
          paidByPartnerId: d.paidByPartnerId,
          note: d.note,
          hasReceipt: Boolean(d.receiptUrl),
        }}
      />
    );
  }

  if (kind === "expense") {
    const [e, categories, settings, ledger] = await Promise.all([getExpense(id), getCategories(), getSettings(), getLedger()]);
    if (!e || e.voidedAt) notFound();
    return (
      <ExpenseForm
        categories={categories}
        partners={partners}
        ponds={ponds}
        shops={duesByShop(ledger.expenses, ledger.duePayments).map((x) => x.shop)}
        wage={settings.labourDailyWage}
        initial={{
          id: e.id,
          date: e.date,
          categoryId: e.categoryId,
          amount: e.amount,
          description: e.description,
          paidByPartnerId: e.paidByPartnerId,
          labourCount: e.labourCount,
          labourRate: e.labourRate,
          hasReceipt: Boolean(e.receiptUrl),
          pondId: e.pondId,
          onCredit: e.onCredit,
          shop: e.shop,
        }}
      />
    );
  }

  const c = kind === "contribution" ? await getContribution(id) : null;
  const m = c ?? (kind === "withdrawal" ? await getWithdrawal(id) : null);
  if (!m || m.voidedAt) notFound();
  return (
    <MoneyForm
      partners={partners}
      currentPartnerId={partner.id}
      initial={{
        id: m.id,
        kind: kind === "withdrawal" ? "withdrawal" : "contribution",
        date: m.date,
        partnerId: m.partnerId,
        amount: m.amount,
        method: c?.method ?? "cash",
        note: m.note,
      }}
    />
  );
}

export default function EditEntryPage(props: PageProps<"/ledger/[kind]/[id]/edit">) {
  return (
    <>
      <PageHeader title="সম্পাদনা" back="/ledger" />
      <Suspense fallback={<p className="p-4 text-muted-foreground">…</p>}>
        <Edit params={props.params} />
      </Suspense>
    </>
  );
}
