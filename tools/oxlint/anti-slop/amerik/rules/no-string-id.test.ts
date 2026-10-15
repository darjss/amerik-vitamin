import { RuleTester } from "vite-plus/lint/plugins-dev";

import { noStringIdRule } from "./no-string-id.ts";

new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } }).run(
  "no-string-id",
  noStringIdRule,
  {
    valid: [
      "type Line = { productId: ProductId; name: string };",
      "const Line = Schema.Struct({ productId: ProductId, name: Schema.String });",
      "const findOrder = (orderId: OrderId) => orderId;",
      "const hidden = (idea: string) => idea;",
      'const Line = Schema.Struct({ productId: Schema.String.check(isUUID(7)).pipe(Schema.brand("ProductId")) });',
    ],
    invalid: [
      {
        code: "type Line = { productId: string };",
        errors: [{ messageId: "stringId", data: { name: "productId" } }],
      },
      {
        code: "interface Order { id: string }",
        errors: [{ messageId: "stringId", data: { name: "id" } }],
      },
      {
        code: "const Line = Schema.Struct({ productId: Schema.String });",
        errors: [{ messageId: "stringId", data: { name: "productId" } }],
      },
      {
        code: "const Line = Schema.Struct({ productId: Schema.String.check(isUUID(7)) });",
        errors: [{ messageId: "stringId", data: { name: "productId" } }],
      },
      {
        code: "const findOrder = (orderId: string) => orderId;",
        errors: [{ messageId: "stringId", data: { name: "orderId" } }],
      },
    ],
  },
);
