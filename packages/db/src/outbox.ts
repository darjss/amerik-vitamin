import { newId, OutboxId } from "@amerik/contracts";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { Database, dieOnDatabaseError } from "./database.ts";
import { outbox, outboxKind } from "./schema.ts";

/** Failed sends: about four hours of 5-minute cron runs. A row past this stays unsent, for SQL to find. */
const MAX_ATTEMPTS = 50;

/** Queues an admin-chat message. Call it inside the transaction of the change it reports. */
export const notify = Effect.fn("notify")(function* notify(
  kind: (typeof outboxKind.enumValues)[number],
  text: string,
) {
  const db = yield* Database;

  yield* db.insert(outbox).values({
    id: yield* newId(OutboxId),
    kind,
    text,
    createdAt: DateTime.toDateUtc(yield* DateTime.now),
  });
});

/**
 * Claims up to `limit` unsent rows until `until`, oldest first, in one
 * statement. `SKIP LOCKED` and the lease keep two dispatchers off the same
 * row, so only a crash between sending and `markSent` sends a row twice.
 */
export const claimOutbox = Effect.fn("claimOutbox")(function* claimOutbox(
  until: Date,
  limit: number,
) {
  const db = yield* Database;
  const now = DateTime.toDateUtc(yield* DateTime.now);

  const due = db
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        isNull(outbox.sentAt),
        lt(outbox.attempts, MAX_ATTEMPTS),
        or(isNull(outbox.claimedUntil), lt(outbox.claimedUntil, now)),
      ),
    )
    .orderBy(asc(outbox.createdAt))
    .limit(limit)
    .for("update", { skipLocked: true });

  const rows = yield* db
    .update(outbox)
    .set({ claimedUntil: until })
    .where(inArray(outbox.id, due))
    .returning({ id: outbox.id, text: outbox.text });

  // RETURNING has no order. UUIDv7 ids sort by creation time.
  return rows.toSorted((a, b) => a.id.localeCompare(b.id));
}, dieOnDatabaseError);

export const markSent = Effect.fn("markSent")(function* markSent(id: OutboxId) {
  const db = yield* Database;

  yield* db
    .update(outbox)
    .set({ sentAt: DateTime.toDateUtc(yield* DateTime.now) })
    .where(eq(outbox.id, id));
}, dieOnDatabaseError);

/** Counts a failed send. A row the run never tried keeps its count. */
export const markFailed = Effect.fn("markFailed")(function* markFailed(id: OutboxId) {
  const db = yield* Database;

  yield* db
    .update(outbox)
    .set({ attempts: sql`${outbox.attempts} + 1` })
    .where(eq(outbox.id, id));
}, dieOnDatabaseError);
