import { IMAGE_HOST } from "@amerik/contracts";
import * as Cloudflare from "alchemy/Cloudflare";
import { retain } from "alchemy/RemovalPolicy";
import * as Effect from "effect/Effect";

import { deployStage } from "./stage";

/** Product photos. Only production owns the hostname, so a dev stage can't take it over. */
export const ProductImages = deployStage.pipe(
  Effect.flatMap((stage) =>
    Cloudflare.R2.Bucket("ProductImages", {
      domains: stage === "production" ? [{ name: IMAGE_HOST }] : [],
    }),
  ),
  retain(),
);

/**
 * The prefix a stored photo URL starts with. A dev bucket has no domain, so
 * dev URLs are paths the web Worker forwards to the API's `/img` route.
 */
export const imageOrigin = deployStage.pipe(
  Effect.map((stage) => (stage === "production" ? `https://${IMAGE_HOST}` : "/img")),
);
