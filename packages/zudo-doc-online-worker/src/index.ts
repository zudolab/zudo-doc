// zudo-doc-online-worker — future remote backend for packages/zudo-doc-online
// (epic zudolab/zudo-doc#3361). Local authoring stays on the auth-free API
// server at port 4324; this worker exists only for the eventual remote path.
//
// Response format note: the `{ error: { code, message } }` shape below applies
// only to routes this worker owns directly (e.g. /api/health, /api/me). The
// `/api/auth/*` routes mounted from Better Auth keep Better Auth's own
// response format — do not force them through this mapping.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { CORS_CONFIG } from "./cors";
import { createAuth } from "./auth";
import { type AppEnv, requireSession } from "./middleware/require-session";
import { meRoute } from "./routes/me";

const app = new Hono<AppEnv>();

app.use("*", cors(CORS_CONFIG));

// Registered BEFORE the session gate so Better Auth answers its own endpoints
// first — gating sign-in behind a session would be unsatisfiable. The auth
// instance is built per request because D1 bindings are request-scoped.
app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

app.use("/api/*", requireSession);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.get("/api/me", meRoute);

app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));

app.onError((err, c) => {
  console.error("zudo-doc-online-worker error:", err);
  return c.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    500,
  );
});

export default app;
