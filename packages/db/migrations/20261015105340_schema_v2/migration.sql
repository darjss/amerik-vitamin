CREATE TYPE "shop"."fulfillment" AS ENUM('courier', 'pickup', 'in_store');--> statement-breakpoint
CREATE TYPE "shop"."order_event_type" AS ENUM('placed', 'edited', 'payment_recorded', 'paid', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "shop"."order_source" AS ENUM('messenger_bot', 'messenger_human', 'web', 'brand_site', 'phone', 'walk_in', 'notebook');--> statement-breakpoint
CREATE TYPE "shop"."order_status" AS ENUM('new', 'paid', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "shop"."payment_method" AS ENUM('qpay', 'transfer', 'cash');--> statement-breakpoint
CREATE TYPE "shop"."payment_terms" AS ENUM('prepay', 'cod');--> statement-breakpoint
CREATE TYPE "shop"."product_form" AS ENUM('softgel', 'capsule', 'tablet', 'chewable', 'gummy', 'lozenge', 'powder', 'liquid', 'other');--> statement-breakpoint
CREATE TYPE "shop"."stock_move_reason" AS ENUM('sale', 'cancel', 'edit', 'receipt', 'count');--> statement-breakpoint
CREATE TABLE "shop"."brands" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."categories" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"slug" text NOT NULL UNIQUE,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."customers" (
	"id" uuid PRIMARY KEY,
	"phone" text UNIQUE,
	"name" text,
	"address" text,
	"legacy_id" integer UNIQUE,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "customers_phone_check" CHECK ("phone" ~ '^[0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "shop"."order_events" (
	"id" uuid PRIMARY KEY,
	"order_id" uuid NOT NULL,
	"type" "shop"."order_event_type" NOT NULL,
	"actor" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."order_lines" (
	"order_id" uuid,
	"product_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"unit_cost" integer,
	CONSTRAINT "order_lines_pkey" PRIMARY KEY("order_id","product_id"),
	CONSTRAINT "order_lines_quantity_check" CHECK ("quantity" > 0),
	CONSTRAINT "order_lines_unit_price_check" CHECK ("unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shop"."orders" (
	"id" uuid PRIMARY KEY,
	"number" integer UNIQUE GENERATED ALWAYS AS IDENTITY (sequence name "shop"."orders_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 10000 CACHE 1),
	"customer_id" uuid,
	"status" "shop"."order_status" NOT NULL,
	"terms" "shop"."payment_terms" NOT NULL,
	"source" "shop"."order_source" NOT NULL,
	"fulfillment" "shop"."fulfillment" NOT NULL,
	"address" text,
	"notes" text,
	"delivery_fee" integer NOT NULL,
	"total" integer NOT NULL,
	"legacy_id" integer UNIQUE,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."payments" (
	"id" uuid PRIMARY KEY,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" "shop"."payment_method" NOT NULL,
	"provider_ref" text UNIQUE,
	"actor" text NOT NULL,
	"legacy_id" integer UNIQUE,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payments_amount_check" CHECK ("amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "shop"."products" (
	"id" uuid PRIMARY KEY,
	"brand_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"line" text NOT NULL,
	"potency" text,
	"count" integer NOT NULL,
	"form" "shop"."product_form" NOT NULL,
	"flavor" text,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"price" integer NOT NULL,
	"stock" integer,
	"cost" integer,
	"asin" text UNIQUE,
	"gtin" text UNIQUE,
	"serving_size" integer,
	"servings" integer,
	"daily_units" integer,
	"images" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "products_identity" UNIQUE NULLS NOT DISTINCT("brand_id","line","potency","count","form","flavor"),
	CONSTRAINT "products_price_check" CHECK ("price" >= 0),
	CONSTRAINT "products_count_check" CHECK ("count" > 0)
);
--> statement-breakpoint
CREATE TABLE "shop"."slug_history" (
	"slug" text PRIMARY KEY,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."stock_moves" (
	"id" uuid PRIMARY KEY,
	"product_id" uuid NOT NULL,
	"change" integer NOT NULL,
	"reason" "shop"."stock_move_reason" NOT NULL,
	"order_id" uuid,
	"note" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "shop"."order_events" ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_lines_product_idx" ON "shop"."order_lines" ("product_id");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "shop"."orders" ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "shop"."orders" ("customer_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "shop"."payments" ("order_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "shop"."products" ("category_id");--> statement-breakpoint
CREATE INDEX "stock_moves_product_idx" ON "shop"."stock_moves" ("product_id","created_at");--> statement-breakpoint
ALTER TABLE "shop"."order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop"."orders"("id");--> statement-breakpoint
ALTER TABLE "shop"."order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop"."orders"("id");--> statement-breakpoint
ALTER TABLE "shop"."order_lines" ADD CONSTRAINT "order_lines_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shop"."products"("id");--> statement-breakpoint
ALTER TABLE "shop"."orders" ADD CONSTRAINT "orders_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "shop"."customers"("id");--> statement-breakpoint
ALTER TABLE "shop"."payments" ADD CONSTRAINT "payments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop"."orders"("id");--> statement-breakpoint
ALTER TABLE "shop"."products" ADD CONSTRAINT "products_brand_id_brands_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "shop"."brands"("id");--> statement-breakpoint
ALTER TABLE "shop"."products" ADD CONSTRAINT "products_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "shop"."categories"("id");--> statement-breakpoint
ALTER TABLE "shop"."slug_history" ADD CONSTRAINT "slug_history_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shop"."products"("id");--> statement-breakpoint
ALTER TABLE "shop"."stock_moves" ADD CONSTRAINT "stock_moves_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shop"."products"("id");--> statement-breakpoint
ALTER TABLE "shop"."stock_moves" ADD CONSTRAINT "stock_moves_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop"."orders"("id");