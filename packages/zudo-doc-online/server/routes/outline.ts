/**
 * The outline command route — the write path for a documentation base's
 * structure.
 *
 * The command itself is NOT re-validated here. `applyCommand` in the outline
 * core is the authority on what a command may be, it never throws, and its
 * error codes are already part of the public contract; a second schema in this
 * file could only drift from it.
 */

import { Hono } from "hono";
import { z } from "zod";

import type { OutlineCommand } from "../../src/core/outline/index";
import type { AppDeps } from "../app";
import { assertProjectSlug, StoreError } from "../store/file-store";
import { badRequest, readJsonBody } from "./projects";

const commandRequestSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  command: z.unknown(),
  /** Echoed as the SSE event's `origin` so the author can skip its own event. */
  clientId: z.string().min(1).max(128).optional(),
});

export function createOutlineRoutes(deps: AppDeps): Hono {
  const routes = new Hono();

  routes.post("/:project/outline/commands", async (c) => {
    const slug = c.req.param("project");
    assertProjectSlug(slug);

    const parsed = commandRequestSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) throw badRequest(parsed.error);

    const { command } = parsed.data;
    if (typeof command !== "object" || command === null || Array.isArray(command)) {
      throw new StoreError("invalid-request", "command must be an object.", 400);
    }

    const outcome = await deps.store.applyOutlineCommand(slug, {
      expectedRevision: parsed.data.expectedRevision,
      command: command as OutlineCommand,
    });

    // A command that changed nothing produced no commit, so announcing it
    // would wake every other client for a revision that never moved.
    if (outcome.changed) {
      deps.events.publish(slug, {
        type: "outline-changed",
        revision: outcome.snapshot.revision,
        ...(parsed.data.clientId ? { origin: parsed.data.clientId } : {}),
      });
    }

    return c.json({
      revision: outcome.snapshot.revision,
      changed: outcome.changed,
      selectedId: outcome.selectedId,
      ...(outcome.createdPage ? { createdPage: outcome.createdPage } : {}),
      snapshot: outcome.snapshot,
    });
  });

  return routes;
}
