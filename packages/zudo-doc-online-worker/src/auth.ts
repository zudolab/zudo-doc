// Better Auth wiring for zudo-doc-online-worker (epic zudolab/zudo-doc#3361).
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./auth-schema";
import { CORS_CONFIG } from "./cors";

export type AuthEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
};

// D1 bindings are request-scoped in Cloudflare Workers, so a module-scope
// Better Auth instance would capture a stale or undefined binding. Build a
// fresh instance per request instead — call this from the request handler,
// not at module load time.
export function createAuth(env: AuthEnv) {
  return betterAuth({
    database: drizzleAdapter(drizzle(env.DB), {
      provider: "sqlite",
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: CORS_CONFIG.origin,
    plugins: [bearer()],
  });
}
