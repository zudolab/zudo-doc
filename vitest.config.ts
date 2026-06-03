import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@/": resolve(__dirname, "src") + "/",
      // React → Preact compat aliases. This project runs Preact in React-compat
      // mode (the production zfb/vite build aliases these too). The precompiled
      // zfb island runtime (@takazudo/zfb/dist/island.js) hardcodes
      // `import { jsx } from "react/jsx-runtime"`; without these aliases any test
      // that transitively loads it (e.g. src/config/__tests__/design-token-panel-config)
      // fails with "Cannot find package 'react'" since this is a Preact project.
      // Most-specific keys first so `react/jsx-runtime` is not swallowed by `react`.
      // Mirrors packages/zudo-doc/vitest.config.ts.
      "react/jsx-runtime": "preact/jsx-runtime",
      "react/jsx-dev-runtime": "preact/jsx-runtime",
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
      react: "preact/compat",
    },
  },
  test: {
    include: [
      "src/**/__tests__/**/*.test.ts",
      "scripts/__tests__/**/*.test.ts",
    ],
    server: {
      deps: {
        // Inline the zfb island runtime so vite transforms it through the
        // resolve.alias pipeline above. Externalized node_modules deps are
        // loaded by Node's native resolver, which bypasses the react →
        // preact/compat aliases — so @takazudo/zfb/dist/island.js's
        // `import "react/jsx-runtime"` would otherwise fail with
        // "Cannot find package 'react'".
        inline: [/@takazudo\/zfb/],
      },
    },
  },
});
