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
import { SubscriberLimitError, type ChangeEvent } from "../events";
import { assertProjectSlug, StoreError } from "../store/file-store";

/** Long enough to stay out of the way, short enough to beat idle proxies. */
export const HEARTBEAT_MS = 25_000;

const createProjectSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
});

export function createProjectRoutes(deps: AppDeps): Hono {
  const routes = new Hono();

  routes.get("/", async (c) => c.json(await deps.store.listProjects()));

  routes.post("/", async (c) => {
    const parsed = createProjectSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) {
      throw badRequest(parsed.error);
    }
    return c.json(await deps.store.createProject(parsed.data.title), 201);
  });

  routes.get("/:project", async (c) => {
    const slug = c.req.param("project");
    assertProjectSlug(slug);
    return c.json(await deps.store.readSnapshot(slug));
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

export function badRequest(error: z.ZodError): StoreError {
  const issue = error.issues[0];
  const where = issue && issue.path.length > 0 ? `"${issue.path.join(".")}": ` : "";
  return new StoreError(
    "invalid-request",
    `${where}${issue?.message ?? "invalid request body"}`,
    400,
  );
}
