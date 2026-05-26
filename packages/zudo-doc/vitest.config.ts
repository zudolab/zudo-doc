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
      // preact-render-to-string is hoisted into the workspace root pnpm store
      // but not surfaced at root or package node_modules. Pin it explicitly so
      // JSX rendering tests work without bloating the package's own deps.
      "preact-render-to-string": findPreactRenderToString(),
    },
  },
  test: {
    root: pkgRoot,
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
  },
});
