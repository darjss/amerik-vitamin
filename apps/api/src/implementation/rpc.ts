import { Api } from "@amerik/contracts";
import * as Effect from "effect/Effect";

import { pingDatabase } from "./health";

export const ApiHandlers = Api.toLayer({
  health: () => Effect.as(pingDatabase, { database: "ok" as const }),
});
