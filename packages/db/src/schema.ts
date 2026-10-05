import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Every v2 table lives in this Postgres schema. vit-store's `ecom_vit_*`
 * tables share the database in `public` and are never touched.
 */
export const shop = pgSchema("shop");
