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
      // that transitively loads it fails with "Cannot find package 'react'"
      // since this is a Preact project.
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
    // Root subprocess-heavy specs use the slow suffix and run through the
    // dedicated PR-gated config (vitest.slow.config.ts). Keep them out of the
    // default lane so `pnpm test:unit` stays focused on fast unit coverage.
    exclude: ["**/node_modules/**", "**/*.slow.test.ts"],
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
    // Split into projects so scripts/__tests__ (subprocess-heavy) can get a
    // longer per-test timeout without loosening the default for src/__tests__
    // (pure unit tests). `extends: true` is required on both — vitest project
    // configs do NOT inherit the root config by default, so without it the
    // resolve.alias and server.deps.inline settings above would not apply.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/__tests__/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "scripts",
          // `.test.mjs` alongside the usual `.test.ts` (#3456). The norm here is
          // `.test.ts` even for `.mjs` scripts — check-pin-parity.test.ts imports
          // straight from check-pin-parity.mjs and typechecks fine, because it
          // annotates its own locals. A test that is plain JS does not: this
          // project adds `noUncheckedIndexedAccess` on top of strict, and
          // `scripts/**` is inside tsconfig's `include`, so writing a plain-JS
          // test as `.ts` demanded ~18 non-null assertions on ordinary
          // `results[0]` reads — noise that asserts nothing about the code under
          // test. Measured, not assumed: the rename was tried and produced
          // exactly those errors. Prefer `.test.ts` for anything that carries
          // real types; `.test.mjs` is for plain-JS tests of plain-JS scripts.
          include: [
            "scripts/__tests__/**/*.test.ts",
            "scripts/__tests__/**/*.test.mjs",
          ],
          // The subprocess-heavy specs are retained as PR gates, but run in
          // the separate root slow lane to keep this default lane bounded.
          exclude: ["scripts/__tests__/**/*.slow.test.ts"],
          // Subprocess-heavy integration-flavored tests; 2x the largest 30s
          // child budget for load headroom under host CPU contention (#2563).
          testTimeout: 60_000,
        },
      },
    ],
  },
});
