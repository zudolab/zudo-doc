// Augments the ambient `Cloudflare.Env` type (used by `cloudflare:test`'s
// `env` export) with this worker's bindings plus the vitest-only
// `TEST_MIGRATIONS` binding set in vitest.config.ts.
import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
