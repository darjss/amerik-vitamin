CREATE TYPE "shop"."outbox_kind" AS ENUM('order_placed', 'order_paid', 'unmatched_transfer', 'oversold');--> statement-breakpoint
CREATE TABLE "shop"."bank_transactions" (
	"id" uuid PRIMARY KEY,
	"fingerprint" text NOT NULL UNIQUE,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"account" text,
	"happened_at" timestamp with time zone NOT NULL,
	"payment_id" uuid UNIQUE,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."outbox" (
	"id" uuid PRIMARY KEY,
	"kind" "shop"."outbox_kind" NOT NULL,
	"text" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_until" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."qpay_invoices" (
	"id" text PRIMARY KEY,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bank_transactions_unmatched_idx" ON "shop"."bank_transactions" ("happened_at") WHERE payment_id is null;--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "shop"."outbox" ("created_at") WHERE sent_at is null;--> statement-breakpoint
CREATE INDEX "qpay_invoices_order_idx" ON "shop"."qpay_invoices" ("order_id");--> statement-breakpoint
ALTER TABLE "shop"."bank_transactions" ADD CONSTRAINT "bank_transactions_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "shop"."payments"("id");--> statement-breakpoint
ALTER TABLE "shop"."qpay_invoices" ADD CONSTRAINT "qpay_invoices_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop"."orders"("id");