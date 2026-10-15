import { Api, HideDefects } from "@amerik/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { pingDatabase } from "./health";

export const ApiHandlers = Api.toLayer({
  health: () => Effect.as(pingDatabase, { database: "ok" as const }),
});

export const HideDefectsLive = Layer.succeed(
  HideDefects,
  HideDefects.of((effect) =>
    Effect.catchDefect(effect, (defect) =>
      Effect.logError("rpc defect", defect).pipe(Effect.andThen(Effect.die("internal error"))),
    ),
  ),
);
