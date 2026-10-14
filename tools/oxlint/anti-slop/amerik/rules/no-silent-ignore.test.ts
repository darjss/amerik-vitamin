import { RuleTester } from "vite-plus/lint/plugins-dev";

import { noSilentIgnoreRule } from "./no-silent-ignore.ts";

new RuleTester().run("no-silent-ignore", noSilentIgnoreRule, {
  valid: [
    "notify.pipe(Effect.ignore({ log: true }));",
    'notify.pipe(Effect.ignore({ log: "Warn" }));',
    "Effect.ignore(notify, { log: true });",
    "notify.pipe(Effect.ignoreCause({ log: true }));",
  ],
  invalid: [
    { code: "notify.pipe(Effect.ignore);", errors: [{ messageId: "silentIgnore" }] },
    { code: "notify.pipe(Effect.ignore());", errors: [{ messageId: "silentIgnore" }] },
    { code: "Effect.ignore(notify);", errors: [{ messageId: "silentIgnore" }] },
    {
      code: "notify.pipe(Effect.ignore({ log: false }));",
      errors: [{ messageId: "silentIgnore" }],
    },
    { code: "notify.pipe(Effect.ignoreCause);", errors: [{ messageId: "silentIgnore" }] },
  ],
});
