import { describe, expect, it } from "vitest";

import { StoreRequestError } from "../contract";
import {
  createMemoryProjectsDirectoryStore,
  type MemoryDirectoryProjectSeed,
} from "../projects-memory-provider";

function seed(overrides: Partial<MemoryDirectoryProjectSeed> = {}): MemoryDirectoryProjectSeed {
  return { title: "Aurora Docs", ...overrides };
}

describe("MemoryProjectsDirectoryStore — listProjects", () => {
  it("returns the plain shape without summary fields by default", async () => {
    const store = createMemoryProjectsDirectoryStore({ projects: [seed()] });

    const list = await store.listProjects();

    expect(list).toEqual([{ slug: "aurora-docs", title: "Aurora Docs", revision: 1 }]);
  });

  it("adds summary fields when asked", async () => {
    const store = createMemoryProjectsDirectoryStore({
      now: () => "2026-01-01T00:00:00.000Z",
      projects: [
        seed({
          pages: [
            { id: "p1", slug: "intro", categoryId: "c1", title: "Intro" },
            { id: "p2", slug: "draft-page", categoryId: "c1", title: "Draft", draft: true },
          ],
          outline: {
            schemaVersion: 1,
            projectTitle: "Aurora Docs",
            categories: [{ id: "c1", slug: "guides", title: "Guides", pages: [] }],
          },
          preset: { schemaVersion: 1, themePack: "aurora" },
        }),
      ],
    });

    const [entry] = await store.listProjects({ summary: true });

    expect(entry).toEqual({
      slug: "aurora-docs",
      title: "Aurora Docs",
      revision: 1,
      pageCount: 2,
      draftCount: 1,
      categoryCount: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      preset: { schemaVersion: 1, themePack: "aurora" },
    });
  });

  it("derives and dedupes seed slugs from titles", async () => {
    const store = createMemoryProjectsDirectoryStore({
      projects: [seed({ title: "Docs" }), seed({ title: "Docs" })],
    });

    expect(store.listSlugs()).toEqual(["docs", "docs-2"]);
  });
});

describe("MemoryProjectsDirectoryStore — getProject", () => {
  it("returns the full snapshot for an existing project", async () => {
    const store = createMemoryProjectsDirectoryStore({ projects: [seed()] });

    const snapshot = await store.getProject("aurora-docs");

    expect(snapshot.slug).toBe("aurora-docs");
    expect(snapshot.title).toBe("Aurora Docs");
    expect(snapshot.outline.categories).toEqual([]);
    expect(snapshot.pages).toEqual([]);
  });

  it("throws project-not-found (404) for a missing slug", async () => {
    const store = createMemoryProjectsDirectoryStore();

    await expect(store.getProject("nope")).rejects.toMatchObject({
      code: "project-not-found",
      status: 404,
    });
    await expect(store.getProject("nope")).rejects.toBeInstanceOf(StoreRequestError);
  });
});

describe("MemoryProjectsDirectoryStore — createProject", () => {
  it("creates a project at revision 1 with an empty outline", async () => {
    const store = createMemoryProjectsDirectoryStore();

    const snapshot = await store.createProject("New Project");

    expect(snapshot.slug).toBe("new-project");
    expect(snapshot.revision).toBe(1);
    expect(snapshot.outline).toEqual({
      schemaVersion: 1,
      projectTitle: "New Project",
      categories: [],
    });
    expect(snapshot.pages).toEqual([]);
  });

  it("round-trips the preset verbatim", async () => {
    const store = createMemoryProjectsDirectoryStore();

    const snapshot = await store.createProject("New Project", {
      schemaVersion: 1,
      themePack: "aurora",
      defaultMode: "dark",
    });

    expect(snapshot.preset).toEqual({ schemaVersion: 1, themePack: "aurora", defaultMode: "dark" });
  });

  it("derives a unique slug against existing projects", async () => {
    const store = createMemoryProjectsDirectoryStore({ projects: [seed({ title: "Docs" })] });

    const snapshot = await store.createProject("Docs");

    expect(snapshot.slug).toBe("docs-2");
  });

  it("rejects an empty title", async () => {
    const store = createMemoryProjectsDirectoryStore();

    await expect(store.createProject("   ")).rejects.toMatchObject({
      code: "invalid-title",
      status: 400,
    });
  });
});

describe("MemoryProjectsDirectoryStore — deleteProject", () => {
  it("removes the project from the listing", async () => {
    const store = createMemoryProjectsDirectoryStore({ projects: [seed()] });

    const result = await store.deleteProject("aurora-docs");

    expect(result).toEqual({ slug: "aurora-docs", deleted: true });
    expect(await store.listProjects()).toEqual([]);
  });

  it("throws project-not-found for a missing slug", async () => {
    const store = createMemoryProjectsDirectoryStore();

    await expect(store.deleteProject("nope")).rejects.toMatchObject({
      code: "project-not-found",
      status: 404,
    });
  });
});

describe("MemoryProjectsDirectoryStore — duplicateProject", () => {
  it("rewrites the title to '<Title> copy' and derives a fresh unique slug", async () => {
    const store = createMemoryProjectsDirectoryStore({ projects: [seed()] });

    const duplicate = await store.duplicateProject("aurora-docs");

    expect(duplicate.title).toBe("Aurora Docs copy");
    expect(duplicate.slug).toBe("aurora-docs-copy");
    expect(duplicate.revision).toBe(1);
    expect(duplicate.outline.projectTitle).toBe("Aurora Docs copy");
  });

  it("allows duplicate titles — no duplicate-title error path", async () => {
    const store = createMemoryProjectsDirectoryStore({ projects: [seed()] });

    await store.duplicateProject("aurora-docs");
    const second = await store.duplicateProject("aurora-docs");

    expect(second.title).toBe("Aurora Docs copy");
    expect(second.slug).toBe("aurora-docs-copy-2");
  });

  it("carries the source project's pages, outline and preset", async () => {
    const store = createMemoryProjectsDirectoryStore({
      projects: [
        seed({
          outline: {
            schemaVersion: 1,
            projectTitle: "Aurora Docs",
            categories: [{ id: "c1", slug: "guides", title: "Guides", pages: [{ id: "p1", slug: "intro" }] }],
          },
          pages: [{ id: "p1", slug: "intro", categoryId: "c1", title: "Intro" }],
          preset: { schemaVersion: 1, themePack: "aurora" },
        }),
      ],
    });

    const duplicate = await store.duplicateProject("aurora-docs");

    expect(duplicate.outline.categories).toHaveLength(1);
    expect(duplicate.pages).toEqual([{ id: "p1", slug: "intro", categoryId: "c1", title: "Intro" }]);
    expect(duplicate.preset).toEqual({ schemaVersion: 1, themePack: "aurora" });
  });

  it("throws project-not-found for a missing source slug", async () => {
    const store = createMemoryProjectsDirectoryStore();

    await expect(store.duplicateProject("nope")).rejects.toMatchObject({
      code: "project-not-found",
      status: 404,
    });
  });
});
