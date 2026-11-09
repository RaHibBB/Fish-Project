// All writes go through here: validated with Zod, done in a transaction together with
// their audit_log row. Callers (server actions, scripts) pass the acting partner's id.
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { duesByShop, dueForShop } from "@/lib/dues";
import { isISODate, todayISO } from "@/lib/format";
import type { DB } from "./client";
import { writeAudit } from "./audit";
import {
  categories,
  contributionMethods,
  contributions,
  duePayments,
  expenses,
  feedings,
  partners,
  ponds,
  sales,
  withdrawals,
} from "./schema";

export const MAX_AMOUNT = 1_00_00_000; // ৳1 crore — guards against an extra zero

const isoDate = z
  .string()
  .refine(isISODate, "invalid_date")
  .refine((d) => d <= todayISO(), "future_date");

const amount = z.coerce.number().int().min(1).max(MAX_AMOUNT);
const note = z.string().trim().max(200).default("");
const optionalId = z.coerce.number().int().positive().nullable().default(null);
/** Set by the phone for each save attempt; a re-send with the same id never creates a duplicate. */
const clientId = z.string().trim().min(8).max(64).nullable().default(null);
const shopName = z.string().trim().max(80);
const kg = z.coerce.number().positive().max(1_000_000).transform((n) => Math.round(n * 100) / 100);

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
    pondId: optionalId,
    /** bought on credit (বাকি) from `shop` — nobody has paid yet */
    onCredit: z.boolean().default(false),
    shop: shopName.default(""),
    clientId,
  })
  .refine((e) => !e.onCredit || e.paidByPartnerId === null, { message: "credit_paid_by", path: ["paidByPartnerId"] })
  .refine((e) => !e.onCredit || e.shop.length > 0, { message: "shop_required", path: ["shop"] })
  .refine((e) => (e.labourCount === null) === (e.labourRate === null), {
    message: "labour_fields",
    path: ["labourCount"],
  })
  .refine((e) => e.labourCount === null || e.labourCount * e.labourRate! === e.amount, {
    message: "labour_amount",
    path: ["amount"],
  })
  // The shop name only means something for a credit purchase.
  .transform((e) => (e.onCredit ? e : { ...e, shop: "" }));
export type ExpenseInput = z.input<typeof expenseInput>;

export const contributionInput = z.object({
  date: isoDate,
  partnerId: z.coerce.number().int().positive(),
  amount,
  method: z.enum(contributionMethods).default("cash"),
  note,
  clientId,
});
export type ContributionInput = z.input<typeof contributionInput>;

export const withdrawalInput = z.object({
  date: isoDate,
  partnerId: z.coerce.number().int().positive(),
  amount,
  note,
  clientId,
});
export type WithdrawalInput = z.input<typeof withdrawalInput>;

export const saleInput = z.object({
  date: isoDate,
  amount,
  fish: z.string().trim().max(60).default(""),
  weightKg: kg.nullable().default(null),
  buyer: z.string().trim().max(80).default(""),
  pondId: optionalId,
  /** null = paid into the fund */
  receivedByPartnerId: optionalId,
  note,
  receiptUrl: z.string().max(400_000).nullable().default(null),
  clientId,
});
export type SaleInput = z.input<typeof saleInput>;

export const duePaymentInput = z.object({
  date: isoDate,
  shop: shopName.min(1),
  amount,
  /** null = paid from the fund */
  paidByPartnerId: optionalId,
  note,
  receiptUrl: z.string().max(400_000).nullable().default(null),
  clientId,
});
export type DuePaymentInput = z.input<typeof duePaymentInput>;

export const feedingInput = z.object({
  date: isoDate,
  pondId: optionalId,
  feedKg: kg,
  feedType: z.string().trim().max(60).default(""),
  note,
});
export type FeedingInput = z.input<typeof feedingInput>;

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
  const [p] = await db.select({ isPartner: partners.isPartner }).from(partners).where(eq(partners.id, id));
  if (!p?.isPartner) throw new MutationError("unknown_partner");
}

async function assertPond(db: DB, id: number | null) {
  if (id === null) return;
  const [p] = await db.select({ id: ponds.id }).from(ponds).where(eq(ponds.id, id));
  if (!p) throw new MutationError("unknown_pond");
}

type EntryTable = typeof expenses | typeof contributions | typeof withdrawals | typeof sales | typeof duePayments;
const TABLE_NAME = new Map<EntryTable, string>([
  [expenses, "expenses"],
  [contributions, "contributions"],
  [withdrawals, "withdrawals"],
  [sales, "sales"],
  [duePayments, "due_payments"],
]);

/**
 * Insert + audit in one transaction. With a clientId that was already saved (the phone
 * re-sent after a dropped connection) the existing row is returned and nothing is added.
 */
async function insertEntry<T extends EntryTable>(
  db: DB,
  table: T,
  actorId: number | null,
  values: T["$inferInsert"] & { clientId?: string | null },
): Promise<T["$inferSelect"]> {
  const existing = async () => {
    if (!values.clientId) return null;
    const [row] = await db.select().from(table as EntryTable).where(eq(table.clientId, values.clientId));
    return (row as T["$inferSelect"]) ?? null;
  };
  const already = await existing();
  if (already) return already;
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(table as EntryTable)
        .values({ ...values, createdBy: actorId } as never)
        .returning();
      await writeAudit(tx, { actorId, action: "create", tableName: TABLE_NAME.get(table)!, rowId: row.id, after: row });
      return row as T["$inferSelect"];
    });
  } catch (err) {
    // Two copies of the same send raced each other: the other one won.
    const raced = await existing();
    if (raced) return raced;
    throw err;
  }
}

async function updateEntry<T extends EntryTable>(
  db: DB,
  table: T,
  actorId: number,
  id: number,
  values: Partial<T["$inferInsert"]>,
): Promise<T["$inferSelect"]> {
  return db.transaction(async (tx) => {
    const t = table as EntryTable;
    const [before] = await tx.select().from(t).where(eq(t.id, id)).for("update");
    if (!before) throw new MutationError("not_found");
    if (before.voidedAt) throw new MutationError("voided");
    const [row] = await tx
      .update(t)
      .set({ ...values, updatedAt: new Date() } as never)
      .where(eq(t.id, id))
      .returning();
    await writeAudit(tx, { actorId, action: "update", tableName: TABLE_NAME.get(table)!, rowId: id, before, after: row });
    return row as T["$inferSelect"];
  });
}

// ---------------------------------------------------------------- expenses

/**
 * Changing or voiding a credit purchase must not leave a shop with more paid than bought.
 * `replacement` is the credit purchase as it will be after the change (null = it goes away).
 */
async function assertDuesStayValid(
  db: DB,
  expenseId: number,
  replacement: { onCredit: boolean; shop: string; amount: number; date: string } | null,
) {
  const [credit, paid] = await Promise.all([
    db.select().from(expenses).where(and(eq(expenses.onCredit, true), isNull(expenses.voidedAt))),
    db.select().from(duePayments).where(isNull(duePayments.voidedAt)),
  ]);
  const others = credit.filter((c) => c.id !== expenseId);
  const after = replacement?.onCredit ? [...others, { ...replacement, voidedAt: null }] : others;
  if (duesByShop(after, paid).some((s) => s.due < 0)) throw new MutationError("due_has_payments");
}

export async function createExpense(db: DB, actorId: number | null, raw: ExpenseInput) {
  const data = expenseInput.parse(raw);
  await assertCategory(db, data.categoryId);
  await assertPartner(db, data.paidByPartnerId);
  await assertPond(db, data.pondId);
  return insertEntry(db, expenses, actorId, data);
}

export async function updateExpense(db: DB, actorId: number, id: number, raw: ExpenseInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clientId: _ignored, ...data } = expenseInput.parse(raw);
  await assertCategory(db, data.categoryId);
  await assertPartner(db, data.paidByPartnerId);
  await assertPond(db, data.pondId);
  await assertDuesStayValid(db, id, data);
  return updateEntry(db, expenses, actorId, id, data);
}

// ---------------------------------------------------------------- contributions / withdrawals

export async function createContribution(db: DB, actorId: number | null, raw: ContributionInput) {
  const data = contributionInput.parse(raw);
  await assertPartner(db, data.partnerId);
  return insertEntry(db, contributions, actorId, data);
}

export async function updateContribution(db: DB, actorId: number, id: number, raw: ContributionInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clientId: _ignored, ...data } = contributionInput.parse(raw);
  await assertPartner(db, data.partnerId);
  return updateEntry(db, contributions, actorId, id, data);
}

export async function createWithdrawal(db: DB, actorId: number | null, raw: WithdrawalInput) {
  const data = withdrawalInput.parse(raw);
  await assertPartner(db, data.partnerId);
  return insertEntry(db, withdrawals, actorId, data);
}

export async function updateWithdrawal(db: DB, actorId: number, id: number, raw: WithdrawalInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clientId: _ignored, ...data } = withdrawalInput.parse(raw);
  await assertPartner(db, data.partnerId);
  return updateEntry(db, withdrawals, actorId, id, data);
}

// ---------------------------------------------------------------- sales

export async function createSale(db: DB, actorId: number | null, raw: SaleInput) {
  const data = saleInput.parse(raw);
  await assertPartner(db, data.receivedByPartnerId);
  await assertPond(db, data.pondId);
  return insertEntry(db, sales, actorId, data);
}

export async function updateSale(db: DB, actorId: number, id: number, raw: SaleInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clientId: _ignored, ...data } = saleInput.parse(raw);
  await assertPartner(db, data.receivedByPartnerId);
  await assertPond(db, data.pondId);
  return updateEntry(db, sales, actorId, id, data);
}

// ---------------------------------------------------------------- shop credit (বাকি) payments

/** A payment may not be more than what is still owed to that shop (catches a typo like an extra zero). */
async function assertWithinDue(db: DB, shop: string, amount: number, replacingId?: number) {
  const [credit, paid] = await Promise.all([
    db.select().from(expenses).where(and(eq(expenses.onCredit, true), isNull(expenses.voidedAt))),
    db.select().from(duePayments).where(isNull(duePayments.voidedAt)),
  ]);
  const others = replacingId ? paid.filter((p) => p.id !== replacingId) : paid;
  if (amount > dueForShop(credit, others, shop)) throw new MutationError("due_exceeded");
}

export async function createDuePayment(db: DB, actorId: number | null, raw: DuePaymentInput) {
  const data = duePaymentInput.parse(raw);
  await assertPartner(db, data.paidByPartnerId);
  // A re-send of a payment that already arrived is answered by insertEntry; don't re-check it against the lower due.
  if (!data.clientId || !(await db.select({ id: duePayments.id }).from(duePayments).where(eq(duePayments.clientId, data.clientId))).length) {
    await assertWithinDue(db, data.shop, data.amount);
  }
  return insertEntry(db, duePayments, actorId, data);
}

export async function updateDuePayment(db: DB, actorId: number, id: number, raw: DuePaymentInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clientId: _ignored, ...data } = duePaymentInput.parse(raw);
  await assertPartner(db, data.paidByPartnerId);
  await assertWithinDue(db, data.shop, data.amount, id);
  return updateEntry(db, duePayments, actorId, id, data);
}

// ---------------------------------------------------------------- feeding log

export async function createFeeding(db: DB, actorId: number, raw: FeedingInput) {
  const data = feedingInput.parse(raw);
  await assertPond(db, data.pondId);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(feedings).values({ ...data, createdBy: actorId }).returning();
    await writeAudit(tx, { actorId, action: "create", tableName: "feedings", rowId: row.id, after: row });
    return row;
  });
}

// ---------------------------------------------------------------- void

const VOIDABLE = { expenses, contributions, withdrawals, sales, due_payments: duePayments, feedings } as const;
export type VoidableTable = keyof typeof VOIDABLE;

/** Mark a row as বাতিল. It stays visible but drops out of every total. Never deletes. */
export async function voidRow(db: DB, actorId: number, table: VoidableTable, id: number, reason: string) {
  const { reason: why } = voidInput.parse({ reason });
  const t = VOIDABLE[table] as typeof expenses;
  if (table === "expenses") await assertDuesStayValid(db, id, null);
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
