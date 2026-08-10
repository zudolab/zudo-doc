/**
 * `ZudoDocOnlineClient` in isolation: the REST wrapper's own error mapping,
 * exercised both against the in-process app and against injected fetch
 * failures that a real server never produces (a dead connection, a
 * non-JSON body).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createHarness, type TestHarness } from "../../server/__tests__/support";
import { ApiError, ZudoDocOnlineClient } from "../client";

let harness: TestHarness;

beforeEach(async () => {
  harness = await createHarness();
});

afterEach(async () => {
  await harness.cleanup();
});

function clientFor(fetchImpl?: typeof fetch): ZudoDocOnlineClient {
  return new ZudoDocOnlineClient({
    fetch: fetchImpl ?? ((input, init) => Promise.resolve(harness.app.request(input, init))),
  });
}

describe("against the in-process app", () => {
  it("round-trips a project through create, read and outline commands", async () => {
    const client = clientFor();

    expect(await client.listProjects()).toEqual([]);

    const created = await client.createProject("Docs");
    expect(created).toMatchObject({ slug: "docs", revision: 1 });

    const fetched = await client.getProject("docs");
    expect(fetched).toEqual(created);

    const outcome = await client.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
    });
    expect(outcome).toMatchObject({ revision: 2, changed: true });
    expect(outcome.snapshot.outline.categories).toHaveLength(2);
  });

  it("reads and writes a page", async () => {
    const client = clientFor();
    const created = await client.createProject("Docs");
    const pageId = created.pages[0]?.id as string;

    const page = await client.getPage("docs", pageId);
    expect(page.frontmatter.title).toBe("Introduction");
    expect(page.warnings).toEqual([]);

    const written = await client.writePage("docs", pageId, {
      expectedRevision: 1,
      markdown: "## Hello\n",
    });
    expect(written).toMatchObject({ revision: 2, changed: true });
  });

  it("throws ApiError with the current snapshot on a stale revision", async () => {
    const client = clientFor();
    await client.createProject("Docs");
    await client.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
    });

    await expect(
      client.applyOutlineCommand("docs", {
        expectedRevision: 1,
        command: { type: "add-category", title: "Reference" },
      }),
    ).rejects.toMatchObject({
      code: "revision-mismatch",
      status: 409,
      snapshot: expect.objectContaining({ revision: 2 }),
    });
  });

  it("throws ApiError with the server's code for a 404", async () => {
    const client = clientFor();
    await expect(client.getProject("missing")).rejects.toMatchObject({
      code: "project-not-found",
      status: 404,
    });
  });

  it("createProject forwards an optional preset", async () => {
    const client = clientFor();
    const created = await client.createProject("Docs", { schemaVersion: 1, themePack: "aurora" });
    expect(created.preset).toEqual({ schemaVersion: 1, themePack: "aurora" });
  });

  it("listProjects({ summary: true }) adds per-project counts and metadata", async () => {
    const client = clientFor();
    await client.createProject("Docs");

    expect(await client.listProjects()).toEqual([
      { slug: "docs", title: "Docs", revision: 1 },
    ]);
    expect(await client.listProjects({ summary: true })).toEqual([
      expect.objectContaining({
        slug: "docs",
        title: "Docs",
        revision: 1,
        pageCount: 1,
        draftCount: 0,
        categoryCount: 1,
      }),
    ]);
  });

  it("duplicateProject copies the project under a new slug at revision 1", async () => {
    const client = clientFor();
    await client.createProject("Docs");
    const duplicated = await client.duplicateProject("docs");
    expect(duplicated).toMatchObject({ slug: "docs-copy", title: "Docs copy", revision: 1 });
  });

  it("deleteProject removes the project and returns {slug, deleted: true}", async () => {
    const client = clientFor();
    await client.createProject("Docs");
    await expect(client.deleteProject("docs")).resolves.toEqual({ slug: "docs", deleted: true });
    await expect(client.getProject("docs")).rejects.toMatchObject({ code: "project-not-found" });
  });

  it("deleteProject sends clientId as a query param, not a body", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const client = new ZudoDocOnlineClient({
      fetch: (input, init) => {
        seen.url = String(input);
        seen.init = init;
        return Promise.resolve(new Response(JSON.stringify({ slug: "docs", deleted: true })));
      },
    });
    await client.deleteProject("docs", "tab-1");
    expect(seen.url).toBe("http://127.0.0.1:4324/api/projects/docs?clientId=tab-1");
    expect(seen.init?.body).toBeUndefined();
  });
});

describe("failures the server never produces", () => {
  it("wraps a rejected fetch as a network-error ApiError", async () => {
    const client = clientFor(() => Promise.reject(new Error("ECONNREFUSED")));
    await expect(client.listProjects()).rejects.toMatchObject({
      code: "network-error",
      status: 0,
    });
  });

  it("wraps a connection dropped mid-body-stream as network-error too", async () => {
    // `fetch` resolves as soon as headers arrive; the failure surfaces later,
    // from `response.text()` — a distinct code path from a rejected fetch.
    const response = new Response("", { status: 200 });
    response.text = () => Promise.reject(new Error("stream reset"));
    const client = clientFor(() => Promise.resolve(response));
    await expect(client.listProjects()).rejects.toMatchObject({
      code: "network-error",
      status: 0,
    });
  });

  it("treats a non-JSON success body as invalid-response", async () => {
    const client = clientFor(() => Promise.resolve(new Response("not json", { status: 200 })));
    await expect(client.listProjects()).rejects.toMatchObject({
      code: "invalid-response",
    });
  });

  it("falls back to a generic message when an error body has no JSON", async () => {
    const client = clientFor(() => Promise.resolve(new Response("", { status: 500 })));
    await expect(client.listProjects()).rejects.toBeInstanceOf(ApiError);
    await expect(client.listProjects()).rejects.toMatchObject({
      code: "http-error",
      status: 500,
    });
  });
});

describe("base URL resolution", () => {
  it("defaults to the loopback API port", async () => {
    const seen: string[] = [];
    const client = new ZudoDocOnlineClient({
      fetch: (input) => {
        seen.push(String(input));
        return Promise.resolve(new Response("[]", { status: 200 }));
      },
    });
    await client.listProjects();
    expect(seen[0]).toBe("http://127.0.0.1:4324/api/projects");
  });

  it("prefers an explicit baseUrl over the environment", async () => {
    const seen: string[] = [];
    const client = new ZudoDocOnlineClient({
      baseUrl: "http://127.0.0.1:9999/",
      fetch: (input) => {
        seen.push(String(input));
        return Promise.resolve(new Response("[]", { status: 200 }));
      },
    });
    await client.listProjects();
    expect(seen[0]).toBe("http://127.0.0.1:9999/api/projects");
  });
});
