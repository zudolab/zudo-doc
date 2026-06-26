import { defineConfig } from "vitest/config";

/**
 * Slow tier: integration tests that scaffold a real project, install
 * dependencies, and run a full zfb build. Runtime per test can exceed a
 * minute, so they are excluded from the default `pnpm test` run and gated
 * behind `pnpm test:slow`.
 *
 * The matching tests live next to unit tests but use the `*.slow.test.ts`
 * suffix; the default vitest config (vitest.config.ts) excludes that suffix.
 */
export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.slow.test.ts"],
    // Run slow files SEQUENTIALLY. Each scaffolds a project + `pnpm install` +
    // a full zfb build (Rust pipeline + esbuild); running two at once on the
    // nightly CI runner (2-4 cores) doubles peak CPU/memory AND doubles the
    // concurrent registry-fetch surface that `installScaffoldedDeps` retries
    // for. Back-to-back is safer and each file already runs in its own forked
    // process (so the per-file `process.chdir` dance stays isolated).
    fileParallelism: false,
    // 5 minutes per test — scaffold + pnpm install + zfb build can be slow
    // on a cold pnpm store.
    testTimeout: 5 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
  },
});
