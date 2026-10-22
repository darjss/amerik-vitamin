import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";

import { Authenticated } from "./auth.ts";
import { Home } from "./home.ts";
import { OrderId, OrderNumber, PaymentId, ProductId } from "./ids.ts";
import {
  Customer,
  CustomerNotFound,
  EditOrder,
  InvalidOrder,
  ListOrders,
  ManualPayment,
  OrderAction,
  OrderCounts,
  OrderDetail,
  OrderNotFound,
  OrderStatus,
  OrderSummary,
  PaymentConflict,
  Phone,
  PlaceOrder,
  RefundExceedsPaid,
  WrongOrderStatus,
} from "./order.ts";
import {
  ArchiveProduct,
  CountStock,
  ProductDetail,
  ProductRow,
  ProductUnavailable,
  ReceiveStock,
  SetPrice,
} from "./product.ts";

export class DatabaseUnavailable extends Schema.TaggedError<DatabaseUnavailable>()(
  "DatabaseUnavailable",
  {},
) {}

/**
 * Server side only. `RpcServer` sends a defect to the client with its message,
 * so every RPC dies with a bare "internal error" and the server logs the real one.
 */
export class HideDefects extends RpcMiddleware.Service<HideDefects>()("amerik/HideDefects") {}

const OrderWrite = Schema.Union([OrderNotFound, WrongOrderStatus]);

/** Mom's dashboard. Each call needs a session for an allowlisted Google email. */
const Dashboard = RpcGroup.make(
  Rpc.make("listOrders", { payload: ListOrders, success: Schema.Array(OrderSummary) }),
  Rpc.make("getOrder", { payload: OrderAction, success: OrderDetail, error: OrderNotFound }),
  Rpc.make("findCustomer", {
    payload: { phone: Phone },
    success: Customer,
    error: CustomerNotFound,
  }),
  Rpc.make("home", { success: Home }),
  Rpc.make("orderCounts", { success: OrderCounts }),
  Rpc.make("listProducts", { success: Schema.Array(ProductRow) }),
  Rpc.make("placeOrder", {
    payload: PlaceOrder,
    success: Schema.Struct({ orderId: OrderId, number: OrderNumber, total: Schema.Int }),
    error: Schema.Union([InvalidOrder, ProductUnavailable]),
  }),
  Rpc.make("editOrder", {
    payload: EditOrder,
    success: Schema.Struct({ total: Schema.Int, status: OrderStatus }),
    error: Schema.Union([OrderNotFound, WrongOrderStatus, InvalidOrder, ProductUnavailable]),
  }),
  Rpc.make("recordPayment", {
    payload: ManualPayment,
    success: Schema.Struct({ paymentId: PaymentId, status: OrderStatus }),
    // PaymentConflict needs a provider ref, which a manual payment never has.
    error: Schema.Union([OrderNotFound, RefundExceedsPaid, PaymentConflict]),
  }),
  Rpc.make("markShipped", { payload: OrderAction, error: OrderWrite }),
  Rpc.make("markDelivered", { payload: OrderAction, error: OrderWrite }),
  Rpc.make("cancelOrder", { payload: OrderAction, error: OrderWrite }),
  Rpc.make("countStock", {
    payload: CountStock,
    success: Schema.Struct({ stock: Schema.Int, change: Schema.Int }),
    error: ProductUnavailable,
  }),
  Rpc.make("getProduct", {
    payload: { productId: ProductId },
    success: ProductDetail,
    error: ProductUnavailable,
  }),
  Rpc.make("receiveStock", {
    payload: ReceiveStock,
    success: Schema.Struct({ stock: Schema.Int }),
    error: ProductUnavailable,
  }),
  Rpc.make("setPrice", { payload: SetPrice, error: ProductUnavailable }),
  Rpc.make("archiveProduct", { payload: ArchiveProduct, error: ProductUnavailable }),
).middleware(Authenticated);

export class Api extends RpcGroup.make(
  Rpc.make("health", {
    error: DatabaseUnavailable,
    success: Schema.Struct({ database: Schema.Literal("ok") }),
  }),
)
  .merge(Dashboard)
  .middleware(HideDefects) {}
