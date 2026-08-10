// zudo-doc-online-worker — future remote backend for packages/zudo-doc-online
// (epic zudolab/zudo-doc#3361). Local authoring stays on the auth-free API
// server at port 4324; this worker exists only for the eventual remote path.
//
// Response format note: the `{ error: { code, message } }` shape below applies
// only to routes this worker owns directly (e.g. /api/health). The future
// `/api/auth/*` routes mounted from Better Auth keep Better Auth's own
// response format — do not force them through this mapping.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { CORS_CONFIG } from "./cors";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors(CORS_CONFIG));

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));

app.onError((err, c) => {
  console.error("zudo-doc-online-worker error:", err);
  return c.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    500,
  );
});

export default app;
