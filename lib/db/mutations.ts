// All writes go through here: validated with Zod, done in a transaction together with
// their audit_log row. Callers (server actions, scripts) pass the acting partner's id.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isISODate, todayISO } from "@/lib/format";
import type { DB } from "./client";
import { writeAudit } from "./audit";
import { categories, contributionMethods, contributions, expenses, partners, withdrawals } from "./schema";

export const MAX_AMOUNT = 1_00_00_000; // ৳1 crore — guards against an extra zero

const isoDate = z
  .string()
  .refine(isISODate, "invalid_date")
  .refine((d) => d <= todayISO(), "future_date");

const amount = z.coerce.number().int().min(1).max(MAX_AMOUNT);
const note = z.string().trim().max(200).default("");

export const expenseInput = z
  .object({
    date: isoDate,
    categoryId: z.coerce.number().int().positive(),
    amount,
    description: note,
    /** null = from the fund */
    paidByPartnerId: z.coerce.number().int().positive().nullable(),
    labourCount: z.coerce.number().int().min(1).max(1000).nullable().default(null),
    labourRate: z.coerce.number().int().min(1).max(100_000).nullable().default(null),
    receiptUrl: z.string().max(400_000).nullable().default(null),
  })
  .refine((e) => (e.labourCount === null) === (e.labourRate === null), {
    message: "labour_fields",
    path: ["labourCount"],
  })
  .refine((e) => e.labourCount === null || e.labourCount * e.labourRate! === e.amount, {
    message: "labour_amount",
    path: ["amount"],
  });
export type ExpenseInput = z.input<typeof expenseInput>;

export const contributionInput = z.object({
  date: isoDate,
  partnerId: z.coerce.number().int().positive(),
  amount,
  method: z.enum(contributionMethods).default("cash"),
  note,
});
export type ContributionInput = z.input<typeof contributionInput>;

export const withdrawalInput = z.object({
  date: isoDate,
  partnerId: z.coerce.number().int().positive(),
  amount,
  note,
});
export type WithdrawalInput = z.input<typeof withdrawalInput>;

export const voidInput = z.object({ reason: z.string().trim().min(2).max(200) });

export class MutationError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function assertCategory(db: DB, id: number) {
  const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id));
  if (!c) throw new MutationError("unknown_category");
}

async function assertPartner(db: DB, id: number | null) {
  if (id === null) return;
  const [p] = await db.select({ id: partners.id }).from(partners).where(eq(partners.id, id));
  if (!p) throw new MutationError("unknown_partner");
}

// ---------------------------------------------------------------- expenses

export async function createExpense(db: DB, actorId: number | null, raw: ExpenseInput) {
  const data = expenseInput.parse(raw);
  await assertCategory(db, data.categoryId);
  await assertPartner(db, data.paidByPartnerId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({ ...data, createdBy: actorId })
      .returning();
    await writeAudit(tx, { actorId, action: "create", tableName: "expenses", rowId: row.id, after: row });
    return row;
  });
}

export async function updateExpense(db: DB, actorId: number, id: number, raw: ExpenseInput) {
  const data = expenseInput.parse(raw);
  await assertCategory(db, data.categoryId);
  await assertPartner(db, data.paidByPartnerId);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(expenses).where(eq(expenses.id, id)).for("update");
    if (!before) throw new MutationError("not_found");
    if (before.voidedAt) throw new MutationError("voided");
    const [row] = await tx
      .update(expenses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    await writeAudit(tx, { actorId, action: "update", tableName: "expenses", rowId: id, before, after: row });
    return row;
  });
}

// ---------------------------------------------------------------- contributions / withdrawals

export async function createContribution(db: DB, actorId: number | null, raw: ContributionInput) {
  const data = contributionInput.parse(raw);
  await assertPartner(db, data.partnerId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contributions)
      .values({ ...data, createdBy: actorId })
      .returning();
    await writeAudit(tx, { actorId, action: "create", tableName: "contributions", rowId: row.id, after: row });
    return row;
  });
}

export async function updateContribution(db: DB, actorId: number, id: number, raw: ContributionInput) {
  const data = contributionInput.parse(raw);
  await assertPartner(db, data.partnerId);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(contributions).where(eq(contributions.id, id)).for("update");
    if (!before) throw new MutationError("not_found");
    if (before.voidedAt) throw new MutationError("voided");
    const [row] = await tx
      .update(contributions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contributions.id, id))
      .returning();
    await writeAudit(tx, { actorId, action: "update", tableName: "contributions", rowId: id, before, after: row });
    return row;
  });
}

export async function createWithdrawal(db: DB, actorId: number | null, raw: WithdrawalInput) {
  const data = withdrawalInput.parse(raw);
  await assertPartner(db, data.partnerId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(withdrawals)
      .values({ ...data, createdBy: actorId })
      .returning();
    await writeAudit(tx, { actorId, action: "create", tableName: "withdrawals", rowId: row.id, after: row });
    return row;
  });
}

export async function updateWithdrawal(db: DB, actorId: number, id: number, raw: WithdrawalInput) {
  const data = withdrawalInput.parse(raw);
  await assertPartner(db, data.partnerId);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(withdrawals).where(eq(withdrawals.id, id)).for("update");
    if (!before) throw new MutationError("not_found");
    if (before.voidedAt) throw new MutationError("voided");
    const [row] = await tx
      .update(withdrawals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(withdrawals.id, id))
      .returning();
    await writeAudit(tx, { actorId, action: "update", tableName: "withdrawals", rowId: id, before, after: row });
    return row;
  });
}

// ---------------------------------------------------------------- void

const VOIDABLE = { expenses, contributions, withdrawals } as const;
export type VoidableTable = keyof typeof VOIDABLE;

/** Mark a row as বাতিল. It stays visible but drops out of every total. Never deletes. */
export async function voidRow(db: DB, actorId: number, table: VoidableTable, id: number, reason: string) {
  const { reason: why } = voidInput.parse({ reason });
  const t = VOIDABLE[table];
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(t).where(eq(t.id, id)).for("update");
    if (!before) throw new MutationError("not_found");
    if (before.voidedAt) throw new MutationError("voided");
    const [row] = await tx
      .update(t)
      .set({ voidReason: why, voidedBy: actorId, voidedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    await writeAudit(tx, { actorId, action: "void", tableName: table, rowId: id, before, after: row });
    return row;
  });
}
