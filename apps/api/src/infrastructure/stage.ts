import { Stage } from "alchemy/Stage";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";

/**
 * The deploy stage, folded to the two behaviours the app has. Unknown stages
 * die, so a typo can never deploy somewhere unplanned. Inside the running
 * Worker there is no Stage service; Alchemy binds ALCHEMY_STAGE instead.
 * `alchemy dev` names local stages `dev_<user>`.
 */
export const deployStage = Effect.serviceOption(Stage).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Config.String("ALCHEMY_STAGE"),
      onSome: Effect.succeed,
    }),
  ),
  Effect.orDie,
  Effect.flatMap((stage) =>
    Match.value(stage).pipe(
      Match.when("production", () => Effect.succeed("production" as const)),
      Match.when(
        (name) => name.startsWith("dev_"),
        () => Effect.succeed("dev" as const),
      ),
      Match.orElse((name) =>
        Effect.die(new Error(`Unknown stage "${name}"; expected production or dev_<user>`)),
      ),
    ),
  ),
);
