import * as Cloudflare from "alchemy/Cloudflare";
import { retain } from "alchemy/RemovalPolicy";
import * as Effect from "effect/Effect";

import { deployStage } from "./stage";

/**
 * Where product photos are served. No "v2" in it, so the URLs stored in
 * `products.images` survive the move off vit-store's domains.
 */
export const imageHostname = "img.amerikvitamin.mn";

/** Product photos. Only production owns the hostname, so a dev stage can't take it over. */
export const ProductImages = deployStage.pipe(
  Effect.flatMap((stage) =>
    Cloudflare.R2.Bucket("ProductImages", {
      domains: stage === "production" ? [{ name: imageHostname }] : [],
    }),
  ),
  retain(),
);
