import { eslintCompatPlugin } from "vite-plus/lint/plugins";

import { noSilentIgnoreRule } from "./rules/no-silent-ignore.ts";
import { noSqlTemplateRule } from "./rules/no-sql-template.ts";
import { noStringIdRule } from "./rules/no-string-id.ts";
import { oneClockRule } from "./rules/one-clock.ts";

/** Rules for this repo's own conventions. Each rule has one RuleTester test beside it. */
const amerikPlugin = eslintCompatPlugin({
  meta: { name: "amerik" },
  rules: {
    "no-silent-ignore": noSilentIgnoreRule,
    "no-sql-template": noSqlTemplateRule,
    "no-string-id": noStringIdRule,
    "one-clock": oneClockRule,
  },
});

export default amerikPlugin;
