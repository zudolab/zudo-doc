import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../..");

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
  resolve: {
    alias: {
      // preact-render-to-string is hoisted into the workspace root pnpm store
      // but not surfaced at root or package node_modules. Pin it explicitly so
      // tests can render JSX without bloating the package's own deps.
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
