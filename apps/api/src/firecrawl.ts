import { ProductLabel } from "@amerik/contracts";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
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

/**
 * The printed label as read off a listing, before we know its source. Firecrawl's
 * `json` format fills it from an Amazon page, the model from an iHerb page.
 */
export const Facts = Schema.Struct({
  ...Struct.omit(ProductLabel.fields, ["source"]),
  servingsPerContainer: Schema.NullOr(Schema.Finite),
});

export type Facts = typeof Facts.Type;

const factsPrompt = `Read this supplement's label as printed, in English: serving size, servings per container,
every Supplement Facts row (name, amount per serving, % daily value or null), other ingredients one per item,
allergens it says it contains, what it says it is free of, suggested use, warnings, and certifications or seals
the listing names (e.g. Non-GMO Project Verified, cGMP, third-party tested). Use null or an empty list for what isn't there, never "None".`;

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

const WebResults = Schema.Struct({
  data: Schema.Struct({
    web: Schema.optional(Schema.Array(Schema.Struct({ url: Schema.String, title: Schema.String }))),
  }),
});

// One iHerb listing shows up under country hosts (uk., ng.) and as /r/ review
// pages; the /pr/ path on www is the product page.
const iherbListing = (url: string) => {
  const path = /^https:\/\/(?:[a-z]+\.)?iherb\.com(\/pr\/[^?#]+)/u.exec(url)?.[1];

  return path === undefined ? null : `https://www.iherb.com${path}`;
};

/**
 * The part of an iHerb page that holds the label: the title, then "Product
 * information" (overview, UPC, suggested use, other ingredients, warnings,
 * Supplement facts table) up to "Similar items to consider". The overview
 * stays because certifications are often only listed there.
 */
const labelPart = (markdown: string) => {
  const start = markdown.indexOf("## Product information");

  if (start === -1) return null;

  const end = markdown.indexOf("## Similar items to consider", start);
  const title = /^# .+$/mu.exec(markdown)?.[0] ?? "";

  return `${title}\n\n${markdown.slice(start, end === -1 ? undefined : end)}`.slice(0, 12_000);
};

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

  const send = <S extends Schema.Top>(answer: S, request: HttpClientRequest.HttpClientRequest) =>
    http.execute(request.pipe(HttpClientRequest.bearerToken(Redacted.value(key)))).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(answer)),
      callOutside("2 minutes", (reason) => new FirecrawlUnavailable({ reason })),
    );

  const scrape = <S extends Schema.Top>(
    data: S,
    url: string,
    formats: ReadonlyArray<"product" | "markdown" | ReturnType<typeof jsonFormat>>,
    options: { readonly onlyMainContent?: boolean } = {},
  ) =>
    send(
      Scraped(data),
      HttpClientRequest.post("https://api.firecrawl.dev/v2/scrape").pipe(
        // Amazon and iHerb show US listings and prices to a US visitor.
        HttpClientRequest.bodyJsonUnsafe({ url, formats, ...options, location: { country: "US" } }),
      ),
    ).pipe(Effect.map((scraped) => scraped.data));

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
    const data = yield* scrape(PageData, url, ["product", jsonFormat(Facts, factsPrompt)]);

    return toPage(url, data);
  });

  /** A web search for iHerb listings, which carry the label and UPC. */
  const searchIherb = Effect.fn("Firecrawl.searchIherb")(function* searchIherb(query: string) {
    const { data } = yield* send(
      WebResults,
      HttpClientRequest.post("https://api.firecrawl.dev/v2/search").pipe(
        HttpClientRequest.bodyJsonUnsafe({ query: `site:iherb.com ${query}`, limit: 5 }),
      ),
    );

    const listings = (data.web ?? []).flatMap((result) => {
      const url = iherbListing(result.url);

      return url === null ? [] : [[url, { url, title: result.title }] as const];
    });

    return [...new Map(listings).values()];
  });

  /** An iHerb listing's label part as markdown. Null when the page has none. */
  const iherbPage = Effect.fn("Firecrawl.iherbPage")(function* iherbPage(url: string) {
    const data = yield* scrape(
      Schema.Struct({ markdown: Schema.optional(Schema.String) }),
      url,
      ["markdown"],
      { onlyMainContent: true },
    );

    return data?.markdown === undefined ? null : labelPart(data.markdown);
  });

  return { searchAmazon, amazonPage, searchIherb, iherbPage };
});

export class Firecrawl extends Context.Service<
  Firecrawl,
  Effect.Success<ReturnType<typeof make>>
>()("amerik/Firecrawl") {
  static readonly layer = (key: Redacted.Redacted) =>
    Layer.effect(Firecrawl, make(key)).pipe(Layer.provide(FetchHttpClient.layer));
}
