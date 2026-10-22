import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientError } from "effect/http";

/**
 * Bounds a call to an outside API and keeps only a reason from its failures,
 * because the request inside them carries the key. Tracing is off for the same reason.
 */
export const callOutside =
  <E>(timeout: Duration.Input, unavailable: (reason: string) => E) =>
  <A, R>(effect: Effect.Effect<A, HttpClientError.HttpClientError | Schema.SchemaError, R>) =>
    effect.pipe(
      Effect.timeout(timeout),
      Effect.catchTags({
        HttpClientError: (error) => Effect.fail(unavailable(error.reason._tag)),
        SchemaError: (error) => Effect.fail(unavailable(error.message)),
        TimeoutError: () => Effect.fail(unavailable("timeout")),
      }),
      Effect.provideService(HttpClient.TracerDisabledWhen, () => true),
    );
