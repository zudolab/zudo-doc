import { defineConfig } from "tsup";

// Per-file compilation (bundle:false) — not bundling — because zfb's
// island scanner identifies hydratable components by the top-of-file
// "use client" directive. esbuild (which tsup wraps) strips that
// directive when bundling: the "use client" survives in an entry's
// top-level slot, but inner modules get collapsed and their directives
// are dropped. With bundle:false esbuild treats every input as a
// standalone compilation, producing dist/<source-path>.js 1:1 with
// the source layout — directives, identity, and tree-shape all
// preserved. The exports map in package.json already points 1:1 at
// dist/ paths so no entry-map derivation is required.
//
// Tradeoffs accepted:
//   - tarball grows (~3×) — no cross-file DCE / minification.
//     For a library of this size: ~1-2 MB after this change, vs the
//     644 KB the bundle:true experiment produced. Acceptable.
//   - dev iteration: tsup --watch recompiles only changed files,
//     which is faster than the bundled mode (no chunk recomputation).
//
// Why this path beats banner / esbuild-plugin directive preservation:
// those work mechanically but assume current tsup/esbuild internals.
// bundle:false uses the published feature for its documented purpose
// (publish-as-individually-compiled-files) — stable across releases.
export default defineConfig({
  // Compile every .ts / .tsx under src/, except test fixtures and
  // vitest configs. The exports map filters what consumers can
  // import; this list is just what gets compiled.
  entry: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "!src/**/__tests__/**",
    "!src/**/*.test.ts",
    "!src/**/*.test.tsx",
    "!src/**/vitest.config.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
  bundle: false,
  sourcemap: false,
  // splitting + external are irrelevant when bundle:false — imports
  // stay as written and resolve against the consumer's node_modules
  // at runtime.
  // After every compilation (build, prepare, and --watch): copy the static
  // content stylesheet into dist/ (shipped as `@takazudo/zudo-doc/content.css`),
  // then regenerate dist/safelist.css. Both must run AFTER tsup because
  // clean:true wipes dist/ first; gen-safelist only scans dist/*.js so the
  // copied .css does not affect it.
  onSuccess: "node scripts/copy-content-css.mjs && node scripts/copy-page-loading-css.mjs && node scripts/gen-safelist.mjs",
});
