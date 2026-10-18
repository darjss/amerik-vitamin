import { claimOutbox, markSent } from "@amerik/db";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

/** The admin bot posts to one chat: mom's and the owner's. Never a customer. */
export const telegramConfig = Config.all({
  token: Config.Redacted("TELEGRAM_ADMIN_BOT_TOKEN"),
  chatId: Config.String("TELEGRAM_ADMIN_CHAT_ID"),
});

/** Telegram refused or never answered. `status` is absent when no response came back. */
export class TelegramUnavailable extends Data.TaggedError("TelegramUnavailable")<{
  readonly status?: number;
}> {}

const Sent = Schema.Struct({ ok: Schema.Literal(true) });

const make = Effect.fn("Telegram.make")(function* make(
  config: Effect.Success<typeof telegramConfig>,
) {
  // Retries only what Telegram rejected (429, 5xx) or never received (a
  // transport error). A timeout may have delivered, so it is not retried here.
  const http = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({
      retryOn: "errors-and-responses",
      schedule: Schedule.exponential("1 second"),
      times: 3,
    }),
  );

  // The bot token is part of the URL, so the request never reaches a log or a span.
  const url = `https://api.telegram.org/bot${Redacted.value(config.token)}/sendMessage`;

  return {
    send: (text: string) =>
      Effect.gen(function* () {
        const response = yield* http.execute(
          HttpClientRequest.post(url).pipe(
            HttpClientRequest.bodyJsonUnsafe({ chat_id: config.chatId, text }),
          ),
        );

        if (response.status !== 200) {
          return yield* new TelegramUnavailable({ status: response.status });
        }

        yield* Schema.decodeUnknownEffect(Sent)(yield* response.json);
      }).pipe(
        Effect.scoped,
        Effect.timeout("20 seconds"),
        Effect.catchIf(
          (error) => !(error instanceof TelegramUnavailable),
          () => Effect.fail(new TelegramUnavailable({})),
        ),
        Effect.provideService(HttpClient.TracerDisabledWhen, () => true),
        Effect.withSpan("Telegram.send"),
      ),
  };
});

export class Telegram extends Context.Service<Telegram, Effect.Success<ReturnType<typeof make>>>()(
  "amerik/Telegram",
) {
  static readonly layer = (config: Effect.Success<typeof telegramConfig>) =>
    Layer.effect(Telegram, make(config)).pipe(Layer.provide(FetchHttpClient.layer));
}

/** Rows one run claims. Ten sends of at most 20 seconds each fit inside the lease. */
const BATCH = 10;

/** Under the 5-minute cron, so rows a failed run left claimed are free again by the next one. */
const LEASE_MINUTES = 4;

/**
 * Sends pending outbox rows to the admin chat, oldest first, and marks each
 * sent. At least once: a row is resent only if the Worker dies between
 * Telegram's answer and `markSent`. When Telegram fails the run stops, and
 * the rest wait out their lease for the next run.
 */
export const dispatchOutbox = Effect.fn("dispatchOutbox")(function* dispatchOutbox() {
  const telegram = yield* Telegram;
  const until = DateTime.add(yield* DateTime.now, { minutes: LEASE_MINUTES });
  const rows = yield* claimOutbox(DateTime.toDateUtc(until), BATCH);
  let sent = 0;

  for (const row of rows) {
    const result = yield* Effect.result(telegram.send(row.text));

    if (Result.isFailure(result)) {
      yield* Effect.logWarning("telegram send failed", { status: result.failure.status });
      break;
    }

    yield* markSent(row.id);
    sent += 1;
  }

  return { claimed: rows.length, sent };
});
