ALTER TYPE "shop"."product_form" ADD VALUE 'drops' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN "base" text;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN "name_mn" text NOT NULL;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN "label" jsonb;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD CONSTRAINT "products_name" UNIQUE("brand_id","name");--> statement-breakpoint
ALTER TABLE "shop"."products" ADD CONSTRAINT "products_name_mn" UNIQUE("brand_id","name_mn");--> statement-breakpoint
ALTER TABLE "shop"."products" DROP CONSTRAINT "products_identity";--> statement-breakpoint
ALTER TABLE "shop"."products" ADD CONSTRAINT "products_identity" UNIQUE NULLS NOT DISTINCT("brand_id","line","potency","count","form","flavor","base");