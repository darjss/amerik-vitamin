import { Api, CurrentUser, HideDefects } from "@amerik/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { findCustomer } from "./customers";
import { pingDatabase } from "./health";
import { getOrder, home, listOrders } from "./inbox";
import {
  cancelOrder,
  editOrder,
  markDelivered,
  markShipped,
  placeOrder,
  recordPayment,
} from "./orders";
import { listProducts } from "./products";
import { countStock } from "./stock";

/** Every write's actor is the signed-in admin, never a value from the client. */
const actor = CurrentUser.useSync((user) => user.email);

export const ApiHandlers = Api.toLayer({
  health: () => Effect.as(pingDatabase, { database: "ok" as const }),
  listOrders: (input) => listOrders(input),
  getOrder: ({ orderId }) => getOrder(orderId),
  findCustomer: ({ phone }) => findCustomer(phone),
  home: () => home(),
  listProducts: () => listProducts(),
  placeOrder: (input) => Effect.flatMap(actor, (email) => placeOrder(input, email)),
  editOrder: (input) => Effect.flatMap(actor, (email) => editOrder(input, email)),
  recordPayment: (input) => Effect.flatMap(actor, (email) => recordPayment(input, email)),
  markShipped: ({ orderId }) => Effect.flatMap(actor, (email) => markShipped(orderId, email)),
  markDelivered: ({ orderId }) => Effect.flatMap(actor, (email) => markDelivered(orderId, email)),
  cancelOrder: ({ orderId }) => Effect.flatMap(actor, (email) => cancelOrder(orderId, email)),
  countStock: (input) => Effect.flatMap(actor, (email) => countStock(input, email)),
});

export const HideDefectsLive = Layer.succeed(
  HideDefects,
  HideDefects.of((effect) =>
    Effect.catchDefect(effect, (defect) =>
      Effect.logError("rpc defect", defect).pipe(Effect.andThen(Effect.die("internal error"))),
    ),
  ),
);
