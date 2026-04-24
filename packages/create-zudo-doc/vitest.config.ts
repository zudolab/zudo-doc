import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    // Slow integration tests (scaffold + install + build) live in
    // `*.slow.test.ts` files and run via `pnpm test:slow` with a separate
    // config (vitest.slow.config.ts).
    exclude: ["**/node_modules/**", "**/*.slow.test.ts"],
    testTimeout: 30000,
  },
});
