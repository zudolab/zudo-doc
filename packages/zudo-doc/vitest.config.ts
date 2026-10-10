import { defineConfig } from "vitest/config";
import { zfb3SourceAliases } from "../../vitest.config";

/** Package tests run against source exports with ZFB3_SOURCE_RESOLVE=1. */
export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "@takazudo/zfb/zudo-react" },
  resolve: { alias: zfb3SourceAliases() },
  test: {
    root: __dirname,
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/*.slow.test.ts"],
    testTimeout: 30_000,
  },
});
