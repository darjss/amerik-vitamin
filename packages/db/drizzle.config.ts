import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  migrations: { schema: "shop", table: "migrations" },
  out: "./migrations",
  schema: "./src/schema.ts",
  // Keeps drizzle-kit away from vit-store's tables in the same database.
  schemaFilter: ["shop"],
});
