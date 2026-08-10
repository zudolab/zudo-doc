import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  // Load the committed migrations (migrations/0001_better_auth.sql etc.) so
  // every test run applies the REAL migration chain, catching drift between
  // src/auth-schema.ts and the tracked SQL (see the schema-parity test).
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      include: ["src/__tests__/**/*.test.ts"],
      setupFiles: ["./src/__tests__/setup/apply-migrations.ts"],
      // These suites run concurrently with the other package suites under
      // `pnpm test:packages`; the default 5000ms intermittently times out under
      // CPU/IO contention (zudolab/zudo-doc#2547) even though each test is fast
      // in isolation. Raise the ceiling so contention doesn't cause false flakes.
      testTimeout: 20000,
    },
  };
});
