import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
  resolve: {
    mainFields: ["module", "main"],
    alias: {
      // Mirrors vite.config.ts — see its comment. Most-specific key first so
      // `react/jsx-runtime` is not swallowed by the `react` entry.
      "react/jsx-runtime": "preact/jsx-runtime",
      "react-dom": "preact/compat",
      react: "preact/compat",
    },
  },
  test: {
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**"],
    // Default environment is node (plain `*.test.ts` specs, e.g. the wasm
    // spike, need no DOM). Specs that mount Preact components (`.tsx`) opt
    // into jsdom via a per-file `// @vitest-environment jsdom` pragma —
    // `environmentMatchGlobs` was removed in Vitest 4, so a glob-based
    // default here is no longer available.
    environment: "node",
    server: {
      deps: {
        // node_modules deps are externalized by default and load through
        // Node's native resolver, which bypasses the resolve.alias react ->
        // preact/compat mapping above (mirrors packages/zudo-doc/vitest.config.ts).
        // @dnd-kit's own `import { useMemo } from "react"` would otherwise
        // hit the real react package (auto-installed to satisfy its peerDep)
        // instead of preact/compat, producing an "Invalid hook call".
        inline: [/@dnd-kit\//],
      },
    },
  },
});
