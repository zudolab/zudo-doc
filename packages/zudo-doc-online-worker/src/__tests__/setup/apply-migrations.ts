// Runs the committed migrations (migrations/*.sql) against the ephemeral
// test D1 database before any suite runs, so every test exercises the REAL
// migration chain instead of a hand-seeded schema. `TEST_MIGRATIONS` is
// populated in vitest.config.ts via readD1Migrations().
import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
