import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

/**
 * The OpenAI-compatible endpoint the drafting models answer on. Today that's
 * the owner's CLIProxyAPI behind a Cloudflare tunnel (docs/plan/01-launch.md),
 * with a key of its own so it can be revoked alone.
 */
export const modelConfig = Config.all({
  url: Config.String("MODEL_BASE_URL"),
  key: Config.Redacted("MODEL_API_KEY"),
});

/** Fields and photo picks: fast, reads images. */
export const FAST = "gpt-6-luna";

/** Mongolian copy: the bakeoff's most natural writer. */
export const WRITER = "gpt-6-sol";

/** The model refused, timed out, or answered something that didn't decode. The workflow retries. */
export class ModelUnavailable extends Data.TaggedError("ModelUnavailable")<{
  readonly reason: string;
}> {}

export type Part =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image_url"; readonly image_url: { readonly url: string } };

const Completion = Schema.Struct({
  choices: Schema.NonEmptyArray(
    Schema.Struct({ message: Schema.Struct({ content: Schema.String }) }),
  ),
});

const make = Effect.fn("Model.make")(function* make(config: Effect.Success<typeof modelConfig>) {
  const http = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
  const url = `${config.url.replace(/\/$/u, "")}/chat/completions`;

  /** One JSON answer, decoded by `schema`. The prompt names the shape; decoding enforces it. */
  const json = <S extends Schema.Top>(
    schema: S,
    content: string | ReadonlyArray<Part>,
    model = FAST,
  ) =>
    Effect.gen(function* () {
      const response = yield* http.execute(
        HttpClientRequest.post(url).pipe(
          HttpClientRequest.bearerToken(Redacted.value(config.key)),
          HttpClientRequest.bodyJsonUnsafe({
            model,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content }],
          }),
        ),
      );

      const completion = yield* HttpClientResponse.schemaBodyJson(Completion)(response);

      return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(
        completion.choices[0].message.content,
      );
    }).pipe(
      Effect.timeout("3 minutes"),
      // Only a reason leaves: the request carries the key.
      Effect.catchTags({
        HttpClientError: (error) =>
          Effect.fail(new ModelUnavailable({ reason: error.reason._tag })),
        SchemaError: (error) => Effect.fail(new ModelUnavailable({ reason: error.message })),
        TimeoutError: () => Effect.fail(new ModelUnavailable({ reason: "timeout" })),
      }),
      Effect.provideService(HttpClient.TracerDisabledWhen, () => true),
    );

  return { json };
});

export class Model extends Context.Service<Model, Effect.Success<ReturnType<typeof make>>>()(
  "amerik/Model",
) {
  static readonly layer = (config: Effect.Success<typeof modelConfig>) =>
    Layer.effect(Model, make(config)).pipe(Layer.provide(FetchHttpClient.layer));
}
