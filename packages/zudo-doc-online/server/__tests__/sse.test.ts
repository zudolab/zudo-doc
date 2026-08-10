/**
 * The change stream: what gets published, when, and what happens to the
 * bookkeeping when a client goes away.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GLOBAL_EVENTS_KEY, type ChangeEvent } from "../events";
import type { ProjectSnapshot } from "../store/file-store";
import { createHarness, json, type TestHarness } from "./support";

let harness: TestHarness;

beforeEach(async () => {
  harness = await createHarness();
  const created = await harness.app.request("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Docs" }),
  });
  expect((await json<ProjectSnapshot>(created)).slug).toBe("docs");
});

afterEach(async () => {
  await harness.cleanup();
});

async function command(body: unknown): Promise<Response> {
  return harness.app.request("/api/projects/docs/outline/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

describe("event publication", () => {
  it("announces an outline change after the commit, echoing clientId as origin", async () => {
    const received: ChangeEvent[] = [];
    harness.events.subscribe("docs", (event) => received.push(event));

    await command({
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
      clientId: "tab-a",
    });

    expect(received).toEqual([
      { type: "outline-changed", revision: 2, origin: "tab-a" },
    ]);
  });

  it("omits origin when the mutation carried no clientId", async () => {
    const received: ChangeEvent[] = [];
    harness.events.subscribe("docs", (event) => received.push(event));

    await command({ expectedRevision: 1, command: { type: "add-category", title: "Guides" } });

    expect(received).toEqual([{ type: "outline-changed", revision: 2 }]);
  });

  it("names the page on a page write", async () => {
    const received: ChangeEvent[] = [];
    harness.events.subscribe("docs", (event) => received.push(event));

    await harness.app.request("/api/projects/docs/pages/page-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: 1, markdown: "new\n", clientId: "editor" }),
    });

    expect(received).toEqual([
      { type: "page-changed", pageId: "page-1", revision: 2, origin: "editor" },
    ]);
  });

  it("says nothing when nothing changed", async () => {
    const stored = await json<{ frontmatter: unknown; markdown: string }>(
      await harness.app.request("/api/projects/docs/pages/page-1"),
    );

    const listener = vi.fn();
    harness.events.subscribe("docs", listener);

    await command({
      expectedRevision: 1,
      command: { type: "rename-category", categoryId: "category-1", title: "Getting started" },
    });
    // Re-saving the identical page is the autosave case: no bytes change, so
    // no revision moves and no other client is woken.
    await harness.app.request("/api/projects/docs/pages/page-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedRevision: 1,
        frontmatter: stored.frontmatter,
        markdown: stored.markdown,
      }),
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not announce a rejected mutation", async () => {
    const listener = vi.fn();
    harness.events.subscribe("docs", listener);

    const response = await command({
      expectedRevision: 99,
      command: { type: "add-category", title: "Guides" },
    });

    expect(response.status).toBe(409);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("GET /api/projects/:project/events", () => {
  it("404s rather than opening a stream for an unknown project", async () => {
    const response = await harness.app.request("/api/projects/ghost/events");
    expect(response.status).toBe(404);
  });

  it("streams a change to a connected client and cleans up on disconnect", async () => {
    const response = await harness.app.request("/api/projects/docs/events");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) return;

    // The handler subscribes inside the streaming callback, which runs after
    // the response headers are returned.
    await waitFor(() => harness.events.subscriberCount("docs") === 1, "the subscription");

    await command({
      expectedRevision: 1,
      command: { type: "add-page", categoryId: "category-1", title: "Streamed" },
      clientId: "tab-b",
    });

    const chunk = await reader.read();
    const frame = new TextDecoder().decode(chunk.value);
    expect(frame.startsWith("data: ")).toBe(true);
    expect(JSON.parse(frame.slice("data: ".length).trim())).toEqual({
      type: "outline-changed",
      revision: 2,
      origin: "tab-b",
    });

    await reader.cancel();
    await waitFor(
      () => harness.events.subscriberCount("docs") === 0,
      "the subscription to be released",
    );
    expect(harness.events.trackedProjects).toBe(0);
  });
});

describe("global projects-changed events", () => {
  it("publishes created/deleted/duplicated with the exact event shape", async () => {
    const received: ChangeEvent[] = [];
    harness.events.subscribe(GLOBAL_EVENTS_KEY, (event) => received.push(event));

    const created = await harness.app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Guides", clientId: "tab-a" }),
    });
    expect((await json<ProjectSnapshot>(created)).slug).toBe("guides");

    await harness.app.request("/api/projects/guides", { method: "DELETE" });

    await harness.app.request("/api/projects/docs/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "tab-b" }),
    });

    expect(received).toEqual([
      { type: "projects-changed", slug: "guides", action: "created", origin: "tab-a" },
      { type: "projects-changed", slug: "guides", action: "deleted" },
      {
        type: "projects-changed",
        slug: "docs-copy",
        action: "duplicated",
        origin: "tab-b",
      },
    ]);
  });

  it("never announces a project-scoped outline/page commit on the global stream", async () => {
    const received: ChangeEvent[] = [];
    harness.events.subscribe(GLOBAL_EVENTS_KEY, (event) => received.push(event));

    await command({
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
    });

    expect(received).toEqual([]);
  });

  it("streams a projects-changed event to a connected client", async () => {
    const response = await harness.app.request("/api/projects/_events");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) return;

    await waitFor(
      () => harness.events.subscriberCount(GLOBAL_EVENTS_KEY) === 1,
      "the global subscription",
    );

    await harness.app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Guides" }),
    });

    const chunk = await reader.read();
    const frame = new TextDecoder().decode(chunk.value);
    expect(frame.startsWith("data: ")).toBe(true);
    expect(JSON.parse(frame.slice("data: ".length).trim())).toEqual({
      type: "projects-changed",
      slug: "guides",
      action: "created",
    });

    await reader.cancel();
    await waitFor(
      () => harness.events.subscriberCount(GLOBAL_EVENTS_KEY) === 0,
      "the global subscription to be released",
    );
  });

  it("keeps a project titled Events listable and its own per-project stream reachable", async () => {
    const events = await harness.app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Events" }),
    });
    expect((await json<ProjectSnapshot>(events)).slug).toBe("events");

    // The literal `/_events` route must not shadow the real "events" slug's
    // own per-project stream.
    const response = await harness.app.request("/api/projects/events/events");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    await response.body?.cancel();
  });
});
