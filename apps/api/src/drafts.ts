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
import { Firecrawl, firecrawlConfig } from "./firecrawl";
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
const Label = Schema.Struct({
  brand: Schema.String,
  product: Schema.String,
  strength: Schema.String,
  count: Schema.NullOr(Schema.Int),
  query: Schema.String,
});

type Label = typeof Label.Type;

const Fields = Schema.Struct({
  brand: Schema.String,
  category: Schema.String,
  line: Schema.String,
  potency: Schema.NullOr(Schema.String),
  count: Schema.Int,
  form: ProductForm,
  flavor: Schema.NullOr(Schema.String),
  name: Schema.String,
  servingSize: Schema.NullOr(Schema.Int),
  servings: Schema.NullOr(Schema.Int),
  dailyUnits: Schema.NullOr(Schema.Int),
});

const Copy = Schema.Struct({ description: Schema.String, note: Schema.String });

const Indexes = Schema.Struct({ indexes: Schema.Array(Schema.Int) });

const Same = Schema.Struct({ same: Schema.Boolean, why: Schema.String });

const readLabelPrompt = `This is a photo of a dietary supplement bottle or box.
Read the label. Return JSON:
{"brand": "brand as printed", "product": "product name as printed", "strength": "amount per serving as printed, or empty",
 "count": units in the bottle as an integer or null, "query": "an Amazon search for this exact bottle: brand, product, strength, count"}`;

const pickPrompt = (label: string, results: ReadonlyArray<{ title: string }>) =>
  `We want this exact product: ${label}
Amazon search results:
${results.map((result, index) => `${index} | ${result.title}`).join("\n")}

Which results could be this exact product: same brand, same strength, one bottle with the same count? A multi-pack or another count is not it.
Return {"indexes": [up to 3 result numbers, most likely first]}, or an empty list.`;

const samePrompt = (label: string, page: AmazonPage) =>
  `We want this exact product: ${label}
Amazon page: ${JSON.stringify({ title: page.title, brand: page.brand, facts: page.facts })}
Is the page this exact product: same brand, same strength, one bottle with the same count? Return {"same": boolean, "why": "short reason"}.`;

const fieldsPrompt = (facts: string, input: DraftInput) => `Supplement product facts:
${facts}

Return the shop's catalog fields as JSON:
{"brand": "the brand; when it is one of ${JSON.stringify(input.brands)}, spell it exactly that way",
 "category": one of ${input.categories.map((category) => `"${category.slug}" (${category.name})`).join(", ")},
 "line": "the product line without brand, strength or count, in English, e.g. Magnesium Glycinate",
 "potency": "strength per serving as printed, or null",
 "count": units in the bottle as an integer (for a powder, the grams),
 "form": one of ${ProductForm.literals.map((form) => `"${form}"`).join(", ")},
 "flavor": "flavor if it has one, else null",
 "name": "display name without the brand, in English: line, potency, count and form, e.g. Magnesium Glycinate 200 mg, 240 tablets",
 "servingSize": units per serving as an integer or null,
 "servings": servings per container as an integer or null,
 "dailyUnits": units per day at the label's dose as an integer or null}
Use "kids" only for a product made for children.`;

// Health claims are the line this shop never crosses (AGENTS.md). Any of
// these sends the copy back once; a second hit goes to her as a note.
const claims =
  /дэмж|сайжруул|хамгаал|эмчил|урьдчилан сэргийл|дархлаа|эрүүл мэнд|үр дүн|тайвшруул|бэхжүүл|нөхөн сэргээ|—|–|[“”‘’]|!/giu;

const copyPrompt = (
  facts: string,
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
Return JSON: {"description": "...", "note": "a doubt for the shop owner in Mongolian, or empty"}`;

const photosPrompt = `These are one supplement's Amazon photos, numbered from 0.
Keep only photos where the product is the subject: the bottle or box from the front, back or side, the label, the supplement facts panel, or capsules next to the bottle.
Drop lifestyle photos with people, brand-story, sustainability, partner or charity banners, infographics that list benefits or health effects, comparison charts, and near-duplicates of a photo you keep.
Put the clearest front-of-bottle photo first. Keep at least one if any shows the bottle.
Return {"indexes": [photo numbers in display order]}.`;

const describe = (label: Label) =>
  [label.brand, label.product, label.strength, label.count === null ? "" : `${label.count} count`]
    .filter(Boolean)
    .join(" ");

/** The label read plus the Amazon page, as the facts the field and copy prompts get. */
const factsText = (label: Label | null, page: AmazonPage | null) =>
  JSON.stringify(
    {
      bottlePhoto: label,
      amazon: page && {
        title: page.title,
        brand: page.brand,
        category: page.category,
        description: page.description.slice(0, 3000),
        facts: page.facts,
      },
    },
    null,
    1,
  );

type Bucket = Cloudflare.R2.ReadWriteBucketClient;

const readLabel = (bucket: Bucket, key: string) =>
  Effect.gen(function* () {
    const object = yield* bucket.get(key);

    if (object === null) return yield* Effect.die(`draft photo ${key} is gone`);

    const jpeg = Base64.encode(yield* object.bytes());

    const content: ReadonlyArray<Part> = [
      { type: "text", text: readLabelPrompt },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg}` } },
    ];

    return yield* (yield* Model).json(Label, content);
  });

/** Amazon search, the model's picks, then each pick's page checked against the label. */
const findOnAmazon = (label: Label) =>
  Effect.gen(function* () {
    const firecrawl = yield* Firecrawl;
    const model = yield* Model;
    const wanted = describe(label);
    const results = yield* firecrawl.searchAmazon(label.query || wanted);

    if (results.length === 0) return null;

    const { indexes } = yield* model.json(Indexes, pickPrompt(wanted, results.slice(0, 16)));

    for (const index of indexes.slice(0, 3)) {
      const result = results[index];

      if (result === undefined) continue;

      const page = yield* firecrawl.amazonPage(`https://www.amazon.com/dp/${result.asin}`);

      if (page !== null && (yield* model.json(Same, samePrompt(wanted, page))).same) return page;
    }

    return null;
  });

const writeCopy = (facts: string) =>
  Effect.gen(function* () {
    const model = yield* Model;
    let copy = yield* model.json(Copy, copyPrompt(facts, []), WRITER);
    let hits = [...new Set(copy.description.match(claims) ?? [])];

    if (hits.length > 0) {
      copy = yield* model.json(Copy, copyPrompt(facts, hits), WRITER);
      hits = [...new Set(copy.description.match(claims) ?? [])];
    }

    const note = hits.length > 0 ? `Тайлбарт хориотой үг байна: ${hits.join(", ")}` : copy.note;

    return { description: copy.description, note };
  });

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

    return { _tag: "ready" as const, draft, existing: yield* existingProduct(draft.asin) };
  }

  if (status.status === "errored" || status.status === "terminated") {
    return { _tag: "failed" as const, reason: status.error?.message ?? "Болсонгүй." };
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

      const label =
        photo === null ? null : yield* task("read-photo", readLabel(bucket, photo.key), retried);

      const page = yield* task(
        "find-amazon",
        Match.valueTags(input.source, {
          amazon: ({ url }) => Firecrawl.use((it) => it.amazonPage(url)),
          photo: () => (label === null ? Effect.succeed(null) : findOnAmazon(label)),
        }),
        retried,
      );

      if (page === null && label === null) {
        return yield* Effect.die("Энэ холбоос Amazon-ий барааны хуудас биш байна.");
      }

      const facts = factsText(label, page);

      const fields = yield* task(
        "fields",
        Model.use((model) => model.json(Fields, fieldsPrompt(facts, input))),
        retried,
      );

      const copy = yield* task("copy", writeCopy(facts), retried);

      // Her own photo stands in when Amazon has no listing for the bottle.
      const images =
        page === null
          ? photo === null
            ? []
            : [`${origin}/${photo.key}`]
          : yield* task(
              "photos",
              keepPhotos(bucket, origin, page, `products/${page.asin}/${event.instanceId}`),
              retried,
            );

      const notFound = page === null ? "Amazon-оос олдсонгүй, зөвхөн зургаас уншив." : "";

      const draft: ProductDraft = {
        ...fields,
        description: copy.description,
        images,
        asin: page?.asin ?? null,
        amazonUrl: page?.url ?? null,
        amazonTitle: page?.title ?? null,
        amazonCents: page?.cents ?? null,
        note: [notFound, copy.note].filter(Boolean).join(" "),
      };

      return draft;
    }, Effect.provideContext(services));
  }),
) {}
