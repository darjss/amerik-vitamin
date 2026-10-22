import { Api, CurrentUser, HideDefects } from "@amerik/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { findCustomer } from "./customers";
import { pingDatabase } from "./health";
import { getOrder, home, listOrders, orderCounts } from "./inbox";
import {
  cancelOrder,
  editOrder,
  markDelivered,
  markShipped,
  placeOrder,
  recordPayment,
} from "./orders";
import { getDraft, startDraft } from "./drafts";
import {
  archiveProduct,
  catalogOptions,
  createProduct,
  getProduct,
  listProducts,
  setPrice,
} from "./products";
import { countStock, receiveStock } from "./stock";

/** Every write's actor is the signed-in admin, never a value from the client. */
const withActor = <A, E, R>(write: (actor: string) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(
    CurrentUser.useSync((user) => user.email),
    write,
  );

export const ApiHandlers = Api.toLayer({
  health: () => Effect.as(pingDatabase, { database: "ok" as const }),
  listOrders: (input) => listOrders(input),
  getOrder: ({ orderId }) => getOrder(orderId),
  findCustomer: ({ phone }) => findCustomer(phone),
  home: () => home(),
  orderCounts: () => orderCounts(),
  listProducts: () => listProducts(),
  placeOrder: (input) => withActor((actor) => placeOrder(input, actor)),
  editOrder: (input) => withActor((actor) => editOrder(input, actor)),
  recordPayment: (input) => withActor((actor) => recordPayment(input, actor)),
  markShipped: ({ orderId }) => withActor((actor) => markShipped(orderId, actor)),
  markDelivered: ({ orderId }) => withActor((actor) => markDelivered(orderId, actor)),
  cancelOrder: ({ orderId }) => withActor((actor) => cancelOrder(orderId, actor)),
  countStock: (input) => withActor((actor) => countStock(input, actor)),
  getProduct: ({ productId }) => getProduct(productId),
  receiveStock: (input) => withActor((actor) => receiveStock(input, actor)),
  setPrice: (input) => setPrice(input),
  catalogOptions: () => catalogOptions(),
  startDraft: ({ source }) => startDraft(source),
  getDraft: ({ draftId }) => getDraft(draftId),
  createProduct: (input) => withActor((actor) => createProduct(input, actor)),
  archiveProduct: (input) => archiveProduct(input),
});

export const HideDefectsLive = Layer.succeed(
  HideDefects,
  HideDefects.of((effect) =>
    Effect.catchDefect(effect, (defect) =>
      Effect.logError("rpc defect", defect).pipe(Effect.andThen(Effect.die("internal error"))),
    ),
  ),
);
