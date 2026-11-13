CREATE TABLE "shop"."supplier_order_lines" (
	"order_id" uuid,
	"asin" text,
	"title" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_cost_cents" integer,
	"product_id" uuid,
	"received" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "supplier_order_lines_pkey" PRIMARY KEY("order_id","asin"),
	CONSTRAINT "supplier_order_lines_qty_check" CHECK ("qty" > 0),
	CONSTRAINT "supplier_order_lines_received_check" CHECK ("received" between 0 and "qty")
);
--> statement-breakpoint
CREATE TABLE "shop"."supplier_orders" (
	"id" uuid PRIMARY KEY,
	"number" text NOT NULL UNIQUE,
	"ordered_on" date NOT NULL,
	"total_cents" integer
);
--> statement-breakpoint
CREATE INDEX "supplier_order_lines_product_idx" ON "shop"."supplier_order_lines" ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_order_lines_asin_idx" ON "shop"."supplier_order_lines" ("asin");--> statement-breakpoint
CREATE INDEX "supplier_orders_ordered_on_idx" ON "shop"."supplier_orders" ("ordered_on");--> statement-breakpoint
ALTER TABLE "shop"."supplier_order_lines" ADD CONSTRAINT "supplier_order_lines_order_id_supplier_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop"."supplier_orders"("id");--> statement-breakpoint
ALTER TABLE "shop"."supplier_order_lines" ADD CONSTRAINT "supplier_order_lines_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shop"."products"("id");