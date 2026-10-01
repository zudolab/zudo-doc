import { defineConfig } from "vitest/config";
import { zfb3SourceAliases } from "../../vitest.config.ts";

const sourceAliases = zfb3SourceAliases();

export default defineConfig({
  ...(sourceAliases.length > 0
    ? {
        esbuild: {
          jsx: "automatic" as const,
          jsxImportSource: "@takazudo/zfb/zudo-react",
        },
        resolve: { alias: sourceAliases },
      }
    : {}),
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
