/**
 * Project-level routes: listing, creation, the composed snapshot, and the SSE
 * change stream.
 *
 * Handlers stay portable — they never touch `node:fs` directly, only the store
 * interface — so this file can run unchanged on a non-Node runtime later.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import type { AppDeps } from "../app";
import { GLOBAL_EVENTS_KEY, SubscriberLimitError, type ChangeEvent } from "../events";
import { assertProjectSlug, presetSchema, StoreError } from "../store/file-store";

/** Long enough to stay out of the way, short enough to beat idle proxies. */
export const HEARTBEAT_MS = 25_000;

const createProjectSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  preset: presetSchema.optional(),
  /** Echoed as the SSE event's `origin` so the author can skip its own event. */
  clientId: z.string().min(1).max(128).optional(),
});

const duplicateProjectSchema = z.strictObject({
  clientId: z.string().min(1).max(128).optional(),
});

export function createProjectRoutes(deps: AppDeps): Hono {
  const routes = new Hono();

  routes.get("/", async (c) => {
    const summary = c.req.query("summary") === "1";
    return c.json(
      summary
        ? await deps.store.listProjects({ summary: true })
        : await deps.store.listProjects(),
    );
  });

  routes.post("/", async (c) => {
    const parsed = createProjectSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) {
      throw badRequest(parsed.error);
    }
    const snapshot = await deps.store.createProject(parsed.data.title, parsed.data.preset);
    deps.events.publish(GLOBAL_EVENTS_KEY, {
      type: "projects-changed",
      slug: snapshot.slug,
      action: "created",
      ...(parsed.data.clientId ? { origin: parsed.data.clientId } : {}),
    });
    return c.json(snapshot, 201);
  });

  /**
   * The global change stream — every project created, deleted, or
   * duplicated, for a dashboard that must live-update when e.g. an MCP agent
   * creates a project in another process.
   *
   * MUST be registered before `GET /:project` below: `_events` can never be a
   * valid project slug (the leading underscore fails `isValidSlug`), but
   * without this ordering the param route would still shadow it.
   */
  routes.get("/_events", async (c) => {
    return streamSSE(c, async (stream) => {
      let queue = Promise.resolve();
      const send = (event: ChangeEvent) => {
        queue = queue
          .then(() => stream.writeSSE({ data: JSON.stringify(event) }))
          .catch(() => undefined);
      };

      let unsubscribe: (() => void) | undefined;
      try {
        unsubscribe = deps.events.subscribe(GLOBAL_EVENTS_KEY, send);
      } catch (error) {
        if (error instanceof SubscriberLimitError) {
          await stream.writeSSE({ event: "error", data: error.message });
          return;
        }
        throw error;
      }

      const heartbeat = setInterval(() => {
        void stream.write(": heartbeat\n\n");
      }, HEARTBEAT_MS);
      heartbeat.unref?.();

      try {
        await new Promise<void>((resolve) => {
          const finish = () => resolve();
          stream.onAbort(finish);
          c.req.raw.signal.addEventListener("abort", finish, { once: true });
        });
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
      }
    });
  });

  routes.get("/:project", async (c) => {
    const slug = c.req.param("project");
    assertProjectSlug(slug);
    return c.json(await deps.store.readSnapshot(slug));
  });

  // clientId travels as a query param since DELETE has no body.
  routes.delete("/:project", async (c) => {
    const slug = c.req.param("project");
    assertProjectSlug(slug);
    const clientId = c.req.query("clientId");

    await deps.store.deleteProject(slug);
    deps.events.publish(GLOBAL_EVENTS_KEY, {
      type: "projects-changed",
      slug,
      action: "deleted",
      ...(clientId ? { origin: clientId } : {}),
    });
    return c.json({ slug, deleted: true });
  });

  routes.post("/:project/duplicate", async (c) => {
    const slug = c.req.param("project");
    assertProjectSlug(slug);

    const parsed = duplicateProjectSchema.safeParse(await readOptionalJsonBody(c.req.raw));
    if (!parsed.success) throw badRequest(parsed.error);

    const snapshot = await deps.store.duplicateProject(slug);
    deps.events.publish(GLOBAL_EVENTS_KEY, {
      type: "projects-changed",
      // The NEW project's slug, per the wire contract — not the source's.
      slug: snapshot.slug,
      action: "duplicated",
      ...(parsed.data.clientId ? { origin: parsed.data.clientId } : {}),
    });
    return c.json(snapshot, 201);
  });

  /**
   * The change stream. Events are published by the mutation routes only after
   * the store's commit resolved, so a client that refetches on an event is
   * guaranteed to read at least the revision the event announced.
   *
   * The event type travels in the JSON payload rather than in an SSE `event:`
   * field, so a browser `EventSource` receives every change through a single
   * `onmessage` handler.
   */
  routes.get("/:project/events", async (c) => {
    const slug = c.req.param("project");
    assertProjectSlug(slug);
    // Fails fast for an unknown project rather than opening a stream that
    // could never carry an event.
    await deps.store.readSnapshot(slug);

    return streamSSE(c, async (stream) => {
      // Writes are chained: `writeSSE` is async, and two events published in
      // the same tick would otherwise interleave their frames.
      let queue = Promise.resolve();
      const send = (event: ChangeEvent) => {
        queue = queue
          .then(() => stream.writeSSE({ data: JSON.stringify(event) }))
          .catch(() => undefined);
      };

      let unsubscribe: (() => void) | undefined;
      try {
        unsubscribe = deps.events.subscribe(slug, send);
      } catch (error) {
        if (error instanceof SubscriberLimitError) {
          await stream.writeSSE({ event: "error", data: error.message });
          return;
        }
        throw error;
      }

      const heartbeat = setInterval(() => {
        // A comment frame: it keeps the connection warm without being
        // delivered to the client's message handler.
        void stream.write(": heartbeat\n\n");
      }, HEARTBEAT_MS);
      heartbeat.unref?.();

      try {
        await new Promise<void>((resolve) => {
          const finish = () => resolve();
          // Two ways a connection ends: the consumer cancels the response
          // stream (hono's own abort), or the request itself is aborted.
          stream.onAbort(finish);
          c.req.raw.signal.addEventListener("abort", finish, { once: true });
        });
      } finally {
        clearInterval(heartbeat);
        unsubscribe();
      }
    });
  });

  return routes;
}

/** A body that is absent or not JSON is a client mistake, never a 500. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new StoreError("invalid-request", "A JSON request body is required.", 400);
  }
}

/**
 * Like `readJsonBody`, but an absent/empty body is valid — for requests whose
 * every field is optional (duplicate's `{clientId?}`), a caller with nothing
 * to say should not have to send `{}` just to satisfy a body-required check.
 */
export async function readOptionalJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim().length === 0) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new StoreError("invalid-request", "The request body must be valid JSON.", 400);
  }
}

export function badRequest(error: z.ZodError): StoreError {
  const issue = error.issues[0];
  const where = issue && issue.path.length > 0 ? `"${issue.path.join(".")}": ` : "";
  return new StoreError(
    "invalid-request",
    `${where}${issue?.message ?? "invalid request body"}`,
    400,
  );
}
