import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * PR-gated slow root-unit lane. These specs exercise shell scripts and CLIs
 * in child processes, so they are excluded from the default root unit lane
 * but remain blocking coverage in CI and `pnpm b4push`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@/": resolve(__dirname, "src") + "/",
      // Keep the root test aliases in the dedicated config as well: the tags
      // audit suite imports the project config and package theme graph.
      "react/jsx-runtime": "preact/jsx-runtime",
      "react/jsx-dev-runtime": "preact/jsx-runtime",
      "react-dom/test-utils": "preact/test-utils",
      "react-dom": "preact/compat",
      react: "preact/compat",
    },
  },
  test: {
    name: "slow-unit",
    include: ["scripts/__tests__/**/*.slow.test.ts"],
    // Keep subprocess-heavy files sequential on constrained CI runners.
    fileParallelism: false,
    testTimeout: 60_000,
    server: {
      deps: {
        inline: [/@takazudo\/zfb/],
      },
    },
  },
});
