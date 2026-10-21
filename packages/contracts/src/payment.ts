import * as Schema from "effect/Schema";

import { BankTransactionId, OrderId } from "./ids.ts";

/** Mom gives an unmatched Khaan transfer to an order by hand. */
export const AssignTransfer = Schema.Struct({
  transferId: BankTransactionId,
  orderId: OrderId,
});

export type AssignTransfer = typeof AssignTransfer.Type;

/** The order's balance is zero or below, so there is nothing to invoice. */
export class NothingOwed extends Schema.TaggedError<NothingOwed>()("NothingOwed", {
  orderId: OrderId,
}) {}

/** QPay didn't answer, or answered something we couldn't read. Offer a bank transfer instead. */
export class QPayUnavailable extends Schema.TaggedError<QPayUnavailable>()("QPayUnavailable", {}) {}

/** The transfer doesn't exist, or it already belongs to a payment. */
export class TransferUnavailable extends Schema.TaggedError<TransferUnavailable>()(
  "TransferUnavailable",
  { transferId: BankTransactionId },
) {}
