import * as Effect from "effect/Effect";

import { deployStage } from "./stage";

/** The production API Worker's hostname. QPay's callback URL points here. */
export const apiHostname = "api-v2.amerikvitamin.mn";

/** Only production owns the hostname, so a dev stage can't take it over. */
export const apiDomain = deployStage.pipe(
  Effect.map((stage) => (stage === "production" ? apiHostname : undefined)),
);
