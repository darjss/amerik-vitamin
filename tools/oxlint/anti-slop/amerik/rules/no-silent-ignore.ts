import { defineRule } from "vite-plus/lint/plugins";

import type { ESTree } from "vite-plus/lint/plugins";

const IGNORES = new Set(["ignore", "ignoreCause"]);

const isLogKey = (key: ESTree.Node) =>
  (key.type === "Identifier" && key.name === "log") ||
  (key.type === "Literal" && key.value === "log");

const isOff = (value: ESTree.Node) =>
  (value.type === "Literal" && value.value === false) ||
  (value.type === "Identifier" && value.name === "undefined");

const logsFailure = (argument: ESTree.Node) =>
  argument.type === "ObjectExpression" &&
  argument.properties.some(
    (property) => property.type === "Property" && isLogKey(property.key) && !isOff(property.value),
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
