/**
 * The HTTP surface of zudo-doc online.
 *
 * This is a product contract, not an internal detail: AI agents author
 * documentation bases through these routes (epic #3327), so the shapes here
 * are the ones the MCP server (#3333) and the SPA store (#3332) both speak.
 *
 * Shared conventions:
 *
 * - Errors are always `{error: {code, message}}` with a stable `code`.
 * - **409 means exactly one thing**: the request's `expectedRevision` was
 *   stale. The body carries `snapshot` — the full current project — so the
 *   loser can rebase without a second round trip. Nothing else returns 409;
 *   a rejected-but-current request (a duplicate slug, say) is a 422.
 * - Mutations accept an optional `clientId`, echoed as `origin` on the SSE
 *   event they cause, so the author of a change can ignore its own event.
 *
 * The app itself holds no Node APIs — those live behind the store seam — so it
 * can be mounted on a non-Node runtime later.
 */

import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

import type { EventBus } from "./events";
import { StoreError, type ProjectStore } from "./store/file-store";
import { createOutlineRoutes } from "./routes/outline";
import { createPageRoutes } from "./routes/pages";
import { createProjectRoutes } from "./routes/projects";

/** Generous for markdown, small enough that a runaway client is refused early. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * The server binds loopback only, but a page on any origin can still *send* to
 * it from a browser. Restricting `Origin` keeps a random website from driving
 * the developer's local store. A missing `Origin` is allowed on purpose: that
 * is what non-browser clients (an agent, curl, the MCP server) send.
 */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

export interface AppDeps {
  store: ProjectStore;
  events: EventBus;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (origin !== undefined) {
      if (!LOCAL_ORIGIN.test(origin)) {
        return c.json(
          {
            error: {
              code: "forbidden-origin",
              message: `Origin "${origin}" is not allowed; this server serves local clients only.`,
            },
          },
          403,
        );
      }
      // Echoed so a local browser client can read the response at all.
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
    }

    // The SPA is served from another port, so every JSON POST/PUT it makes is
    // preceded by a preflight. Without an answer here the browser refuses to
    // send the mutation at all — the request never reaches a route.
    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type");
      c.header("Access-Control-Max-Age", "600");
      return c.body(null, 204);
    }

    await next();
  });

  app.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) =>
        c.json(
          {
            error: {
              code: "payload-too-large",
              message: `Request bodies are limited to ${MAX_BODY_BYTES} bytes.`,
            },
          },
          413,
        ),
    }),
  );

  app.route("/api/projects", createProjectRoutes(deps));
  app.route("/api/projects", createOutlineRoutes(deps));
  app.route("/api/projects", createPageRoutes(deps));

  app.notFound((c) =>
    c.json({ error: { code: "not-found", message: `No route for ${c.req.path}.` } }, 404),
  );

  app.onError((error, c) => {
    if (error instanceof StoreError) {
      return c.json(
        {
          error: { code: error.code, message: error.message },
          ...(error.snapshot ? { snapshot: error.snapshot } : {}),
        },
        error.status as ContentfulStatusCode,
      );
    }
    if (error instanceof ZodError) {
      return c.json(
        {
          error: {
            code: "invalid-request",
            message: error.issues[0]?.message ?? "invalid request",
          },
        },
        400,
      );
    }
    if (error instanceof HTTPException) {
      return c.json(
        { error: { code: "http-error", message: error.message } },
        error.status,
      );
    }

    console.error("[api] unhandled error:", error);
    return c.json(
      { error: { code: "internal-error", message: "Unexpected server error." } },
      500,
    );
  });

  return app;
}
