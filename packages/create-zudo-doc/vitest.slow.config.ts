import { defineConfig } from "vitest/config";

/**
 * Slow tier: integration tests that scaffold a real project, install
 * dependencies, and run a full Astro build. Runtime per test can exceed a
 * minute, so they are excluded from the default `pnpm test` run and gated
 * behind `pnpm test:slow`.
 *
 * The matching tests live next to unit tests but use the `*.slow.test.ts`
 * suffix; the default vitest config (vitest.config.ts) excludes that suffix.
 */
export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.slow.test.ts"],
    // 5 minutes per test — scaffold + pnpm install + astro build can be slow
    // on a cold pnpm store.
    testTimeout: 5 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
  },
});
