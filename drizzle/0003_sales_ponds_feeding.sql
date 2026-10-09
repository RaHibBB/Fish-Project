CREATE TABLE "feedings" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"pond_id" integer,
	"feed_kg" numeric(10, 2) NOT NULL,
	"feed_type" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedings_kg_positive" CHECK ("feedings"."feed_kg" > 0),
	CONSTRAINT "feedings_void_fields" CHECK (("feedings"."voided_at" is null and "feedings"."void_reason" is null) or ("feedings"."voided_at" is not null and length(trim("feedings"."void_reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "ponds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ponds_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"partner_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"amount" integer NOT NULL,
	"fish" text DEFAULT '' NOT NULL,
	"weight_kg" numeric(10, 2),
	"buyer" text DEFAULT '' NOT NULL,
	"pond_id" integer,
	"received_by_partner_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"client_id" text,
	"void_reason" text,
	"voided_by" integer,
	"voided_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "sales_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "sales_amount_positive" CHECK ("sales"."amount" > 0),
	CONSTRAINT "sales_weight_positive" CHECK ("sales"."weight_kg" is null or "sales"."weight_kg" > 0),
	CONSTRAINT "sales_void_fields" CHECK (("sales"."voided_at" is null and "sales"."void_reason" is null) or ("sales"."voided_at" is not null and length(trim("sales"."void_reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "contributions" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "pond_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "low_fund_alert" integer DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "feedings" ADD CONSTRAINT "feedings_pond_id_ponds_id_fk" FOREIGN KEY ("pond_id") REFERENCES "public"."ponds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedings" ADD CONSTRAINT "feedings_voided_by_partners_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedings" ADD CONSTRAINT "feedings_created_by_partners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_pond_id_ponds_id_fk" FOREIGN KEY ("pond_id") REFERENCES "public"."ponds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_received_by_partner_id_partners_id_fk" FOREIGN KEY ("received_by_partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_partners_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_partners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedings_date_idx" ON "feedings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "sales_date_idx" ON "sales" USING btree ("date");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_pond_id_ponds_id_fk" FOREIGN KEY ("pond_id") REFERENCES "public"."ponds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_client_id_unique" UNIQUE("client_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_unique" UNIQUE("client_id");--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_client_id_unique" UNIQUE("client_id");