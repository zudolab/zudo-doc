import { describe, expect, it, vi } from "vitest";

import { StoreRequestError } from "../contract";
import { createHttpProjectsDirectoryStore } from "../projects-http-provider";
import type { ProjectDirectorySnapshot } from "../projects-directory";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fixtureSnapshot(overrides: Partial<ProjectDirectorySnapshot> = {}): ProjectDirectorySnapshot {
  return {
    slug: "aurora-docs",
    title: "Aurora Docs",
    revision: 1,
    outline: { schemaVersion: 1, projectTitle: "Aurora Docs", categories: [] },
    pages: [],
    ...overrides,
  };
}

describe("createHttpProjectsDirectoryStore — request shaping", () => {
  it("GETs the plain list at /api/projects", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, [{ slug: "aurora-docs", title: "Aurora Docs", revision: 1 }]),
    );
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const list = await store.listProjects();

    expect(list).toEqual([{ slug: "aurora-docs", title: "Aurora Docs", revision: 1 }]);
    expect(fetchImpl).toHaveBeenCalledWith("/api/projects", expect.anything());
  });

  it("GETs the summary list with ?summary=1", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, []));
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.listProjects({ summary: true });

    expect(fetchImpl).toHaveBeenCalledWith("/api/projects?summary=1", expect.anything());
  });

  it("GETs a project by slug", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, fixtureSnapshot()));
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const snapshot = await store.getProject("aurora-docs");

    expect(snapshot.slug).toBe("aurora-docs");
    expect(fetchImpl).toHaveBeenCalledWith("/api/projects/aurora-docs", expect.anything());
  });

  it("POSTs a create with title, preset and clientId in the body", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(201, fixtureSnapshot()),
    );
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.createProject("Aurora Docs", { schemaVersion: 1, themePack: "aurora" });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      title: "Aurora Docs",
      preset: { schemaVersion: 1, themePack: "aurora" },
      clientId: "tab-a",
    });
  });

  it("omits preset from the body when not given", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(201, fixtureSnapshot()),
    );
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.createProject("Aurora Docs");

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ title: "Aurora Docs", clientId: "tab-a" });
  });

  it("DELETEs with clientId as a query param, not a body", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, { slug: "aurora-docs", deleted: true }),
    );
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await store.deleteProject("aurora-docs");

    expect(result).toEqual({ slug: "aurora-docs", deleted: true });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/aurora-docs?clientId=tab-a");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("URL-encodes the clientId in the delete query param", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, { slug: "aurora-docs", deleted: true }),
    );
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab a/b",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.deleteProject("aurora-docs");

    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/aurora-docs?clientId=tab%20a%2Fb");
  });

  it("POSTs a duplicate with clientId in the body and the /duplicate path", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(201, fixtureSnapshot({ slug: "aurora-docs-copy", title: "Aurora Docs copy" })),
    );
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const duplicate = await store.duplicateProject("aurora-docs");

    expect(duplicate.slug).toBe("aurora-docs-copy");
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/aurora-docs/duplicate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ clientId: "tab-a" });
  });

  it("respects a custom baseUrl", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, []));
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      baseUrl: "http://localhost:4324/api",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.listProjects();

    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:4324/api/projects", expect.anything());
  });
});

describe("createHttpProjectsDirectoryStore — error handling", () => {
  it("maps a 404 to project-not-found", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(404, { error: { code: "project-not-found", message: "no such project" } }),
    );
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(store.getProject("nope")).rejects.toMatchObject({
      code: "project-not-found",
      status: 404,
    });
    await expect(store.getProject("nope")).rejects.toBeInstanceOf(StoreRequestError);
  });

  it("wraps a fetch-level failure as a network-error with status 0", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(store.listProjects()).rejects.toMatchObject({ code: "network-error", status: 0 });
  });

  it("falls back to a generic error when the body carries no error code", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 500 }));
    const store = createHttpProjectsDirectoryStore({
      clientId: "tab-a",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(store.listProjects()).rejects.toMatchObject({ code: "http-error", status: 500 });
  });
});
