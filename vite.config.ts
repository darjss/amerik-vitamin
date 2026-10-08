import { defineConfig } from "vite-plus";

import { formatIgnores, lint } from "./lint.config.ts";

export default defineConfig({
  fmt: { ignorePatterns: formatIgnores },
  lint,
  staged: { "*": "vp check --fix" },
});
