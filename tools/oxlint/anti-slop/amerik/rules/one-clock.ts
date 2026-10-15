import { defineRule } from "vite-plus/lint/plugins";

/** Every "now" goes through Effect's Clock, so a test can move time and a log shows the same instant. */
export const oneClockRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow Date.now() and new Date() without arguments." },
    messages: {
      wallClock:
        "Read the time from Effect: `DateTime.now` or `Clock.currentTimeMillis`. `new Date(value)` is fine.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;

        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "Date" &&
          callee.property.type === "Identifier" &&
          callee.property.name === "now"
        ) {
          context.report({ node, messageId: "wallClock" });
        }
      },
      NewExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "Date" &&
          node.arguments.length === 0
        ) {
          context.report({ node, messageId: "wallClock" });
        }
      },
    };
  },
});
