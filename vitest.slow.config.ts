import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { zfb3SourceAliases } from "./vitest.config.ts";

/** PR-gated subprocess suite. */
export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "@takazudo/zfb/zudo-react" } },
  resolve: {
    alias: [{ find: "@/", replacement: resolve(import.meta.dirname, "src") + "/" }, ...zfb3SourceAliases()],
  },
  test: {
    name: "slow-unit",
    include: ["scripts/__tests__/**/*.slow.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
  },
});
