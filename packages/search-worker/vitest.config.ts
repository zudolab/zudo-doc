import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    // These suites run concurrently with the other package suites under
    // `pnpm test:packages`; the default 5000ms intermittently times out under
    // CPU/IO contention (zudolab/zudo-doc#2547) even though each test is fast
    // in isolation. Raise the ceiling so contention doesn't cause false flakes.
    testTimeout: 20000,
  },
});
