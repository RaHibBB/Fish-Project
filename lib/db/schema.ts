import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const partners = pgTable(
  "partners",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull().unique(),
    pinHash: text("pin_hash").notNull(),
    /** Share of costs in basis points; all partners must sum to 10000. */
    shareBp: integer("share_bp").notNull(),
    /**
     * false = a login-only admin (e.g. a family member who keeps the books) with no share:
     * can add and edit entries but never appears in shares, payer lists or settle-up.
     */
    isPartner: boolean("is_partner").notNull().default(true),
    mustChangePin: boolean("must_change_pin").notNull().default(true),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("partners_share_bp_range", sql`${t.shareBp} >= 0 and ${t.shareBp} <= 10000`),
    check("partners_admin_no_share", sql`${t.isPartner} or ${t.shareBp} = 0`),
  ],
);

/** Single-row table (id is always 1). */
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    labourDailyWage: integer("labour_daily_wage").notNull().default(820),
    farmName: text("farm_name").notNull().default("চৌধুরী ব্রাদার্স এগ্রো"),
    startDate: date("start_date", { mode: "string" }),
  },
  (t) => [
    check("settings_single_row", sql`${t.id} = 1`),
    check("settings_wage_positive", sql`${t.labourDailyWage} > 0`),
  ],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  /** Stable key used by quick chips and the importer; the name stays editable. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** lucide icon name, see components/category-icon.tsx */
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Hidden from the add form; old entries keep their category. Categories are never deleted. */
  archived: boolean("archived").notNull().default(false),
});

const voidColumns = () => ({
  voidReason: text("void_reason"),
  voidedBy: integer("voided_by").references(() => partners.id),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
});

const voidCheck = (name: string, t: { voidReason: unknown; voidedAt: unknown }) =>
  check(
    name,
    sql`(${t.voidedAt} is null and ${t.voidReason} is null) or (${t.voidedAt} is not null and length(trim(${t.voidReason})) > 0)`,
  );

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    amount: integer("amount").notNull(),
    description: text("description").notNull().default(""),
    /** null = paid from the common fund (ফান্ড), otherwise the partner who paid personally. */
    paidByPartnerId: integer("paid_by_partner_id").references(() => partners.id),
    labourCount: integer("labour_count"),
    labourRate: integer("labour_rate"),
    receiptUrl: text("receipt_url"),
    ...voidColumns(),
    /** null only for rows created by scripts (import). */
    createdBy: integer("created_by").references(() => partners.id),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    check("expenses_amount_positive", sql`${t.amount} > 0`),
    check(
      "expenses_labour_fields",
      sql`(${t.labourCount} is null or ${t.labourCount} > 0) and (${t.labourRate} is null or ${t.labourRate} > 0)`,
    ),
    voidCheck("expenses_void_fields", t),
    index("expenses_date_idx").on(t.date),
    index("expenses_category_idx").on(t.categoryId),
  ],
);

export const contributionMethods = ["cash", "bkash", "bank"] as const;
export type ContributionMethod = (typeof contributionMethods)[number];

export const contributions = pgTable(
  "contributions",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id),
    amount: integer("amount").notNull(),
    method: text("method", { enum: contributionMethods }).notNull().default("cash"),
    note: text("note").notNull().default(""),
    ...voidColumns(),
    createdBy: integer("created_by").references(() => partners.id),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    check("contributions_amount_positive", sql`${t.amount} > 0`),
    check("contributions_method", sql`${t.method} in ('cash', 'bkash', 'bank')`),
    voidCheck("contributions_void_fields", t),
  ],
);

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id),
    amount: integer("amount").notNull(),
    note: text("note").notNull().default(""),
    ...voidColumns(),
    createdBy: integer("created_by").references(() => partners.id),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    check("withdrawals_amount_positive", sql`${t.amount} > 0`),
    voidCheck("withdrawals_void_fields", t),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** null = system / import script */
    actorId: integer("actor_id").references(() => partners.id),
    action: text("action").notNull(),
    tableName: text("table_name").notNull(),
    rowId: integer("row_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_row_idx").on(t.tableName, t.rowId)],
);

export type Partner = typeof partners.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type Settings = typeof settings.$inferSelect;
