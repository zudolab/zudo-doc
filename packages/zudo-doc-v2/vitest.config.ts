import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../..");

/**
 * Vitest config scoped to @zudo-doc/zudo-doc-v2.
 *
 * The repo-root vitest.config.ts only includes `src/**` and `scripts/**`, so
 * this local config exists purely to let unit tests under
 * `packages/zudo-doc-v2/src/**\/__tests__/` run via:
 *
 *   pnpm exec vitest run --config packages/zudo-doc-v2/vitest.config.ts
 *
 * No package.json scripts are added on purpose — E5 topic-child agents kept
 * package.json untouched per the manager's hard rule.
 */
export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
  resolve: {
    alias: {
      // preact-render-to-string is hoisted into the workspace root pnpm store
      // but not surfaced at root or package node_modules. Pin it explicitly so
      // JSX rendering tests work without bloating the package's own deps.
      "preact-render-to-string": resolve(
        repoRoot,
        "node_modules/.pnpm/preact-render-to-string@6.6.6_preact@10.29.0/node_modules/preact-render-to-string/dist/index.mjs",
      ),
    },
  },
  test: {
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
  },
});
