import { defineConfig } from "vitest/config";

/**
 * Vitest config scoped to the framework primitives package.
 *
 * The repo-root vitest.config.ts only includes `src/**` and `scripts/**`,
 * so this local config exists purely so unit tests under
 * `packages/zudo-doc-v2/src/**\/__tests__/` can run via:
 *
 *   pnpm exec vitest run --config packages/zudo-doc-v2/vitest.config.ts
 *
 * No package.json scripts are added here on purpose — topic-child agents
 * for E5 keep package.json untouched per the manager's hard rule.
 */
export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
