import {
  Fulfillment,
  OrderEventType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentTerms,
  ProductForm,
  StockMoveReason,
} from "@amerik/contracts";
import type {
  BrandId,
  CategoryId,
  CustomerId,
  OrderEventData,
  OrderEventId,
  OrderId,
  OrderNumber,
  PaymentId,
  ProductId,
  StockMoveId,
} from "@amerik/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Every v2 table lives in this Postgres schema. vit-store's `ecom_vit_*`
 * tables share the database in `public` and are never touched.
 *
 * Rules behind these tables: docs/COMMERCE-RULES.md. Ids come from
 * `@amerik/contracts` (UUIDv7, made in the app), and so do times: no column
 * defaults to `now()`, because `TestClock` can't move the database's clock.
 */
export const shop = pgSchema("shop");

export const productForm = shop.enum("product_form", ProductForm.literals);

export const orderStatus = shop.enum("order_status", OrderStatus.literals);

export const paymentTerms = shop.enum("payment_terms", PaymentTerms.literals);

export const orderSource = shop.enum("order_source", OrderSource.literals);

export const fulfillment = shop.enum("fulfillment", Fulfillment.literals);

export const paymentMethod = shop.enum("payment_method", PaymentMethod.literals);

export const orderEventType = shop.enum("order_event_type", OrderEventType.literals);

export const stockMoveReason = shop.enum("stock_move_reason", StockMoveReason.literals);

export const brands = shop.table("brands", {
  id: uuid("id").$type<BrandId>().primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const categories = shop.table("categories", {
  id: uuid("id").$type<CategoryId>().primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/** One sellable SKU (ADR 0003). `stock` and `cost` are null until counted or received. */
export const products = shop.table(
  "products",
  {
    id: uuid("id").$type<ProductId>().primaryKey(),
    brandId: uuid("brand_id")
      .$type<BrandId>()
      .notNull()
      .references(() => brands.id),
    categoryId: uuid("category_id")
      .$type<CategoryId>()
      .notNull()
      .references(() => categories.id),
    line: text("line").notNull(),
    potency: text("potency"),
    count: integer("count").notNull(),
    form: productForm("form").notNull(),
    flavor: text("flavor"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    price: integer("price").notNull(),
    stock: integer("stock"),
    cost: integer("cost"),
    asin: text("asin").unique(),
    gtin: text("gtin").unique(),
    servingSize: integer("serving_size"),
    servings: integer("servings"),
    dailyUnits: integer("daily_units"),
    images: text("images")
      .array()
      .notNull()
      .default(sql`'{}'`),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("products_identity")
      .on(table.brandId, table.line, table.potency, table.count, table.form, table.flavor)
      .nullsNotDistinct(),
    index("products_category_idx").on(table.categoryId),
    check("products_price_check", sql`${table.price} >= 0`),
    check("products_count_check", sql`${table.count} > 0`),
  ],
);

/** Every slug a product used to have. Each one 301s to the product. */
export const slugHistory = shop.table("slug_history", {
  slug: text("slug").primaryKey(),
  productId: uuid("product_id")
    .$type<ProductId>()
    .notNull()
    .references(() => products.id),
});

export const customers = shop.table(
  "customers",
  {
    id: uuid("id").$type<CustomerId>().primaryKey(),
    phone: text("phone").unique(),
    name: text("name"),
    address: text("address"),
    legacyId: integer("legacy_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [check("customers_phone_check", sql`${table.phone} ~ '^[0-9]{8}$'`)],
);

/** Balance is total minus the sum of payments, computed on read. */
export const orders = shop.table(
  "orders",
  {
    id: uuid("id").$type<OrderId>().primaryKey(),
    number: integer("number")
      .$type<OrderNumber>()
      .notNull()
      .unique()
      .generatedAlwaysAsIdentity({ startWith: 10000 }),
    customerId: uuid("customer_id")
      .$type<CustomerId>()
      .references(() => customers.id),
    status: orderStatus("status").notNull(),
    terms: paymentTerms("terms").notNull(),
    source: orderSource("source").notNull(),
    fulfillment: fulfillment("fulfillment").notNull(),
    address: text("address"),
    notes: text("notes"),
    deliveryFee: integer("delivery_fee").notNull(),
    total: integer("total").notNull(),
    legacyId: integer("legacy_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("orders_status_created_idx").on(table.status, table.createdAt),
    index("orders_customer_idx").on(table.customerId),
  ],
);

/** The price is frozen when the order is placed. `unit_cost` is set when stock moves. */
export const orderLines = shop.table(
  "order_lines",
  {
    orderId: uuid("order_id")
      .$type<OrderId>()
      .notNull()
      .references(() => orders.id),
    productId: uuid("product_id")
      .$type<ProductId>()
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    unitCost: integer("unit_cost"),
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.productId] }),
    index("order_lines_product_idx").on(table.productId),
    check("order_lines_quantity_check", sql`${table.quantity} > 0`),
    check("order_lines_unit_price_check", sql`${table.unitPrice} >= 0`),
  ],
);

/** A negative amount is a refund. `provider_ref` makes a QPay or Khaan transaction count once. */
export const payments = shop.table(
  "payments",
  {
    id: uuid("id").$type<PaymentId>().primaryKey(),
    orderId: uuid("order_id")
      .$type<OrderId>()
      .notNull()
      .references(() => orders.id),
    amount: integer("amount").notNull(),
    method: paymentMethod("method").notNull(),
    providerRef: text("provider_ref").unique(),
    actor: text("actor").notNull(),
    legacyId: integer("legacy_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("payments_order_idx").on(table.orderId),
    check("payments_amount_check", sql`${table.amount} <> 0`),
  ],
);

/** The order timeline and the [undo] trail. Rows are only ever inserted. */
export const orderEvents = shop.table(
  "order_events",
  {
    id: uuid("id").$type<OrderEventId>().primaryKey(),
    orderId: uuid("order_id")
      .$type<OrderId>()
      .notNull()
      .references(() => orders.id),
    type: orderEventType("type").notNull(),
    actor: text("actor").notNull(),
    data: jsonb("data").$type<OrderEventData>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("order_events_order_idx").on(table.orderId, table.createdAt)],
);

/**
 * better-auth's four tables, for dashboard sign-in. better-auth writes every
 * row and its timestamps; apps/api/src/auth.ts gives it UUIDv4 ids. Nothing
 * outside that file reads them.
 */
export const users = shop.table("users", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const sessions = shop.table(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const accounts = shop.table(
  "accounts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("accounts_user_idx").on(table.userId)],
);

export const verifications = shop.table(
  "verifications",
  {
    id: uuid("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

/**
 * One row per change to `products.stock`, written in the same transaction.
 * `change` may be 0: a first count that finds nothing still turns null stock into 0.
 */
export const stockMoves = shop.table(
  "stock_moves",
  {
    id: uuid("id").$type<StockMoveId>().primaryKey(),
    productId: uuid("product_id")
      .$type<ProductId>()
      .notNull()
      .references(() => products.id),
    change: integer("change").notNull(),
    reason: stockMoveReason("reason").notNull(),
    orderId: uuid("order_id")
      .$type<OrderId>()
      .references(() => orders.id),
    note: text("note"),
    actor: text("actor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("stock_moves_product_idx").on(table.productId, table.createdAt)],
);
