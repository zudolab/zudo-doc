import { defineConfig } from "vitest/config";

// The package directory — vitest resolves `include` globs relative to `root`,
// which defaults to process.cwd() (the workspace root) rather than the config
// file's directory. Setting it explicitly mirrors vitest.config.ts so this
// config also works when invoked as
// `pnpm exec vitest run --config packages/zudo-doc/vitest.slow.config.ts`
// from the repo root, not only via `pnpm --filter @takazudo/zudo-doc test:slow`.
const pkgRoot = __dirname;

/**
 * Slow tier: `route-injection-build.slow.test.ts` runs ~11 real `zfb build`s
 * (Rust content pipeline + Tailwind + esbuild) against committed fixtures,
 * plus an `npm pack` round trip for the published-package-shape case — ~220s
 * total. `img-src-check-build.slow.test.ts` adds three focused fixture builds
 * for the raw HTML image-source lifecycle. Both are excluded from the default
 * `pnpm test` run (vitest.config.ts) and gated behind
 * `pnpm --filter @takazudo/zudo-doc test:slow`.
 *
 * Mirrors packages/create-zudo-doc/vitest.slow.config.ts (zudolab/zudo-doc#2530).
 */
export default defineConfig({
  test: {
    root: pkgRoot,
    include: ["src/**/__tests__/**/*.slow.test.ts"],
    // Keep slow files sequential (not fileParallelism) so the real builds do
    // not run concurrently and a future addition doesn't double concurrent
    // `zfb build` / registry-fetch load on a CPU-constrained CI runner —
    // same reasoning as packages/create-zudo-doc/vitest.slow.config.ts.
    fileParallelism: false,
    // 5 minutes per test — headroom beyond the file's own per-`it` 180s
    // timeouts for a cold pnpm store / loaded CI runner.
    testTimeout: 5 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
  },
});
