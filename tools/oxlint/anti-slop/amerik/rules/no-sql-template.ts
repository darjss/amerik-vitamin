import { defineRule } from "vite-plus/lint/plugins";

/** Raw SQL lives next to the schema, where migrations and the DB-error policy can see it. */
export const noSqlTemplateRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow sql`` templates outside packages/db." },
    messages: {
      sqlTemplate:
        "Raw sql`` belongs in packages/db. Add a named query there and call it from here.",
    },
  },
  create(context) {
    if (context.filename.replaceAll("\\", "/").includes("/packages/db/")) return {};

    return {
      TaggedTemplateExpression(node) {
        const tag = node.tag.type === "MemberExpression" ? node.tag.object : node.tag;

        if (tag.type !== "Identifier" || tag.name !== "sql") return;

        context.report({ node, messageId: "sqlTemplate" });
      },
    };
  },
});
