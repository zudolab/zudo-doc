/**
 * REST contract, driven in-process through `app.request` — Hono's test entry
 * point. No socket is ever opened here.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthoringWarning } from "../authoring-lint";
import { MAX_BODY_BYTES } from "../app";
import type { ProjectListSummary, ProjectSnapshot, ProjectSummary } from "../store/file-store";
import { createHarness, json, type TestHarness } from "./support";

let harness: TestHarness;

beforeEach(async () => {
  harness = await createHarness();
});

afterEach(async () => {
  await harness.cleanup();
});

async function request(pathname: string, init?: RequestInit): Promise<Response> {
  return harness.app.request(pathname, init);
}

function postJson(pathname: string, body: unknown): Promise<Response> {
  return request(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putJson(pathname: string, body: unknown): Promise<Response> {
  return request(pathname, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface ErrorBody {
  error: { code: string; message: string };
  snapshot?: ProjectSnapshot;
}

async function seedProject(): Promise<ProjectSnapshot> {
  const response = await postJson("/api/projects", { title: "Docs" });
  expect(response.status).toBe(201);
  return json<ProjectSnapshot>(response);
}

describe("GET/POST /api/projects", () => {
  it("starts empty and lists what was created", async () => {
    expect(await json(await request("/api/projects"))).toEqual([]);

    await seedProject();
    const listed = await json<ProjectSummary[]>(await request("/api/projects"));
    expect(listed).toEqual([{ slug: "docs", title: "Docs", revision: 1 }]);
  });

  it("rejects a body that is not a valid create payload", async () => {
    const missing = await postJson("/api/projects", {});
    expect(missing.status).toBe(400);
    expect((await json<ErrorBody>(missing)).error.code).toBe("invalid-request");

    const extra = await postJson("/api/projects", { title: "X", unexpected: 1 });
    expect(extra.status).toBe(400);
  });

  it("rejects a request with no JSON body", async () => {
    const response = await request("/api/projects", { method: "POST" });
    expect(response.status).toBe(400);
  });

  it("accepts an optional preset and returns it on the snapshot", async () => {
    const preset = { schemaVersion: 1, themePack: "aurora", defaultMode: "dark" };
    const response = await postJson("/api/projects", { title: "Docs", preset });
    expect(response.status).toBe(201);
    expect((await json<ProjectSnapshot>(response)).preset).toEqual(preset);
  });

  it("rejects a preset missing its required schemaVersion literal", async () => {
    const response = await postJson("/api/projects", {
      title: "Docs",
      preset: { themePack: "aurora" },
    });
    expect(response.status).toBe(400);
  });
});

describe("GET /api/projects?summary=1", () => {
  it("adds counts and metadata without changing the plain list", async () => {
    await seedProject();

    const plain = await json<ProjectSummary[]>(await request("/api/projects"));
    expect(plain).toEqual([{ slug: "docs", title: "Docs", revision: 1 }]);

    const summary = await json<ProjectListSummary[]>(
      await request("/api/projects?summary=1"),
    );
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      slug: "docs",
      title: "Docs",
      revision: 1,
      pageCount: 1,
      draftCount: 0,
      categoryCount: 1,
    });
    expect(summary[0]?.createdAt).toEqual(expect.any(String));
    expect(summary[0]?.updatedAt).toEqual(expect.any(String));
  });
});

describe("DELETE /api/projects/:project", () => {
  it("trash-renames the project and returns {slug, deleted: true}", async () => {
    await seedProject();

    const response = await request("/api/projects/docs", { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ slug: "docs", deleted: true });

    expect(await json(await request("/api/projects"))).toEqual([]);
    expect((await request("/api/projects/docs")).status).toBe(404);
  });

  it("lets the deleted slug be re-created immediately", async () => {
    await seedProject();
    await request("/api/projects/docs", { method: "DELETE" });

    const recreated = await postJson("/api/projects", { title: "Docs" });
    expect(recreated.status).toBe(201);
    expect((await json<ProjectSnapshot>(recreated)).slug).toBe("docs");
  });

  it("404s deleting an unknown slug", async () => {
    const response = await request("/api/projects/ghost", { method: "DELETE" });
    expect(response.status).toBe(404);
    expect((await json<ErrorBody>(response)).error.code).toBe("project-not-found");
  });

  it("keeps a project titled Events fully listable/openable alongside the _events route", async () => {
    const events = await postJson("/api/projects", { title: "Events" });
    expect(events.status).toBe(201);
    expect((await json<ProjectSnapshot>(events)).slug).toBe("events");

    const listed = await json<ProjectSummary[]>(await request("/api/projects"));
    expect(listed.map((project) => project.slug)).toContain("events");

    const opened = await request("/api/projects/events");
    expect(opened.status).toBe(200);
    expect((await json<ProjectSnapshot>(opened)).title).toBe("Events");
  });
});

describe("POST /api/projects/:project/duplicate", () => {
  it("creates a copy with both title halves rewritten and a fresh revision", async () => {
    await seedProject();

    const response = await postJson("/api/projects/docs/duplicate", {});
    expect(response.status).toBe(201);

    const copy = await json<ProjectSnapshot>(response);
    expect(copy.slug).toBe("docs-copy");
    expect(copy.title).toBe("Docs copy");
    expect(copy.outline.projectTitle).toBe("Docs copy");
    expect(copy.revision).toBe(1);
  });

  it("accepts a request with no body at all", async () => {
    await seedProject();
    const response = await request("/api/projects/docs/duplicate", { method: "POST" });
    expect(response.status).toBe(201);
  });

  it("404s duplicating an unknown slug", async () => {
    const response = await postJson("/api/projects/ghost/duplicate", {});
    expect(response.status).toBe(404);
    expect((await json<ErrorBody>(response)).error.code).toBe("project-not-found");
  });
});

describe("GET /api/projects/:project", () => {
  it("composes the outline with each page's frontmatter", async () => {
    await seedProject();
    const snapshot = await json<ProjectSnapshot>(await request("/api/projects/docs"));

    expect(snapshot.revision).toBe(1);
    expect(snapshot.pages).toEqual([
      { id: "page-1", slug: "index", categoryId: "category-1", title: "Introduction" },
    ]);
  });

  it("404s an unknown project", async () => {
    const response = await request("/api/projects/missing");
    expect(response.status).toBe(404);
    expect((await json<ErrorBody>(response)).error.code).toBe("project-not-found");
  });

  it("400s a slug that is not an identifier", async () => {
    for (const slug of ["with%2Fslash", "UPPER", "has.dot", "trailing-"]) {
      const response = await request(`/api/projects/${slug}`);
      expect(response.status).toBe(400);
      expect((await json<ErrorBody>(response)).error.code).toBe("invalid-request");
    }
  });

  it("never routes a dot-dot segment to a handler at all", async () => {
    // URL normalization collapses `..` before the router sees it, so the
    // traversal attempt lands on a path that simply does not exist.
    expect((await request("/api/projects/../../etc/passwd")).status).toBe(404);
  });

  it("404s an unrouted path with the standard error shape", async () => {
    const response = await request("/api/nope");
    expect(response.status).toBe(404);
    expect((await json<ErrorBody>(response)).error.code).toBe("not-found");
  });
});

describe("POST /api/projects/:project/outline/commands", () => {
  beforeEach(seedProject);

  it("applies a command and returns the new snapshot", async () => {
    const response = await postJson("/api/projects/docs/outline/commands", {
      expectedRevision: 1,
      command: { type: "add-page", categoryId: "category-1", title: "Deploying" },
    });

    expect(response.status).toBe(200);
    const body = await json<{
      revision: number;
      changed: boolean;
      selectedId: string;
      createdPage: { id: string; slug: string; title: string };
      snapshot: ProjectSnapshot;
    }>(response);

    expect(body).toMatchObject({
      revision: 2,
      changed: true,
      selectedId: "page-2",
      createdPage: { id: "page-2", slug: "deploying", title: "Deploying" },
    });
    expect(body.snapshot.pages.at(-1)).toMatchObject({ id: "page-2", title: "Deploying" });
  });

  it("reports a no-op without moving the revision", async () => {
    const response = await postJson("/api/projects/docs/outline/commands", {
      expectedRevision: 1,
      command: {
        type: "rename-category",
        categoryId: "category-1",
        title: "Getting started",
      },
    });

    expect(await json<{ changed: boolean; revision: number }>(response)).toMatchObject({
      changed: false,
      revision: 1,
    });
  });

  it("answers a stale revision with 409 and the full current snapshot", async () => {
    await postJson("/api/projects/docs/outline/commands", {
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
    });

    const response = await postJson("/api/projects/docs/outline/commands", {
      expectedRevision: 1,
      command: { type: "add-category", title: "Reference" },
    });

    expect(response.status).toBe(409);
    const body = await json<ErrorBody>(response);
    expect(body.error.code).toBe("revision-mismatch");
    expect(body.snapshot?.revision).toBe(2);
    expect(body.snapshot?.outline.categories).toHaveLength(2);
  });

  it("maps command failures onto their own status codes", async () => {
    const unknownCategory = await postJson("/api/projects/docs/outline/commands", {
      expectedRevision: 1,
      command: { type: "add-page", categoryId: "ghost", title: "X" },
    });
    expect(unknownCategory.status).toBe(404);
    expect((await json<ErrorBody>(unknownCategory)).error.code).toBe("category-not-found");

    const badSlug = await postJson("/api/projects/docs/outline/commands", {
      expectedRevision: 1,
      command: { type: "add-page", categoryId: "category-1", title: "X", slug: "Not A Slug" },
    });
    expect(badSlug.status).toBe(400);

    const unknownCommand = await postJson("/api/projects/docs/outline/commands", {
      expectedRevision: 1,
      command: { type: "explode" },
    });
    expect(unknownCommand.status).toBe(400);
    expect((await json<ErrorBody>(unknownCommand)).error.code).toBe("unknown-command");
  });

  it("reports a structurally broken replace-doc as a command error, not a 500", async () => {
    const response = await postJson("/api/projects/docs/outline/commands", {
      expectedRevision: 1,
      command: {
        type: "replace-doc",
        doc: {
          schemaVersion: 1,
          projectTitle: "Docs",
          categories: [{ id: "c", slug: "c", title: "C", pages: 1 }],
        },
      },
    });

    expect(response.status).toBe(422);
    expect((await json<ErrorBody>(response)).error.code).toBe("invalid-doc");
  });

  it("rejects a malformed request envelope", async () => {
    for (const body of [
      { command: { type: "add-category", title: "X" } },
      { expectedRevision: -1, command: { type: "add-category", title: "X" } },
      { expectedRevision: 1, command: "add-category" },
      { expectedRevision: 1, command: { type: "add-category", title: "X" }, extra: true },
    ]) {
      const response = await postJson("/api/projects/docs/outline/commands", body);
      expect(response.status).toBe(400);
    }
  });
});

describe("page routes", () => {
  beforeEach(seedProject);

  it("returns the stored page with its lint warnings", async () => {
    const response = await request("/api/projects/docs/pages/page-1");
    expect(response.status).toBe(200);

    const body = await json<{
      id: string;
      revision: number;
      frontmatter: { title: string };
      markdown: string;
      warnings: AuthoringWarning[];
    }>(response);

    expect(body).toMatchObject({ id: "page-1", revision: 1 });
    expect(body.frontmatter.title).toBe("Introduction");
    expect(body.warnings).toEqual([]);
  });

  it("400s a page id that could not be a filename", async () => {
    for (const pageId of ["has.dot", "with%2Fslash", "-leading"]) {
      const response = await request(`/api/projects/docs/pages/${pageId}`);
      expect(response.status).toBe(400);
      expect((await json<ErrorBody>(response)).error.code).toBe("invalid-request");
    }
  });

  it("writes a page and reports every authoring warning", async () => {
    const response = await putJson("/api/projects/docs/pages/page-1", {
      expectedRevision: 1,
      frontmatter: { title: "Installation", draft: true },
      markdown: '# Wrong level\n\n:::sidebar\nx\n:::\n\n:::note{title="Brace"}\ny\n:::\n',
    });

    expect(response.status).toBe(200);
    const body = await json<{
      revision: number;
      changed: boolean;
      warnings: AuthoringWarning[];
    }>(response);

    expect(body).toMatchObject({ revision: 2, changed: true });
    expect(body.warnings.map((warning) => warning.code)).toEqual([
      "h1-in-body",
      "unknown-directive",
      "brace-admonition-title",
    ]);
  });

  it("never blocks a write on a warning", async () => {
    await putJson("/api/projects/docs/pages/page-1", {
      expectedRevision: 1,
      markdown: "# Still saved\n",
    });

    const body = await json<{ markdown: string }>(
      await request("/api/projects/docs/pages/page-1"),
    );
    expect(body.markdown).toBe("# Still saved\n");
  });

  it("answers a stale page write with 409 and the snapshot", async () => {
    await putJson("/api/projects/docs/pages/page-1", {
      expectedRevision: 1,
      markdown: "first\n",
    });

    const response = await putJson("/api/projects/docs/pages/page-1", {
      expectedRevision: 1,
      markdown: "second\n",
    });

    expect(response.status).toBe(409);
    expect((await json<ErrorBody>(response)).snapshot?.revision).toBe(2);
  });

  it("rejects frontmatter fields outside the contract", async () => {
    const response = await putJson("/api/projects/docs/pages/page-1", {
      expectedRevision: 1,
      frontmatter: { title: "X", tags: ["a"] },
    });
    expect(response.status).toBe(400);
  });
});

describe("request guards", () => {
  beforeEach(seedProject);

  it("serves browser clients on a localhost origin", async () => {
    const response = await request("/api/projects", {
      headers: { Origin: "http://localhost:4323" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:4323",
    );
  });

  it("answers the preflight a cross-port browser client sends before a write", async () => {
    const response = await request("/api/projects/docs/pages/page-1", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:4323",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:4323",
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "Content-Type",
    );
  });

  it("answers the preflight a browser client sends before a delete", async () => {
    const response = await request("/api/projects/docs", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:4323",
        "Access-Control-Request-Method": "DELETE",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
  });

  it("refuses a preflight from a disallowed origin", async () => {
    const response = await request("/api/projects/docs/pages/page-1", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "PUT" },
    });
    expect(response.status).toBe(403);
  });

  it("refuses a request from any other origin", async () => {
    const response = await request("/api/projects", {
      headers: { Origin: "https://evil.example" },
    });
    expect(response.status).toBe(403);
    expect((await json<ErrorBody>(response)).error.code).toBe("forbidden-origin");
  });

  it("allows a request with no Origin at all, which is what agents send", async () => {
    expect((await request("/api/projects")).status).toBe(200);
  });

  it("refuses a body past the size limit", async () => {
    const response = await putJson("/api/projects/docs/pages/page-1", {
      expectedRevision: 1,
      markdown: "x".repeat(MAX_BODY_BYTES + 1),
    });
    expect(response.status).toBe(413);
    expect((await json<ErrorBody>(response)).error.code).toBe("payload-too-large");
  });
});
