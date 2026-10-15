import { defineRule } from "vite-plus/lint/plugins";

import type { ESTree } from "vite-plus/lint/plugins";

const ID_NAME = /^id$|Id$/u;

const keyName = (key: ESTree.Node) => {
  if (key.type === "Identifier") return key.name;

  return key.type === "Literal" ? String(key.value) : undefined;
};

// `Schema.String.check(...)` is still a plain string; `.pipe(...)` may add a brand, so it passes.
const isSchemaString = (value: ESTree.Node): boolean => {
  if (
    value.type === "CallExpression" &&
    value.callee.type === "MemberExpression" &&
    value.callee.property.type === "Identifier" &&
    value.callee.property.name === "check"
  ) {
    return isSchemaString(value.callee.object);
  }

  return (
    value.type === "MemberExpression" &&
    value.object.type === "Identifier" &&
    value.object.name === "Schema" &&
    value.property.type === "Identifier" &&
    value.property.name === "String"
  );
};

/** Ids are branded in packages/contracts/src/ids.ts, so a ProductId never passes as an OrderId. */
export const noStringIdRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow `id` and `*Id` typed as plain string or Schema.String." },
    messages: {
      stringId:
        '"{{name}}" is a plain string. Use its branded id from packages/contracts/src/ids.ts, or add one there.',
    },
  },
  create(context) {
    const report = (node: ESTree.Node, name: string | undefined) => {
      if (name !== undefined && ID_NAME.test(name)) {
        context.report({ node, messageId: "stringId", data: { name } });
      }
    };

    return {
      TSPropertySignature(node) {
        if (node.typeAnnotation?.typeAnnotation.type === "TSStringKeyword") {
          report(node, keyName(node.key));
        }
      },
      Identifier(node) {
        if (node.typeAnnotation?.typeAnnotation.type === "TSStringKeyword") {
          report(node, node.name);
        }
      },
      Property(node) {
        if (isSchemaString(node.value)) report(node, keyName(node.key));
      },
    };
  },
});
