// Config file for the Better Auth CLI schema generator. Instantiates the
// REAL `createAuth` factory (src/auth.ts) with dummy env values so the
// generated schema always matches the live plugin set.
//
// Regenerate with:
//   pnpm --filter zudo-doc-online-worker run auth:generate-schema
import { createAuth } from "../src/auth";

export const auth = createAuth({
  DB: {} as D1Database,
  BETTER_AUTH_SECRET: "dummy-secret-for-schema-generation",
  BETTER_AUTH_URL: "http://localhost:8787",
});
