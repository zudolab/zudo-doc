/**
 * The MCP tool surface, driven against the in-process API app — no ports, no
 * `dev:server` process (see `support.ts`).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthoringWarning, CreatedPageMeta, ProjectSnapshot } from "../client";
import { renderOutlineOverview } from "../tools";
import { createMcpHarness, jsonOf, textOf, toolHandler, type McpTestHarness } from "./support";

let harness: McpTestHarness;

beforeEach(async () => {
  harness = await createMcpHarness();
});

afterEach(async () => {
  await harness.cleanup();
});

function call(name: string, args: Record<string, unknown> = {}) {
  return toolHandler(harness, name)(args);
}

describe("list_projects", () => {
  it("starts empty and lists what create_project made", async () => {
    expect(jsonOf(await call("list_projects"))).toEqual([]);

    await call("create_project", { title: "Aurora Docs" });
    const listed = jsonOf<Array<{ slug: string; title: string; revision: number }>>(
      await call("list_projects"),
    );
    expect(listed).toEqual([{ slug: "aurora-docs", title: "Aurora Docs", revision: 1 }]);
  });
});

describe("full agent flow", () => {
  it("orient → restructure → write → re-read, with monotonic revisions", async () => {
    // 1. create_project — revision 1, one seeded category and page.
    const created = jsonOf<ProjectSnapshot>(await call("create_project", { title: "Docs" }));
    expect(created).toMatchObject({ slug: "docs", revision: 1 });
    expect(created.outline.categories).toHaveLength(1);
    const seededCategoryId = created.outline.categories[0]?.id;
    expect(seededCategoryId).toBeTruthy();

    // 2. apply_outline_command: add-category.
    const addCategory = jsonOf<{ revision: number; changed: boolean; selectedId: string }>(
      await call("apply_outline_command", {
        project: "docs",
        expectedRevision: 1,
        command: { type: "add-category", title: "Guides" },
      }),
    );
    expect(addCategory).toMatchObject({ revision: 2, changed: true });
    const guidesCategoryId = addCategory.selectedId;

    // 3. apply_outline_command: add-page under the new category.
    const addPage = jsonOf<{
      revision: number;
      changed: boolean;
      createdPage: CreatedPageMeta;
    }>(
      await call("apply_outline_command", {
        project: "docs",
        expectedRevision: 2,
        command: { type: "add-page", categoryId: guidesCategoryId, title: "Deploying" },
      }),
    );
    expect(addPage).toMatchObject({ revision: 3, changed: true });
    expect(addPage.createdPage).toMatchObject({ slug: "deploying", title: "Deploying" });
    const newPageId = addPage.createdPage.id;

    // 4. outline_overview — compact tree text, not JSON.
    const overview = textOf(await call("outline_overview", { project: "docs" }));
    expect(overview).toContain("Docs (revision 3)");
    expect(overview).toContain("Guides");
    expect(overview).toContain("Deploying");
    expect(overview).not.toContain("(draft)");

    // 5. write_page — one write that trips every authoring-lint warning, and
    // marks the page a draft.
    const written = jsonOf<{
      id: string;
      slug: string;
      revision: number;
      changed: boolean;
      warnings: AuthoringWarning[];
    }>(
      await call("write_page", {
        project: "docs",
        pageId: newPageId,
        expectedRevision: 3,
        frontmatter: { title: "Deploying", draft: true },
        markdown: '# Wrong level\n\n:::sidebar\nx\n:::\n\n:::note{title="Brace"}\ny\n:::\n',
      }),
    );
    expect(written).toMatchObject({ id: newPageId, slug: "deploying", revision: 4, changed: true });
    expect(written.warnings.map((warning) => warning.code)).toEqual([
      "h1-in-body",
      "unknown-directive",
      "brace-admonition-title",
    ]);

    // 6. get_page reflects the write, including the same warnings.
    const page = jsonOf<{ frontmatter: { draft?: boolean }; warnings: AuthoringWarning[] }>(
      await call("get_page", { project: "docs", pageId: newPageId }),
    );
    expect(page.frontmatter.draft).toBe(true);
    expect(page.warnings).toHaveLength(3);

    // 7. get_project reflects everything: structure, titles, draft flag, revision.
    const snapshot = jsonOf<ProjectSnapshot>(await call("get_project", { project: "docs" }));
    expect(snapshot.revision).toBe(4);
    expect(snapshot.outline.categories.map((category) => category.title)).toEqual([
      "Getting started",
      "Guides",
    ]);
    expect(snapshot.pages).toContainEqual(
      expect.objectContaining({ id: newPageId, title: "Deploying", draft: true }),
    );

    // 8. outline_overview now shows the draft marker.
    const overviewAfter = textOf(await call("outline_overview", { project: "docs" }));
    expect(overviewAfter).toContain("Deploying [page:");
    expect(overviewAfter).toContain("(draft)");

    // Revisions moved forward one step at a time: 1 → 2 → 3 → 4.
    expect([created.revision, addCategory.revision, addPage.revision, written.revision]).toEqual([
      1, 2, 3, 4,
    ]);
  });
});

describe("apply_outline_command: a no-op does not move the revision", () => {
  it("reports changed: false and the same revision", async () => {
    await call("create_project", { title: "Docs" });
    const categoryId = (
      jsonOf<ProjectSnapshot>(await call("get_project", { project: "docs" }))
    ).outline.categories[0]?.id as string;

    const result = jsonOf<{ changed: boolean; revision: number }>(
      await call("apply_outline_command", {
        project: "docs",
        expectedRevision: 1,
        command: { type: "rename-category", categoryId, title: "Getting started" },
      }),
    );
    expect(result).toEqual({ changed: false, revision: 1, selectedId: null });
  });
});

describe("stale-revision mapping", () => {
  it("apply_outline_command surfaces the structured error with latestRevision", async () => {
    await call("create_project", { title: "Docs" });
    // Bump the project to revision 2 out from under the caller.
    await call("apply_outline_command", {
      project: "docs",
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
    });

    const stale = await call("apply_outline_command", {
      project: "docs",
      expectedRevision: 1,
      command: { type: "add-category", title: "Reference" },
    });

    expect(stale.isError).toBe(true);
    expect(jsonOf(stale)).toEqual({
      code: "stale-revision",
      message: expect.stringContaining("re-read"),
      latestRevision: 2,
    });
  });

  it("write_page surfaces the same structured error", async () => {
    await call("create_project", { title: "Docs" });
    const snapshot = jsonOf<ProjectSnapshot>(await call("get_project", { project: "docs" }));
    const pageId = snapshot.pages[0]?.id as string;

    await call("write_page", {
      project: "docs",
      pageId,
      expectedRevision: 1,
      markdown: "first\n",
    });

    const stale = await call("write_page", {
      project: "docs",
      pageId,
      expectedRevision: 1,
      markdown: "second\n",
    });

    expect(stale.isError).toBe(true);
    expect(jsonOf(stale)).toMatchObject({ code: "stale-revision", latestRevision: 2 });
  });
});

describe("other server errors are surfaced verbatim", () => {
  it("get_project 404s an unknown project as project-not-found", async () => {
    const result = await call("get_project", { project: "missing" });
    expect(result.isError).toBe(true);
    expect(jsonOf(result)).toMatchObject({ code: "project-not-found" });
  });

  it("apply_outline_command surfaces a command failure's own code", async () => {
    await call("create_project", { title: "Docs" });
    const result = await call("apply_outline_command", {
      project: "docs",
      expectedRevision: 1,
      command: { type: "add-page", categoryId: "ghost", title: "X" },
    });
    expect(result.isError).toBe(true);
    expect(jsonOf(result)).toMatchObject({ code: "category-not-found" });
  });
});

describe("authoring_guide", () => {
  it("returns markdown teaching the content conventions, not JSON", async () => {
    const text = textOf(await call("authoring_guide"));
    expect(text).toContain("## Frontmatter contract");
    expect(text).toContain(":::note[");
    expect(text).not.toMatch(/^\s*[{[]/);
  });
});

describe("outline command input schema", () => {
  it("accepts one example of every command shape and rejects an unknown type", () => {
    const tool = harness.tools.get("apply_outline_command");
    const commandSchema = tool?.inputSchema["command"];
    expect(commandSchema).toBeDefined();

    const examples: unknown[] = [
      { type: "add-category", title: "Guides" },
      { type: "rename-category", categoryId: "category-1", title: "Guides" },
      { type: "remove-category", categoryId: "category-1" },
      { type: "move-category", categoryId: "category-1", toIndex: 0 },
      { type: "add-page", categoryId: "category-1", title: "Deploying" },
      { type: "set-page-slug", pageId: "page-1", slug: "installing" },
      { type: "remove-page", pageId: "page-1" },
      { type: "move-page", pageId: "page-1", toCategoryId: "category-2", toIndex: 0 },
      { type: "reorder-pages", categoryId: "category-1", orderedPageIds: ["page-1"] },
      {
        type: "replace-doc",
        doc: { schemaVersion: 1, projectTitle: "Docs", categories: [] },
      },
    ];
    for (const example of examples) {
      expect(commandSchema?.safeParse(example).success).toBe(true);
    }

    expect(commandSchema?.safeParse({ type: "rename-page", pageId: "page-1", title: "X" }).success).toBe(
      false,
    );
  });
});

describe("renderOutlineOverview", () => {
  it("reports an empty project without a category loop", () => {
    const snapshot: ProjectSnapshot = {
      slug: "empty",
      title: "Empty",
      revision: 1,
      outline: { schemaVersion: 1, projectTitle: "Empty", categories: [] },
      pages: [],
    };
    expect(renderOutlineOverview(snapshot)).toBe(
      "Empty (revision 1) [project: empty]\n\n(no categories yet)",
    );
  });

  it("marks a category with no pages, and a page's draft flag", () => {
    const snapshot: ProjectSnapshot = {
      slug: "docs",
      title: "Docs",
      revision: 5,
      outline: {
        schemaVersion: 1,
        projectTitle: "Docs",
        categories: [
          { id: "category-1", slug: "guides", title: "Guides", pages: [] },
          {
            id: "category-2",
            slug: "reference",
            title: "Reference",
            pages: [{ id: "page-1", slug: "api" }],
          },
        ],
      },
      pages: [
        { id: "page-1", slug: "api", categoryId: "category-2", title: "API", draft: true },
      ],
    };

    const text = renderOutlineOverview(snapshot);
    expect(text).toContain("Guides [category: category-1 / guides]\n  (no pages)");
    expect(text).toContain("- API [page: page-1 / api] (draft)");
  });
});
