CREATE TABLE "due_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"shop" text NOT NULL,
	"amount" integer NOT NULL,
	"paid_by_partner_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"receipt_url" text,
	"client_id" text,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "due_payments_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "due_payments_amount_positive" CHECK ("due_payments"."amount" > 0),
	CONSTRAINT "due_payments_shop" CHECK (length(trim("due_payments"."shop")) > 0),
	CONSTRAINT "due_payments_void_fields" CHECK (("due_payments"."voided_at" is null and "due_payments"."void_reason" is null) or ("due_payments"."voided_at" is not null and length(trim("due_payments"."void_reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "on_credit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "shop" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "receipt_url" text;--> statement-breakpoint
ALTER TABLE "due_payments" ADD CONSTRAINT "due_payments_paid_by_partner_id_partners_id_fk" FOREIGN KEY ("paid_by_partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_payments" ADD CONSTRAINT "due_payments_voided_by_partners_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_payments" ADD CONSTRAINT "due_payments_created_by_partners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "due_payments_date_idx" ON "due_payments" USING btree ("date");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_credit_fields" CHECK (not "expenses"."on_credit" or ("expenses"."paid_by_partner_id" is null and length(trim("expenses"."shop")) > 0));