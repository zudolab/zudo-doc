import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Slow integration tests (scaffold + install + build) live in
    // `*.slow.test.ts` files and run via `pnpm test:slow` with a separate
    // config (vitest.slow.config.ts).
    exclude: ["**/node_modules/**", "**/*.slow.test.ts"],
    testTimeout: 30000,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/__tests__/**/*.test.ts"],
        },
      },
    ],
  },
});
