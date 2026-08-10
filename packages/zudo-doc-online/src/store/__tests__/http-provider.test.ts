import { describe, expect, it, vi } from "vitest";

import { RevisionConflictError, StoreRequestError, type ProjectSnapshot } from "../contract";
import { createHttpProjectStore } from "../http-provider";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fixtureSnapshot(revision = 1): ProjectSnapshot {
  return {
    slug: "docs",
    title: "Test Project",
    revision,
    outline: { schemaVersion: 1, projectTitle: "Test Project", categories: [] },
    pages: [],
  };
}

describe("createHttpProjectStore — request shaping", () => {
  it("GETs the project snapshot", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, fixtureSnapshot()));
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const snapshot = await store.loadSnapshot();
    expect(snapshot.slug).toBe("docs");
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/projects/docs",
      expect.objectContaining({ headers: expect.objectContaining({ "Content-Type": "application/json" }) }),
    );
  });

  it("POSTs an outline command with expectedRevision, command and clientId", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, {
        revision: 2,
        changed: true,
        selectedId: "cat-1",
        snapshot: fixtureSnapshot(2),
      }),
    );
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.applyOutlineCommand(1, { type: "add-category", title: "New" });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/docs/outline/commands");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      expectedRevision: 1,
      command: { type: "add-category", title: "New" },
      clientId: "tab-a",
    });
  });

  it("GETs a page by id", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        id: "page-1",
        slug: "intro",
        categoryId: "cat-1",
        revision: 1,
        frontmatter: { title: "Intro" },
        markdown: "Hello\n",
        warnings: [],
      }),
    );
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const page = await store.loadPage("page-1");
    expect(page.markdown).toBe("Hello\n");
    expect(fetchImpl).toHaveBeenCalledWith("/api/projects/docs/pages/page-1", expect.anything());
  });

  it("PUTs a page write with expectedRevision, the given fields, and clientId — omitting fields not given", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, {
        id: "page-1",
        slug: "intro",
        categoryId: "cat-1",
        revision: 2,
        changed: true,
        frontmatter: { title: "Intro" },
        markdown: "Updated\n",
        warnings: [],
      }),
    );
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.savePage("page-1", 1, { markdown: "Updated\n" });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/docs/pages/page-1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      expectedRevision: 1,
      markdown: "Updated\n",
      clientId: "tab-a",
    });
  });

  it("respects a custom baseUrl", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, fixtureSnapshot()));
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      baseUrl: "http://localhost:4324/api",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.loadSnapshot();
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:4324/api/projects/docs",
      expect.anything(),
    );
  });
});

describe("createHttpProjectStore — error handling", () => {
  it("throws a RevisionConflictError carrying the snapshot on a 409", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(409, {
        error: { code: "revision-mismatch", message: "stale" },
        snapshot: fixtureSnapshot(5),
      }),
    );
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const attempt = store.applyOutlineCommand(1, { type: "add-category", title: "New" });
    await expect(attempt).rejects.toBeInstanceOf(RevisionConflictError);

    try {
      await store.applyOutlineCommand(1, { type: "add-category", title: "New" });
      expect.unreachable();
    } catch (error) {
      const conflict = error as RevisionConflictError;
      expect(conflict.snapshot.revision).toBe(5);
    }
  });

  it("throws a plain StoreRequestError for a non-409 failure", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(422, { error: { code: "slug-conflict", message: "taken" } }),
    );
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      store.applyOutlineCommand(1, { type: "add-category", title: "New" }),
    ).rejects.toMatchObject({ code: "slug-conflict", status: 422 });
  });

  it("wraps a fetch-level failure as a network-error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(store.loadSnapshot()).rejects.toMatchObject({
      code: "network-error",
      status: 0,
    });
    await expect(store.loadSnapshot()).rejects.toBeInstanceOf(StoreRequestError);
  });

  it("falls back to a generic error when the body carries no error code", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 500 }));
    const store = createHttpProjectStore({
      projectSlug: "docs",
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(store.loadSnapshot()).rejects.toMatchObject({
      code: "http-error",
      status: 500,
    });
  });
});
