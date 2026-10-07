CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"row_id" integer,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"partner_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "contributions_amount_positive" CHECK ("contributions"."amount" > 0),
	CONSTRAINT "contributions_method" CHECK ("contributions"."method" in ('cash', 'bkash', 'bank')),
	CONSTRAINT "contributions_void_fields" CHECK (("contributions"."voided_at" is null and "contributions"."void_reason" is null) or ("contributions"."voided_at" is not null and length(trim("contributions"."void_reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"category_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"paid_by_partner_id" integer,
	"labour_count" integer,
	"labour_rate" integer,
	"receipt_url" text,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0),
	CONSTRAINT "expenses_labour_fields" CHECK (("expenses"."labour_count" is null or "expenses"."labour_count" > 0) and ("expenses"."labour_rate" is null or "expenses"."labour_rate" > 0)),
	CONSTRAINT "expenses_void_fields" CHECK (("expenses"."voided_at" is null and "expenses"."void_reason" is null) or ("expenses"."voided_at" is not null and length(trim("expenses"."void_reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"pin_hash" text NOT NULL,
	"share_bp" integer NOT NULL,
	"must_change_pin" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_phone_unique" UNIQUE("phone"),
	CONSTRAINT "partners_share_bp_range" CHECK ("partners"."share_bp" >= 0 and "partners"."share_bp" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"labour_daily_wage" integer DEFAULT 820 NOT NULL,
	"farm_name" text DEFAULT 'চৌধুরী ব্রাদার্স এগ্রো' NOT NULL,
	"start_date" date,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_wage_positive" CHECK ("settings"."labour_daily_wage" > 0)
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"partner_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "withdrawals_amount_positive" CHECK ("withdrawals"."amount" > 0),
	CONSTRAINT "withdrawals_void_fields" CHECK (("withdrawals"."voided_at" is null and "withdrawals"."void_reason" is null) or ("withdrawals"."voided_at" is not null and length(trim("withdrawals"."void_reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_partners_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_voided_by_partners_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_created_by_partners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_partner_id_partners_id_fk" FOREIGN KEY ("paid_by_partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_partners_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_partners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_voided_by_partners_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_created_by_partners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_row_idx" ON "audit_log" USING btree ("table_name","row_id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");