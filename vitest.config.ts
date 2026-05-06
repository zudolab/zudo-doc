import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@/": resolve(__dirname, "src") + "/",
    },
  },
  test: {
    include: [
      "src/**/__tests__/**/*.test.ts",
      "scripts/__tests__/**/*.test.ts",
      "scripts/migration-check/__tests__/**/*.test.ts",
    ],
  },
});
