// Plain-text summary for sharing on WhatsApp (or any app) — no paid API involved.
import { bnDate, bnMonth, monthOf, taka } from "./format";
import {
  filterExpenses,
  fundBalance,
  partnerPositions,
  settleUp,
  totalExpense,
  totalIncome,
  type Ledger,
  type PartnerInfo,
} from "./money";

export function buildShareText(opts: {
  farmName: string;
  ledger: Ledger;
  partners: PartnerInfo[];
  today: string;
  url?: string;
}): string {
  const { ledger, partners, today } = opts;
  const month = monthOf(today);
  const monthExpense = totalExpense(filterExpenses(ledger.expenses, { from: `${month}-01`, to: today }));
  const income = totalIncome(ledger.sales ?? []);
  const fund = fundBalance(ledger);
  const positions = partnerPositions(ledger, partners);
  const transfers = settleUp(positions);

  const total = totalExpense(ledger.expenses);
  const lines = [
    `*${opts.farmName} — হিসাব (${bnDate(today)})*`,
    "",
    `ক্যাশ বাক্স: ${taka(fund)}${fund < 0 ? " ⚠️" : ""}`,
    `মোট খরচ (এ পর্যন্ত): ${taka(total)}`,
  ];
  // Only show the month line when it adds information (not when everything was spent this month).
  if (monthExpense !== total) lines.push(`${bnMonth(month)} এর খরচ: ${taka(monthExpense)}`);
  if (income > 0) {
    lines.push(`মোট বিক্রি: ${taka(income)}`, `লাভ/ক্ষতি: ${taka(income - total, { signed: true })}`);
  }
  lines.push("", "*কে কত টাকা দিয়েছেন*");
  for (const p of positions) lines.push(`${p.name}: ${taka(p.putIn)}`);
  lines.push(`মোট দিয়েছেন: ${taka(positions.reduce((a, p) => a + p.putIn, 0))}`);
  lines.push("", "*পার্টনারদের অবস্থান*");
  for (const p of positions) lines.push(`${p.name}: ${taka(p.net, { signed: true })}`);
  lines.push("", "*কে কাকে দেবেন*");
  if (transfers.length === 0) lines.push("সবার হিসাব সমান");
  for (const t of transfers) lines.push(`${t.fromName} → ${t.toName} ${taka(t.amount)}`);
  if (opts.url) lines.push("", opts.url);
  return lines.join("\n");
}
