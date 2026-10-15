import { RuleTester } from "vite-plus/lint/plugins-dev";

import { noSqlTemplateRule } from "./no-sql-template.ts";

new RuleTester().run("no-sql-template", noSqlTemplateRule, {
  valid: [
    { filename: "/repo/packages/db/src/orders.ts", code: "db.execute(sql`SELECT 1`);" },
    { filename: "/repo/apps/api/src/orders.ts", code: "const text = html`<p></p>`;" },
  ],
  invalid: [
    {
      filename: "/repo/apps/api/src/orders.ts",
      code: "db.execute(sql`SELECT 1`);",
      errors: [{ messageId: "sqlTemplate" }],
    },
    {
      filename: "/repo/apps/api/src/orders.ts",
      code: "db.execute(sql.raw`SELECT 1`);",
      errors: [{ messageId: "sqlTemplate" }],
    },
  ],
});
