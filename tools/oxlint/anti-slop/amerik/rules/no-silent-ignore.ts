import { defineRule } from "vite-plus/lint/plugins";

import type { ESTree } from "vite-plus/lint/plugins";

const IGNORES = new Set(["ignore", "ignoreCause"]);

const logsFailure = (argument: ESTree.Node) =>
  argument.type === "ObjectExpression" &&
  argument.properties.some(
    (property) =>
      property.type === "Property" &&
      property.key.type === "Identifier" &&
      property.key.name === "log" &&
      !(property.value.type === "Literal" && property.value.value === false),
  );

/** A swallowed failure nobody can see is a bug report nobody files. */
export const noSilentIgnoreRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require `{ log: true }` on Effect.ignore and Effect.ignoreCause." },
    messages: {
      silentIgnore:
        "Pass `{ log: true }` (or a severity) so the dropped failure reaches the logs, or handle it.",
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type !== "Identifier" ||
          node.object.name !== "Effect" ||
          node.property.type !== "Identifier" ||
          !IGNORES.has(node.property.name)
        ) {
          return;
        }

        const { parent } = node;

        if (
          parent.type === "CallExpression" &&
          parent.callee === node &&
          parent.arguments.some(logsFailure)
        ) {
          return;
        }

        context.report({ node, messageId: "silentIgnore" });
      },
    };
  },
});
