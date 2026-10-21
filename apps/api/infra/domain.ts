import * as Effect from "effect/Effect";

import { deployStage } from "./stage";

/** The production API Worker's hostname. */
export const apiHostname = "api-v2.amerikvitamin.mn";

/** The port `alchemy dev` serves the API Worker on. */
export const apiDevPort = 8788;

/** Only production owns the hostname, so a dev stage can't take it over. */
export const apiDomain = deployStage.pipe(
  Effect.map((stage) => (stage === "production" ? apiHostname : undefined)),
);

/** Where the stage's API answers. QPay's callback URL points here. */
export const apiOrigin = deployStage.pipe(
  Effect.map((stage) =>
    stage === "production" ? `https://${apiHostname}` : `http://localhost:${apiDevPort}`,
  ),
);
