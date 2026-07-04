import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Slow integration tests (scaffold + install + build) live in
    // `*.slow.test.ts` files and run via `pnpm test:slow` with a separate
    // config (vitest.slow.config.ts).
    exclude: ["**/node_modules/**", "**/*.slow.test.ts"],
    testTimeout: 30000,
    // Split into projects so the template test *copies* under templates/
    // (never picked up by tsconfig.include, but still real vitest specs) run
    // alongside the package's own src/__tests__ suite. `extends: true` is
    // required on both — vitest project configs do NOT inherit the root
    // config by default, so without it the shared exclude/testTimeout above
    // would not apply.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/__tests__/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "templates",
          include: ["templates/**/__tests__/**/*.test.ts"],
        },
      },
    ],
  },
});
