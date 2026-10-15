import { CustomerId, newId } from "@amerik/contracts";
import { sql } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { Database } from "./database.ts";
import { customers } from "./schema.ts";

/**
 * The customer with this phone, created on first order. A known customer
 * keeps their name and takes the newest address.
 */
export const customerByPhone = Effect.fn("customerByPhone")(function* customerByPhone(customer: {
  readonly phone: string;
  readonly name?: string;
  readonly address?: string;
}) {
  const db = yield* Database;

  const [row] = yield* db
    .insert(customers)
    .values({
      ...customer,
      id: yield* newId(CustomerId),
      createdAt: DateTime.toDateUtc(yield* DateTime.now),
    })
    .onConflictDoUpdate({
      target: customers.phone,
      set: {
        name: sql`coalesce(${customers.name}, excluded.name)`,
        address: sql`coalesce(excluded.address, ${customers.address})`,
      },
    })
    .returning({ id: customers.id });

  if (row === undefined) return yield* Effect.die("customerByPhone: the upsert returned no row");

  return row.id;
});
