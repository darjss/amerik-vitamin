import { CustomerNotFound } from "@amerik/contracts";
import { Database, dieOnDatabaseError, schema } from "@amerik/db";
import { count, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";

const { customers, orders } = schema;

/** The customer behind a phone, with how many orders they placed, for the manual-order draft. */
export const findCustomer = Effect.fn("findCustomer")(function* findCustomer(phone: string) {
  const db = yield* Database;

  const [customer] = yield* db
    .select({
      id: customers.id,
      phone: customers.phone,
      name: customers.name,
      address: customers.address,
      orders: count(orders.id),
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(eq(customers.phone, phone))
    .groupBy(customers.id)
    .pipe(dieOnDatabaseError);

  if (customer === undefined) return yield* new CustomerNotFound({ phone });

  return customer;
});
