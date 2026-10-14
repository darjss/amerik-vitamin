import { RuleTester } from "vite-plus/lint/plugins-dev";

import { oneClockRule } from "./one-clock.ts";

new RuleTester().run("one-clock", oneClockRule, {
  valid: [
    "const placedAt = new Date(row.placedAt);",
    "const now = yield* DateTime.now;",
    "const millis = yield* Clock.currentTimeMillis;",
  ],
  invalid: [
    { code: "const now = Date.now();", errors: [{ messageId: "wallClock" }] },
    { code: "const now = new Date();", errors: [{ messageId: "wallClock" }] },
  ],
});
