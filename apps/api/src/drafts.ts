import { DraftId, DraftNotFound, ProductDraft, ProductForm } from "@amerik/contracts";
import type { DraftSource } from "@amerik/contracts";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import { Base64 } from "effect/encoding";
import { FetchHttpClient, HttpClient, HttpServerRequest, HttpServerResponse } from "effect/http";

import { imageOrigin, ProductImages } from "../infra/images";
import type { AmazonPage } from "./firecrawl";
import { Facts, Firecrawl, firecrawlConfig } from "./firecrawl";
import type { Part } from "./model";
import { Model, modelConfig, WRITER } from "./model";
import { catalogOptions, existingProduct } from "./products";

// Turns an Amazon link or a bottle photo into a filled-in new-product form.
// Each step is a Workflow step: Cloudflare stores its result, retries it on
// failure, and a restart picks up after the last finished one.

export type DraftInput = {
  readonly source:
    | { readonly _tag: "amazon"; readonly url: string }
    | { readonly _tag: "photo"; readonly key: string };
  /** The shop's categories and brands, so the model picks from what exists. */
  readonly categories: ReadonlyArray<{ readonly slug: string; readonly name: string }>;
  readonly brands: ReadonlyArray<string>;
};

const retried = { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } } as const;

/** What the model reads off a bottle photo. */
const Bottle = Schema.Struct({
  brand: Schema.String,
  product: Schema.String,
  strength: Schema.String,
  count: Schema.NullOr(Schema.Int),
  query: Schema.String,
});

type Bottle = typeof Bottle.Type;

const Fields = Schema.Struct({
  brand: Schema.String,
  category: Schema.String,
  line: Schema.String,
  potency: Schema.NullOr(Schema.String),
  count: Schema.Int,
  form: ProductForm,
  flavor: Schema.NullOr(Schema.String),
  base: Schema.NullOr(Schema.String),
  servingSize: Schema.NullOr(Schema.Int),
  servings: Schema.NullOr(Schema.Int),
  dailyUnits: Schema.NullOr(Schema.Int),
});

type Fields = typeof Fields.Type;

const Copy = Schema.Struct({
  description: Schema.String,
  note: Schema.String,
  lineMn: Schema.String,
  flavorMn: Schema.NullOr(Schema.String),
  baseMn: Schema.NullOr(Schema.String),
});

const Indexes = Schema.Struct({ indexes: Schema.Array(Schema.Int) });

const Same = Schema.Struct({ same: Schema.Boolean, why: Schema.String });

/** The model's verdict on one iHerb listing, and the label it reads off it. */
const IherbLabel = Schema.Struct({
  same: Schema.Boolean,
  why: Schema.String,
  gtin: Schema.NullOr(Schema.String),
  label: Facts,
});

const readBottlePrompt = `This is a photo of a dietary supplement bottle or box.
Read the label. Return JSON:
{"brand": "brand as printed", "product": "product name as printed, with the carrier oil if the label names one", "strength": "amount per serving as printed, or empty",
 "count": units in the bottle as an integer or null, "query": "an Amazon search for this exact bottle: brand, product, strength, count"}`;

const pickPrompt = (wanted: string, store: string, results: ReadonlyArray<{ title: string }>) =>
  `We want this exact product: ${wanted}
${store} search results:
${results.map((result, index) => `${index} | ${result.title}`).join("\n")}

Which results could be this exact product: same brand, same strength, one bottle with the same count? A multi-pack or another count is not it. A title that leaves out the strength can still be it.
Return {"indexes": [up to 3 result numbers, most likely first]}, or an empty list.`;

const samePrompt = (wanted: string, page: AmazonPage) =>
  `We want this exact product: ${wanted}
Amazon page: ${JSON.stringify({ title: page.title, brand: page.brand, facts: page.facts })}
Is the page this exact product: same brand, same strength, one bottle with the same count, and the same carrier oil when ours names one? Return {"same": boolean, "why": "short reason"}.`;

const iherbPrompt = (wanted: string, listing: string) =>
  `We want this exact product:
${wanted}

An iHerb listing, as markdown:
${listing}

Is the listing this exact product? It must have the same brand, the same amount of each active ingredient per serving, the same count and the same form.
When the product we want lists other ingredients, the carrier oil must be the same too: the same vitamins in sunflower seed oil and in coconut oil are two different products.
Then read the listing's label as printed, in English, whether or not it is the same product.
Return JSON:
{"same": boolean, "why": "short reason",
 "gtin": "the UPC digits from the listing, or null",
 "label": {"servingSize": "as printed, e.g. 2 Softgels", "servingsPerContainer": number or null,
  "facts": [{"name": "Supplement Facts row name as printed", "amount": "amount per serving as printed", "dailyValue": "% daily value as printed, † when not established, or null when blank"}],
  "otherIngredients": ["each other ingredient as printed"],
  "allergens": ["what the label says it contains, e.g. Fish (anchovy), Soy"],
  "freeOf": ["what the label says it is free of, e.g. Gluten, Dairy"],
  "suggestedUse": "as printed, or null", "warnings": "as printed, or null",
  "certifications": ["seals and certifications the listing names, e.g. Non-GMO Project Verified, cGMP, third-party tested"]}}`;

const fieldsPrompt = (facts: string, input: DraftInput) => `Supplement product facts:
${facts}

The label, when there is one, is the source of truth for amounts, serving size, servings and ingredients.
Return the shop's catalog fields as JSON:
{"brand": "the brand; when it is one of ${JSON.stringify(input.brands)}, spell it exactly that way",
 "category": one of ${input.categories.map((category) => `"${category.slug}" (${category.name})`).join(", ")},
 "line": "the product line in English, e.g. Magnesium Glycinate",
 "potency": "the main amount or amounts per serving, e.g. 5,000 IU / 100 mcg, or null",
 "count": how many the bottle holds as an integer,
 "form": one of ${ProductForm.literals.map((form) => `"${form}"`).join(", ")},
 "flavor": "flavor if it has one, else null",
 "base": "the carrier oil, or null",
 "servingSize": units per serving as an integer or null,
 "servings": servings per container as an integer or null,
 "dailyUnits": units per day as an integer or null}
Rules:
- line: without brand, strength, count, form, flavor or carrier oil, and without marketing words like High Absorption or Advanced unless they are the trade name. Keep a trade name whole, with words like Kid's in it (Ultimate Omega, Super Enzymes, PepZin GI, Kid's Super Daily D3 + K2).
- potency: one consistent style, numbers with thousands commas, one unit per amount (IU when the label gives both mcg and IU), several actives joined with " / " in label order, no words like "per serving" or "per capsule", e.g. "5,000 IU / 100 mcg", "1,500 mg / 1,200 mg / 1,000 mg". Null only for a blend with no headline amount.
- form "drops" is a dropper bottle; count is then the drops in the bottle. Other liquids are "liquid" with count in mL. A powder's count is its grams. Otherwise count is the pieces.
- servingSize is units per serving, servings is servings per container, dailyUnits is units per day at the label's lowest stated adult dose (servingSize times the times per day).
- base: the carrier oil when the active ingredient sits in one, e.g. "sunflower seed oil", "coconut oil", "MCT oil", "olive oil", "soybean oil". Null when the oil is itself the product (fish oil, krill oil) or there is no carrier.
- Use "kids" only for a product made for children.`;

// Health claims are the line this shop never crosses (AGENTS.md). Any of
// these sends the copy back once; a second hit goes to her form as `bannedWords`.
const claims =
  /дэмж|сайжруул|хамгаал|эмчил|урьдчилан сэргийл|дархлаа|эрүүл мэнд|үр дүн|тайвшруул|бэхжүүл|нөхөн сэргээ|—|–|[“”‘’]|!/giu;

const bannedIn = (description: string) => [...new Set(description.match(claims) ?? [])];

const copyPrompt = (
  facts: string,
  fields: Fields,
  retry: ReadonlyArray<string>,
) => `Write a product description in Mongolian (Cyrillic) for a small Ulaanbaatar shop that sells American supplements. Customers read it on their phones.

Use only these facts from the product's label. Never add an ingredient, amount, certification or origin that isn't there.
${facts}

Three short paragraphs, 60 to 120 words in all:
1. What it is: the brand, the main ingredient in Mongolian, the form, the amount per serving as on the label, and how many units. If the facts give servings, say how long one bottle lasts at the label's dose.
2. What's inside: the supplement facts per serving. When a compound and its elemental amount both appear, give both so nobody reads more than there is.
3. How to take it, as the label says, and who it's for if the label says. Mention what it's free of only if the label lists it.

Rules:
- No health claims. Never say what it does for the body, sleep, mood, immunity, energy, bones, joints, skin, heart or brain. Words like дэмжинэ, сайжруулна, хамгаална, эмчилнэ, дархлаа, эрүүл мэнд are banned.
- No praise words, no exclamation marks, no emojis, no dashes as punctuation, no curly quotes. Plain text paragraphs, no markdown.
- Natural Mongolian, addressing the reader as "та". Brand and trade names stay in Latin letters. Units as on the label: мг, мкг, IU.
- A serving is "нэг удаагийн хэмжээ". Translate ingredient sources into Mongolian.
- If facts disagree (servings times serving size isn't the count), trust the count, skip the days estimate, and explain the conflict in "note" in Mongolian. Never mention it in the description.
${retry.length > 0 ? `\nYour last version used banned words or characters: ${retry.join(", ")}. Rewrite without them.` : ""}
Also put the shop's catalog fields into natural Mongolian Cyrillic, brand and trade names in Latin letters:
line ${JSON.stringify(fields.line)}, flavor ${JSON.stringify(fields.flavor)}, carrier oil ${JSON.stringify(fields.base)}.
Return JSON: {"description": "...", "note": "a doubt for the shop owner in Mongolian, or empty",
 "lineMn": "the line alone, without form, strength, count, flavor or oil, e.g. Магнийн глицинат, Д3 + К2 аминдэм; a trade name stays whole in Latin, e.g. Ultimate Omega, Kid's Super Daily D3 + K2",
 "flavorMn": "the flavor as a noun that reads before амттай, e.g. Нимбэг, or null when there is no flavor",
 "baseMn": "the carrier oil as short as the English, in the form that says where it sits, e.g. кокосын тосонд, MCT тосонд, or null when there is no carrier oil"}`;

const photosPrompt = `These are one supplement's Amazon photos, numbered from 0.
Keep only photos where the product is the subject: the bottle or box from the front, back or side, the label, the supplement facts panel, or capsules next to the bottle.
Drop lifestyle photos with people, brand-story, sustainability, partner or charity banners, infographics that list benefits or health effects, comparison charts, and near-duplicates of a photo you keep.
Put the clearest front-of-bottle photo first. Keep at least one if any shows the bottle.
Return {"indexes": [photo numbers in display order]}.`;

const describe = (bottle: Bottle) =>
  [
    bottle.brand,
    bottle.product,
    bottle.strength,
    bottle.count === null ? "" : `${bottle.count} count`,
  ]
    .filter(Boolean)
    .join(" ");

/** The photo read, the Amazon page and the printed label, as the facts the field and copy prompts get. */
const factsText = (
  bottle: Bottle | null,
  page: AmazonPage | null,
  printed: Effect.Success<ReturnType<typeof findLabel>>,
) =>
  JSON.stringify(
    {
      bottlePhoto: bottle,
      amazon: page && {
        title: page.title,
        brand: page.brand,
        category: page.category,
        description: page.description.slice(0, 3000),
      },
      label: printed && { ...printed.label, servingsPerContainer: printed.servingsPerContainer },
    },
    null,
    1,
  );

type Bucket = Cloudflare.R2.ReadWriteBucketClient;

const readBottle = (bucket: Bucket, key: string) =>
  Effect.gen(function* () {
    const object = yield* bucket.get(key);

    if (object === null) return yield* Effect.die(`draft photo ${key} is gone`);

    const jpeg = Base64.encode(yield* object.bytes());

    const content: ReadonlyArray<Part> = [
      { type: "text", text: readBottlePrompt },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg}` } },
    ];

    return yield* (yield* Model).json(Bottle, content);
  });

/** Amazon search, the model's picks, then each pick's page checked against the photo. */
const findOnAmazon = (bottle: Bottle) =>
  Effect.gen(function* () {
    const firecrawl = yield* Firecrawl;
    const model = yield* Model;
    const wanted = describe(bottle);
    const results = yield* firecrawl.searchAmazon(bottle.query || wanted);

    if (results.length === 0) return null;

    const { indexes } = yield* model.json(
      Indexes,
      pickPrompt(wanted, "Amazon", results.slice(0, 16)),
    );

    for (const index of indexes.slice(0, 3)) {
      const result = results[index];

      if (result === undefined) continue;

      const page = yield* firecrawl.amazonPage(`https://www.amazon.com/dp/${result.asin}`);

      if (page !== null && (yield* model.json(Same, samePrompt(wanted, page))).same) return page;
    }

    return null;
  });

/**
 * The printed label from the first iHerb listing the model calls the same
 * product. iHerb titles leave out potency and carrier oil, so the pick reads
 * each listing's label. Without a match, Amazon's own facts stand in.
 */
const findLabel = (bottle: Bottle | null, page: AmazonPage | null) =>
  Effect.gen(function* () {
    const firecrawl = yield* Firecrawl;
    const model = yield* Model;

    const wanted = JSON.stringify({
      bottlePhoto: bottle,
      amazon: page && { title: page.title, brand: page.brand, facts: page.facts },
    });

    const query = page === null ? (bottle === null ? "" : describe(bottle)) : page.title;
    const results = query === "" ? [] : yield* firecrawl.searchIherb(query);

    const { indexes } =
      results.length === 0
        ? { indexes: [] }
        : yield* model.json(Indexes, pickPrompt(wanted, "iHerb", results));

    for (const index of indexes.slice(0, 3)) {
      const result = results[index];

      if (result === undefined) continue;

      const listing = yield* firecrawl.iherbPage(result.url);

      if (listing === null) continue;

      const read = yield* model.json(IherbLabel, iherbPrompt(wanted, listing));

      if (read.same) {
        const { servingsPerContainer, ...label } = read.label;

        return { label: { ...label, source: result.url }, servingsPerContainer, gtin: read.gtin };
      }
    }

    if (page?.facts === null || page?.facts === undefined) return null;

    const { servingsPerContainer, ...label } = page.facts;

    return { label: { ...label, source: page.url }, servingsPerContainer, gtin: null };
  });

const writeCopy = (facts: string, fields: Fields) =>
  Effect.gen(function* () {
    const model = yield* Model;
    const first = yield* model.json(Copy, copyPrompt(facts, fields, []), WRITER);
    const hits = bannedIn(first.description);

    const copy =
      hits.length === 0 ? first : yield* model.json(Copy, copyPrompt(facts, fields, hits), WRITER);

    return { ...copy, bannedWords: bannedIn(copy.description) };
  });

/** What `count` counts for each form, in English and Mongolian. */
const units = {
  softgel: ["softgels", "зөөлөн капсул"],
  capsule: ["capsules", "капсул"],
  tablet: ["tablets", "шахмал"],
  chewable: ["chewable tablets", "зажилдаг шахмал"],
  gummy: ["gummies", "гамми"],
  lozenge: ["lozenges", "хөхдөг шахмал"],
  powder: ["g powder", "г нунтаг"],
  liquid: ["mL liquid", "мл шингэн"],
  drops: ["drops", "дусал"],
  other: ["units", "ширхэг"],
} satisfies Record<ProductForm, readonly [string, string]>;

/**
 * The English and Mongolian names. Each identity field appears, so two
 * products never share a name (products_name, products_name_mn).
 */
const productNames = (
  fields: Fields,
  mn: { readonly lineMn: string; readonly flavorMn: string | null; readonly baseMn: string | null },
) => {
  const [unitEn, unitMn] = units[fields.form];

  const potencyMn = fields.potency
    ?.replaceAll(/\bmcg\b/gu, "мкг")
    .replaceAll(/\bmg\b/gu, "мг")
    .replaceAll(/\bmL\b/gu, "мл");

  const name =
    `${fields.line}${fields.potency ? ` ${fields.potency}` : ""}, ${fields.count} ${unitEn}` +
    (fields.flavor ? `, ${fields.flavor} flavor` : "") +
    (fields.base ? `, in ${fields.base}` : "");

  const nameMn =
    `${mn.lineMn}${potencyMn ? ` ${potencyMn}` : ""}, ${fields.count} ${unitMn}` +
    (mn.flavorMn ? `, ${mn.flavorMn} амттай` : "") +
    (mn.baseMn ? `, ${mn.baseMn}` : "");

  return { name, nameMn };
};

/** The model keeps the product shots; each is copied into the shop's own bucket. */
const keepPhotos = (bucket: Bucket, origin: string, page: AmazonPage, prefix: string) =>
  Effect.gen(function* () {
    if (page.images.length === 0) return [];

    const content: ReadonlyArray<Part> = [
      { type: "text", text: photosPrompt },
      ...page.images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ];

    const { indexes } = yield* (yield* Model).json(Indexes, content);
    const kept = [...new Set(indexes)].flatMap((index) => page.images[index] ?? []);
    const chosen = kept.length > 0 ? kept : page.images.slice(0, 1);
    const http = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);

    return yield* Effect.forEach(
      chosen,
      (url, index) =>
        Effect.gen(function* () {
          const bytes = yield* http
            .get(url)
            .pipe(Effect.flatMap((response) => response.arrayBuffer));

          const key = `${prefix}/${index}.jpg`;
          yield* bucket.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });

          return `${origin}/${key}`;
        }),
      { concurrency: 4 },
    );
  });

/** `GET /img/<key>`: one photo out of the bucket, for dev, where the bucket has no domain. */
export const servePhoto = (bucket: Bucket) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;

    const key = decodeURIComponent(new URL(request.url, "http://local").pathname).replace(
      /^\/img\//u,
      "",
    );

    const object = yield* bucket.get(key).pipe(Effect.orDie);

    if (object === null) return HttpServerResponse.empty({ status: 404 });

    return HttpServerResponse.uint8Array(yield* object.bytes().pipe(Effect.orDie), {
      contentType: object.httpMetadata?.contentType ?? "image/jpeg",
      headers: { "cache-control": "public, max-age=86400" },
    });
  });

/** The running Workflow and the photo bucket, bound in the Worker's init. */
export class Drafts extends Context.Service<
  Drafts,
  {
    readonly workflow: Cloudflare.WorkflowHandle<DraftInput, ProductDraft>;
    readonly bucket: Bucket;
  }
>()("amerik/Drafts") {}

/**
 * Starts a drafting run. Her photo goes into the bucket first, so the run's
 * input stays small and the photo can become the product's own picture.
 */
export const startDraft = Effect.fn("startDraft")(function* startDraft(source: DraftSource) {
  const { workflow, bucket } = yield* Drafts;
  const options = yield* catalogOptions();

  const input = yield* Match.valueTags(source, {
    amazon: (amazon): Effect.Effect<DraftInput["source"]> => Effect.succeed(amazon),
    photo: ({ jpeg }) =>
      Effect.gen(function* () {
        const bytes = yield* Effect.fromResult(Base64.decode(jpeg)).pipe(Effect.orDie);
        const key = `uploads/${crypto.randomUUID()}.jpg`;
        yield* bucket
          .put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } })
          .pipe(Effect.orDie);

        return { _tag: "photo" as const, key };
      }),
  });

  const instance = yield* workflow.create({
    params: { source: input, ...options },
    // Long enough to come back to a draft the next day.
    retention: { successRetention: "30 days", errorRetention: "7 days" },
  });

  return yield* Schema.decodeEffect(DraftId)(instance.id).pipe(Effect.orDie);
});

/** Where a run is. A finished draft says whether the shop already has that product. */
export const getDraft = Effect.fn("getDraft")(function* getDraft(draftId: DraftId) {
  const { workflow } = yield* Drafts;

  const status = yield* workflow.get(draftId).pipe(
    Effect.flatMap((instance) => instance.status()),
    Effect.catchDefect(() => Effect.fail(new DraftNotFound({ draftId }))),
  );

  if (status.status === "complete") {
    const draft = yield* Schema.decodeUnknownEffect(ProductDraft)(status.output).pipe(Effect.orDie);

    return {
      _tag: "ready" as const,
      draft,
      existing: yield* existingProduct(draft.asin, draft.gtin),
    };
  }

  if (status.status === "errored" || status.status === "terminated") {
    return {
      _tag: "failed" as const,
      reason:
        status.error?.message === "not_a_product_page"
          ? ("not_a_product_page" as const)
          : ("failed" as const),
    };
  }

  return { _tag: "running" as const };
});

export class ProductDraftWorkflow extends Cloudflare.Workflow<ProductDraftWorkflow>()(
  "ProductDraft",
  Effect.gen(function* () {
    // Config read at init, so Alchemy binds it to the Worker as secrets. The
    // clients hold no connection, so one build serves every run.
    const services = yield* Layer.build(
      Layer.mergeAll(
        Model.layer(yield* modelConfig),
        Firecrawl.layer(yield* firecrawlConfig),
        FetchHttpClient.layer,
      ),
    );

    const bucket = yield* Cloudflare.R2.ReadWriteBucket(yield* ProductImages);
    const origin = yield* imageOrigin;

    return Effect.fn(function* (input: DraftInput) {
      const event = yield* Cloudflare.Workflows.WorkflowEvent;
      const { task } = Cloudflare.Workflows;
      const photo = Predicate.isTagged(input.source, "photo") ? input.source : null;

      const bottle =
        photo === null ? null : yield* task("read-photo", readBottle(bucket, photo.key), retried);

      const page = yield* task(
        "find-amazon",
        Match.valueTags(input.source, {
          amazon: ({ url }) => Firecrawl.use((it) => it.amazonPage(url)),
          photo: () => (bottle === null ? Effect.succeed(null) : findOnAmazon(bottle)),
        }),
        retried,
      );

      // A run's error reaches `getDraft` as only a name and a message, so the
      // message carries the reason.
      if (page === null && bottle === null) {
        return yield* Effect.die(new Error("not_a_product_page"));
      }

      const printed = yield* task("label", findLabel(bottle, page), retried);
      const facts = factsText(bottle, page, printed);

      const fields = yield* task(
        "fields",
        Model.use((model) => model.json(Fields, fieldsPrompt(facts, input))),
        retried,
      );

      const { lineMn, flavorMn, baseMn, ...copy } = yield* task(
        "copy",
        writeCopy(facts, fields),
        retried,
      );

      const fromAmazon =
        page === null
          ? []
          : yield* task(
              "photos",
              keepPhotos(bucket, origin, page, `products/${page.asin}/${event.instanceId}`),
              retried,
            );

      // Her own photo stands in when Amazon has no listing, or no usable photo.
      const images =
        fromAmazon.length > 0 || photo === null ? fromAmazon : [`${origin}/${photo.key}`];

      const draft: ProductDraft = {
        ...fields,
        ...productNames(fields, { lineMn, flavorMn, baseMn }),
        ...copy,
        images,
        asin: page?.asin ?? null,
        gtin: printed?.gtin ?? null,
        label: printed?.label ?? null,
        amazonUrl: page?.url ?? null,
        amazonTitle: page?.title ?? null,
        amazonCents: page?.cents ?? null,
        photoOnly: page === null,
      };

      return draft;
    }, Effect.provideContext(services));
  }),
) {}
