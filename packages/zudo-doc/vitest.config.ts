import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";

// The package directory — vitest resolves `include` globs relative to `root`,
// which defaults to process.cwd() (the workspace root) rather than the config
// file's directory. Setting it explicitly ensures tests in this package's
// `src/**/__tests__/` are found, not the root-level `src/**/__tests__/`.
const pkgRoot = __dirname;
const repoRoot = resolve(__dirname, "../..");

/**
 * Vitest config scoped to @takazudo/zudo-doc.
 *
 * The repo-root vitest.config.ts only includes `src/**` and `scripts/**`, so
 * this local config exists purely to let unit tests under
 * `packages/zudo-doc/src/**\/__tests__/` run via:
 *
 *   pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts
 */

// Locate preact-render-to-string in the workspace's pnpm virtual store by
// scanning for any entry matching "preact-render-to-string@6.x_preact@*".
// This avoids hardcoding the exact preact patch version in the peer suffix,
// which changes whenever `pnpm up preact` is run (#1733).
function findPreactRenderToString(): string {
  const pnpmDir = resolve(repoRoot, "node_modules/.pnpm");
  const entries = readdirSync(pnpmDir);
  const entry = entries.find(
    (e) =>
      e.startsWith("preact-render-to-string@6.") && e.includes("_preact@"),
  );
  if (!entry) {
    throw new Error(
      "Could not locate preact-render-to-string in workspace pnpm store. Run `pnpm install`.",
    );
  }
  return resolve(
    pnpmDir,
    entry,
    "node_modules/preact-render-to-string/dist/index.mjs",
  );
}

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
  resolve: {
    alias: {
      // NOTE (#3396): there is deliberately NO alias for
      // `virtual:zudo-doc-design-token-panel-config` here any more. The chrome
      // graph no longer imports that specifier — `design-token-panel-bootstrap.tsx`
      // binds the package-default builder directly, and the only importer left
      // is `src/routes/_design-token-panel-bootstrap.tsx`, which no fast test
      // loads. Re-adding an alias would mask a regression that reintroduced the
      // routes-plugin coupling into the chrome graph.
      //
      // preact-render-to-string is hoisted into the workspace root pnpm store
      // but not surfaced at root or package node_modules. Pin it explicitly so
      // JSX rendering tests work without bloating the package's own deps.
      "preact-render-to-string": findPreactRenderToString(),
      // React → Preact compat aliases. This package runs Preact in React-compat
      // mode (the production zfb/vite build aliases these too). Pre-compiled zfb
      // island runtime (@takazudo/zfb/dist/island.js) hardcodes
      // `import { jsx } from "react/jsx-runtime"`; without these aliases any test
      // that loads an island (e.g. the doc-layout TOC-gating suite) fails with
      // "Cannot find package 'react'" since this is a Preact project. Most
      // specific keys first so `react/jsx-runtime` is not swallowed by `react`.
      "react/jsx-runtime": "preact/jsx-runtime",
      "react/jsx-dev-runtime": "preact/jsx-runtime",
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
      react: "preact/compat",
    },
  },
  test: {
    root: pkgRoot,
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    // Slow integration tests (real `zfb build`s) live in `*.slow.test.ts`
    // files and run via `pnpm --filter @takazudo/zudo-doc test:slow` with a
    // separate config (vitest.slow.config.ts). Mirrors
    // packages/create-zudo-doc/vitest.config.ts (zudolab/zudo-doc#2530).
    exclude: ["**/node_modules/**", "**/*.slow.test.ts"],
    // Deadline headroom under CPU contention (#3465, #3452 Wave 1 diagnosis):
    // this suite runs real tsc (resolution-chain.test.ts, 11.3-18.4s
    // observed), a subprocess CLI (eject-logo/cli-smoke.test.ts), and WASM
    // loads (highlight-runtime.integration.test.ts) that legitimately exceed
    // vitest's 5000ms default once the machine is contended. Ordering
    // invariant: every per-operation deadline reached from a TEST BODY (e.g.
    // the cli-smoke spawnSync timeout, design-token-panel-bootstrap.test.ts's
    // WAIT_FOR_OPTS) stays strictly below this value — counting the worst-case
    // number of sequential such operations in a single test, not just one —
    // so the specific, diagnosable deadline always fires before this blunt
    // one. Hook deadlines are exempt: they race vitest's separate hookTimeout,
    // never this one (theme-packs-tarball.test.ts's 60s `beforeAll` is the
    // one such case).
    testTimeout: 30_000,
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
