import { antipattern, correctness } from "@effect/tsgo/oxlint-presets";
import solidV2Strict from "eslint-plugin-solid/configs/v2-strict";
import { defineConfig } from "oxlint";

// Effect diagnostics run on all code, so Effect 3 names fail wherever they appear.
const effectFiles = ["apps/**", "packages/**", "infra/**"];

const webFiles = ["apps/web/**"];

const agentIgnores = [".agent/**", ".agents/**", ".claude/**", ".codex/**", ".opencode/**"];

const generatedIgnores = ["**/file-routes.d.ts", "packages/db/migrations/**"];

// Vendored anti-slop stays as upstream wrote it. Our own rules in anti-slop/amerik are linted.
const vendoredIgnores = [
  "tools/oxlint/anti-slop/*.*",
  "tools/oxlint/anti-slop/{effect,rules,shared,vendor}/**",
];

export const formatIgnores = [
  ...agentIgnores,
  ...generatedIgnores,
  ...vendoredIgnores,
  "docs/private/**",
];

const effectErrorRules = {
  "effecttsgo/floating-effect": "error",
  "effecttsgo/floating-effect-in-vitest": "error",
  "effecttsgo/global-error-in-effect-catch": "error",
  "effecttsgo/missing-effect-context": "error",
  "effecttsgo/missing-effect-error": "error",
  "effecttsgo/missing-layer-context": "error",
  "effecttsgo/missing-star-in-yield-effect-gen": "error",
  "effecttsgo/outdated-api": "error",
  "effecttsgo/return-effect-in-gen": "error",
  "effecttsgo/run-effect-inside-effect": "error",
  "effecttsgo/try-catch-in-effect-gen": "error",
  "effecttsgo/unknown-in-effect-catch": "error",
} as const;

// eslint-plugin-solid ships ESLint's numeric levels; oxlint wants names.
const levelNames = ["off", "warn", "error"] as const;

const solidRules = Object.fromEntries(
  Object.entries(solidV2Strict.rules).map(([name, level]) => [name, levelNames[level]]),
);

export const lint = defineConfig({
  ignorePatterns: [...agentIgnores, ...generatedIgnores, ...vendoredIgnores],
  jsPlugins: [
    { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    { name: "anti-slop-effect", specifier: "./tools/oxlint/anti-slop/effect/index.ts" },
    { name: "amerik", specifier: "./tools/oxlint/anti-slop/amerik/index.ts" },
  ],
  // A warning fails `vp check`. There is no warning baseline.
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    {
      files: effectFiles,
      rules: {
        ...antipattern.rules,
        ...correctness.rules,
        ...effectErrorRules,
        // Effect 4 ships rpc, http and sql as unstable modules. We use them on
        // purpose and pin effect exactly (docs/STACK.md).
        "effecttsgo/unstable-api-usage": "off",
      },
    },
    {
      // Composition edges: the Worker entry, the Alchemy stack and the migrate script.
      files: ["apps/api/src/index.ts", "infra/alchemy.run.ts", "packages/db/src/migrate.ts"],
      rules: { "effecttsgo/strict-effect-provide": "off" },
    },
    {
      // drizzle's migrator error union reads as `any` to effect-tsgo; the call dies on failure anyway.
      files: ["packages/db/src/migrations.ts"],
      rules: { "effecttsgo/any-unknown-in-error-context": "off" },
    },
    {
      // The web talks to the API over RPC, never to the database or the infra.
      files: webFiles,
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "@amerik/db",
                  "@amerik/db/*",
                  "drizzle-orm",
                  "drizzle-orm/*",
                  "alchemy",
                  "alchemy/*",
                ],
                message: "apps/web reaches data through the Api RPC in @amerik/contracts.",
              },
            ],
          },
        ],
      },
    },
    {
      // Contracts are the wire API: schemas, ids and errors, nothing that runs.
      files: ["packages/contracts/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "@amerik/db",
                  "@amerik/db/*",
                  "drizzle-orm",
                  "drizzle-orm/*",
                  "alchemy",
                  "alchemy/*",
                  "cloudflare:*",
                ],
                message:
                  "packages/contracts holds wire types only, no database, infra or runtime imports.",
              },
            ],
          },
        ],
      },
    },
    {
      // Infra wires resources; the domain in src depends on it, never the other way.
      files: ["apps/api/infra/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["../src", "../src/*"],
                message: "apps/api/infra must not import domain code from src.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      rules: { "no-console": "error", "vitest/no-focused-tests": "error" },
    },
    {
      files: webFiles,
      jsPlugins: ["eslint-plugin-solid"],
      rules: { ...solidRules, "solid/reactivity": "error" },
    },
  ],
  // Setting `plugins` replaces oxlint's defaults, so the default set is listed here too.
  plugins: ["typescript", "unicorn", "oxc", "vitest", "effecttsgo"],
  rules: {
    "max-lines": ["error", { max: 600, skipBlankLines: true, skipComments: true }],
    "vite-plus/prefer-vite-plus-imports": "error",
    "oxc/no-accumulating-spread": "error",
    "anti-slop/no-array-filter-map": "error",
    "anti-slop/no-reduce-accumulator-copy": "error",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-readable-spacing": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "anti-slop-effect/no-manual-effect-error-tag": "error",
    "anti-slop-effect/no-manual-tag-comparison": "error",
    "anti-slop-effect/no-manual-tagged-construction": "error",
    "anti-slop-effect/no-service-constructor-imports": "error",
    "anti-slop-effect/prefer-effect-match": "error",
    "amerik/no-silent-ignore": "error",
    "amerik/no-sql-template": "error",
    "amerik/no-string-id": "error",
    "amerik/one-clock": "error",
  },
  settings: solidV2Strict.settings,
});
