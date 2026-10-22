import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { callOutside } from "./outside";

export const firecrawlConfig = Config.Redacted("FIRECRAWL_API_KEY");

export class FirecrawlUnavailable extends Data.TaggedError("FirecrawlUnavailable")<{
  readonly reason: string;
}> {}

// Firecrawl v2 `product` format: Firecrawl's own product extractor. It returns
// the listing's title, brand, category, price and full-size gallery for 1 credit.
const Product = Schema.Struct({
  title: Schema.String,
  brand: Schema.optional(Schema.NullOr(Schema.String)),
  category: Schema.optional(Schema.NullOr(Schema.String)),
  url: Schema.optional(Schema.String),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  variants: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.optional(Schema.NullOr(Schema.String)),
        price: Schema.optional(Schema.NullOr(Schema.Struct({ amount: Schema.Number }))),
        images: Schema.optional(Schema.Array(Schema.Struct({ url: Schema.String }))),
      }),
    ),
  ),
});

/** The label facts Firecrawl's `json` format reads off the page for us. */
const Facts = Schema.Struct({
  servingSize: Schema.String.annotate({ description: "Serving size as printed, e.g. 2 capsules" }),
  servingsPerContainer: Schema.NullOr(Schema.Finite),
  supplementFacts: Schema.Array(
    Schema.Struct({ name: Schema.String, amount: Schema.String }),
  ).annotate({ description: "Supplement Facts rows with the amount per serving" }),
  directions: Schema.String.annotate({ description: "Suggested use as printed" }),
  otherIngredients: Schema.String,
  freeOf: Schema.Array(Schema.String).annotate({
    description: "What the label says it is free of",
  }),
});

export type Facts = typeof Facts.Type;

const SearchResults = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({ asin: Schema.String, title: Schema.String, sponsored: Schema.Boolean }),
  ),
});

/** Firecrawl checks a `json` schema OpenAI-strict style: every key required, no others allowed. */
const jsonFormat = (schema: Schema.Top, prompt: string) => ({
  type: "json" as const,
  schema: Schema.toJsonSchemaDocument(schema, { onExcessProperty: "error" }).schema,
  prompt,
});

const Scraped = <S extends Schema.Top>(data: S) =>
  Schema.Struct({ success: Schema.Boolean, data: Schema.optional(data) });

const PageData = Schema.Struct({
  product: Schema.optional(Schema.NullOr(Product)),
  json: Schema.optional(Facts),
  metadata: Schema.optional(Schema.Struct({ url: Schema.optional(Schema.String) })),
});

const asinOf = (url: string) => /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/u.exec(url)?.[1];

/**
 * Amazon lists each photo twice: a full-size `_SL1500_` file and a small one
 * under another ID. The full-size ones are the gallery; the rest are thumbnails.
 */
const gallery = (urls: ReadonlyArray<string>) => {
  const large = urls.filter((url) => url.includes("_SL1500_"));

  return [...new Set(large.length > 0 ? large : urls)].slice(0, 10);
};

/** The listing as the drafting workflow needs it. Null when it isn't a product page. */
const toPage = (url: string, data: typeof PageData.Type | undefined) => {
  const product = data?.product;

  if (product === undefined || product === null) return null;

  const variant = product.variants?.[0];

  const asin =
    asinOf(data?.metadata?.url ?? product.url ?? url) ?? asinOf(url) ?? variant?.id ?? null;

  if (asin === null) return null;

  return {
    asin,
    url: `https://www.amazon.com/dp/${asin}`,
    title: product.title,
    brand: product.brand ?? null,
    category: product.category ?? null,
    cents: variant?.price ? Math.round(variant.price.amount * 100) : null,
    description: product.description ?? "",
    images: gallery((variant?.images ?? []).map((image) => image.url)),
    facts: data?.json ?? null,
  };
};

export type AmazonPage = NonNullable<ReturnType<typeof toPage>>;

const make = Effect.fn("Firecrawl.make")(function* make(key: Redacted.Redacted) {
  // 429 means wait; Firecrawl's rate limit is per minute.
  const http = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({ schedule: Schedule.exponential("5 seconds"), times: 4 }),
    HttpClient.filterStatusOk,
  );

  const scrape = <S extends Schema.Top>(
    data: S,
    url: string,
    formats: ReadonlyArray<"product" | ReturnType<typeof jsonFormat>>,
  ) =>
    Effect.gen(function* () {
      const response = yield* http.execute(
        HttpClientRequest.post("https://api.firecrawl.dev/v2/scrape").pipe(
          HttpClientRequest.bearerToken(Redacted.value(key)),
          // Amazon shows US listings and prices to a US visitor.
          HttpClientRequest.bodyJsonUnsafe({ url, formats, location: { country: "US" } }),
        ),
      );

      return (yield* HttpClientResponse.schemaBodyJson(Scraped(data))(response)).data;
    }).pipe(callOutside("2 minutes", (reason) => new FirecrawlUnavailable({ reason })));

  /** Amazon's own search, read into a result list. It finds far more than a web search. */
  const searchAmazon = Effect.fn("Firecrawl.searchAmazon")(function* searchAmazon(query: string) {
    const data = yield* scrape(
      Schema.Struct({ json: Schema.optional(SearchResults) }),
      `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
      [
        jsonFormat(
          SearchResults,
          "List the product search results in page order, with each one's ASIN.",
        ),
      ],
    );

    return (data?.json?.results ?? []).filter((result) => /^[A-Z0-9]{10}$/u.test(result.asin));
  });

  /** One listing: Firecrawl's product extractor plus the supplement facts. */
  const amazonPage = Effect.fn("Firecrawl.amazonPage")(function* amazonPage(url: string) {
    const data = yield* scrape(PageData, url, [
      "product",
      jsonFormat(
        Facts,
        "Read the Supplement Facts panel and the label details of this supplement.",
      ),
    ]);

    return toPage(url, data);
  });

  return { searchAmazon, amazonPage };
});

export class Firecrawl extends Context.Service<
  Firecrawl,
  Effect.Success<ReturnType<typeof make>>
>()("amerik/Firecrawl") {
  static readonly layer = (key: Redacted.Redacted) =>
    Layer.effect(Firecrawl, make(key)).pipe(Layer.provide(FetchHttpClient.layer));
}
