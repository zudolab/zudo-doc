/**
 * Store contract: what ends up on disk, and what the composed snapshot says
 * about it. These tests read the real files rather than trusting the return
 * values, because the point of the transaction layer is that the two agree.
 */

import { access, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { auroraDocsOutline } from "../../src/sample/aurora-docs";
import {
  PROJECT_SCHEMA_VERSION,
  StoreError,
  type FileProjectStore,
  type ProjectSnapshot,
} from "../store/file-store";
import { PROJECT_FILE, STAGING_DIR } from "../store/tx";
import { createHarness, fixedClock, type TestHarness } from "./support";

let harness: TestHarness;
let store: FileProjectStore;

beforeEach(async () => {
  harness = await createHarness({ now: fixedClock() });
  store = harness.store;
});

afterEach(async () => {
  await harness.cleanup();
});

function projectPath(slug: string, ...rest: string[]): string {
  return path.join(harness.dataDir, slug, ...rest);
}

async function readProjectFile(slug: string): Promise<{
  revision: number;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  preset?: unknown;
}> {
  return JSON.parse(await readFile(projectPath(slug, PROJECT_FILE), "utf8")) as {
    revision: number;
    title: string;
    createdAt?: string;
    updatedAt?: string;
    preset?: unknown;
  };
}

async function pageFileNames(slug: string): Promise<string[]> {
  return (await readdir(projectPath(slug, "pages"))).sort();
}

async function pathExists(target: string): Promise<boolean> {
  return access(target).then(
    () => true,
    () => false,
  );
}

async function expectStoreError(
  promise: Promise<unknown>,
  code: string,
): Promise<StoreError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(StoreError);
  expect((error as StoreError).code).toBe(code);
  return error as StoreError;
}

describe("createProject", () => {
  it("scaffolds a project at revision 1 with one category and one page file", async () => {
    const snapshot = await store.createProject("Aurora Docs");

    expect(snapshot.slug).toBe("aurora-docs");
    expect(snapshot.revision).toBe(1);
    expect(snapshot.outline.categories).toHaveLength(1);
    expect(snapshot.pages).toEqual([
      {
        id: "page-1",
        slug: "index",
        categoryId: "category-1",
        title: "Introduction",
      },
    ]);

    expect(await readProjectFile("aurora-docs")).toEqual({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      title: "Aurora Docs",
      revision: 1,
      createdAt: "2026-01-02T03:04:05.678Z",
      updatedAt: "2026-01-02T03:04:05.678Z",
    });
    expect(await pageFileNames("aurora-docs")).toEqual(["page-1.md"]);
  });

  it("derives a fresh slug rather than colliding with an existing project", async () => {
    await store.createProject("Docs");
    const second = await store.createProject("Docs");
    expect(second.slug).toBe("docs-2");
  });

  it("gives two concurrent same-title creations distinct slugs", async () => {
    // Slug allocation and the commit that claims it are one step; otherwise
    // both requests derive "docs" and the second overwrites the first.
    const created = await Promise.all([
      store.createProject("Docs"),
      store.createProject("Docs"),
    ]);

    expect(new Set(created.map((project) => project.slug)).size).toBe(2);
    expect((await store.listProjects()).map((project) => project.slug)).toEqual([
      "docs",
      "docs-2",
    ]);
  });

  it("rejects a blank title", async () => {
    await expectStoreError(store.createProject("   "), "invalid-request");
  });

  it("lists projects by slug", async () => {
    await store.createProject("Zeta");
    await store.createProject("Alpha");
    expect((await store.listProjects()).map((project) => project.slug)).toEqual([
      "alpha",
      "zeta",
    ]);
  });

  it("stores an optional preset and round-trips it through the snapshot", async () => {
    const preset = { schemaVersion: 1 as const, themePack: "aurora", defaultMode: "dark" as const };
    const snapshot = await store.createProject("Docs", preset);

    expect(snapshot.preset).toEqual(preset);
    expect((await readProjectFile("docs")).preset).toEqual(preset);

    const reread = await store.readSnapshot("docs");
    expect(reread.preset).toEqual(preset);
  });

  it("preserves unknown preset keys across a commit it never validated them for", async () => {
    const preset = {
      schemaVersion: 1 as const,
      themePack: "aurora",
      // Not in the current inner schema — must survive anyway.
      futureField: "from-a-newer-client",
    };
    await store.createProject("Docs", preset as never);

    const afterCommand = await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
    });
    expect(afterCommand.snapshot.preset).toEqual(preset);

    const afterPageWrite = await store.writePage("docs", "page-1", {
      expectedRevision: 2,
      markdown: "changed\n",
    });
    expect(afterPageWrite.changed).toBe(true);
    const finalSnapshot = await store.readSnapshot("docs");
    expect(finalSnapshot.preset).toEqual(preset);
  });
});

describe("deleteProject", () => {
  it("renames the project directory into the top-level trash", async () => {
    await store.createProject("Docs");
    expect(await pathExists(projectPath("docs"))).toBe(true);

    const outcome = await store.deleteProject("docs");
    expect(outcome).toEqual({ slug: "docs" });

    expect(await pathExists(projectPath("docs"))).toBe(false);
    const trashed = await readdir(path.join(harness.dataDir, ".trash"));
    expect(trashed).toHaveLength(1);
    expect(trashed[0]).toMatch(/^docs-/);
  });

  it("stops listing a deleted project and lets its slug be re-created immediately", async () => {
    await store.createProject("Docs");
    await store.deleteProject("docs");

    expect(await store.listProjects()).toEqual([]);

    const recreated = await store.createProject("Docs");
    expect(recreated.slug).toBe("docs");
    expect(recreated.revision).toBe(1);
  });

  it("404s deleting an unknown slug", async () => {
    await expectStoreError(store.deleteProject("ghost"), "project-not-found");
  });

  it("uniquifies the trash destination on a same-clock-tick double delete", async () => {
    await store.createProject("Docs");
    await store.createProject("Docs2");

    // Two projects deleted under the same fixed clock land in the same
    // second — the second rename must not collide with the first.
    await store.deleteProject("docs");
    // Re-create the same slug and delete it again, still under the same
    // fixed timestamp, to force a genuine trash-name collision.
    await store.createProject("Docs");
    await store.deleteProject("docs");

    const trashed = await readdir(path.join(harness.dataDir, ".trash"));
    expect(trashed).toHaveLength(2);
    expect(new Set(trashed).size).toBe(2);
  });
});

describe("duplicateProject", () => {
  it("copies pages byte-identical and rewrites both title halves", async () => {
    await store.createProject("Docs");
    await store.writePage("docs", "page-1", {
      expectedRevision: 1,
      markdown: "original body\n",
    });
    const sourceFile = await readFile(projectPath("docs", "pages/page-1.md"), "utf8");

    const copy = await store.duplicateProject("docs");

    expect(copy.slug).toBe("docs-copy");
    expect(copy.title).toBe("Docs copy");
    expect(copy.outline.projectTitle).toBe("Docs copy");
    expect(copy.revision).toBe(1);
    expect(copy.createdAt).toBe("2026-01-02T03:04:05.678Z");
    expect(copy.updatedAt).toBe("2026-01-02T03:04:05.678Z");

    const copiedFile = await readFile(projectPath("docs-copy", "pages/page-1.md"), "utf8");
    expect(copiedFile).toBe(sourceFile);
    // The source project is untouched.
    expect((await store.readSnapshot("docs")).title).toBe("Docs");
  });

  it("copies the preset along with the project", async () => {
    const preset = { schemaVersion: 1 as const, themePack: "aurora" };
    await store.createProject("Docs", preset);

    const copy = await store.duplicateProject("docs");
    expect(copy.preset).toEqual(preset);
  });

  it("derives a unique slug from the copy title", async () => {
    await store.createProject("Docs");
    await store.duplicateProject("docs");
    const second = await store.duplicateProject("docs");
    expect(second.slug).toBe("docs-copy-2");
  });

  it("404s duplicating an unknown slug", async () => {
    await expectStoreError(store.duplicateProject("ghost"), "project-not-found");
  });
});

describe("listProjects summary", () => {
  it("adds counts and metadata only when requested, leaving the plain list unchanged", async () => {
    await store.createProject("Docs", { schemaVersion: 1, themePack: "aurora" });
    await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "add-page", categoryId: "category-1", title: "Deploying" },
    });
    await store.writePage("docs", "page-2", {
      expectedRevision: 2,
      frontmatter: { title: "Deploying", draft: true },
    });

    const plain = await store.listProjects();
    expect(plain).toEqual([{ slug: "docs", title: "Docs", revision: 3 }]);

    const withSummary = await store.listProjects({ summary: true });
    expect(withSummary).toEqual([
      {
        slug: "docs",
        title: "Docs",
        revision: 3,
        pageCount: 2,
        draftCount: 1,
        categoryCount: 1,
        createdAt: "2026-01-02T03:04:05.678Z",
        updatedAt: "2026-01-02T03:04:05.678Z",
        preset: { schemaVersion: 1, themePack: "aurora" },
      },
    ]);
  });
});

describe("seedIfEmpty", () => {
  it("writes the Aurora Docs sample, frontmatter and all", async () => {
    expect(await store.seedIfEmpty()).toBe("aurora-docs");

    const snapshot = await store.readSnapshot("aurora-docs");
    expect(snapshot.outline).toEqual(auroraDocsOutline);
    expect(snapshot.pages).toHaveLength(14);

    const installation = snapshot.pages.find(
      (page) => page.id === "page-getting-started-installation",
    );
    expect(installation).toMatchObject({
      title: "Installation",
      description: "Prerequisites, install commands, and the first run.",
      draft: true,
    });
  });

  it("does nothing when a project already exists", async () => {
    await store.createProject("Mine");
    expect(await store.seedIfEmpty()).toBeNull();
    expect(await store.listProjects()).toHaveLength(1);
  });

  it("still seeds when the only directory is a rolled-back creation", async () => {
    // What `recover()` leaves behind when a create is undone: a slug-shaped
    // directory with no project.json. `listProjects()` already ignores it, so
    // counting raw directories was the one place it passed as a whole project
    // — and the SPA then 404'd on the sample base it opens by default.
    await mkdir(projectPath("half-created", "pages"), { recursive: true });

    expect(await store.seedIfEmpty()).toBe("aurora-docs");
    expect(await store.listProjects()).toEqual([
      { slug: "aurora-docs", title: "Aurora Docs", revision: 1 },
    ]);
  });

  it("leaves a corrupt project alone instead of quarantining it at boot", async () => {
    // The emptiness check must not go through the parsing read: that one moves
    // a malformed project.json aside before throwing, which would destroy the
    // only project's metadata and then seed the sample project over the top.
    await mkdir(projectPath("broken", "pages"), { recursive: true });
    await writeFile(projectPath("broken", PROJECT_FILE), "{ not json", "utf8");

    expect(await store.seedIfEmpty()).toBeNull();
    expect(await readFile(projectPath("broken", PROJECT_FILE), "utf8")).toBe(
      "{ not json",
    );
    expect(
      (await readdir(projectPath("broken"))).some((entry) =>
        entry.includes(".corrupt-"),
      ),
    ).toBe(false);
  });
});

describe("outline commands and the page-file lifecycle", () => {
  let snapshot: ProjectSnapshot;

  beforeEach(async () => {
    snapshot = await store.createProject("Docs");
  });

  it("creates the page file from the command's own createdPage meta", async () => {
    const outcome = await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "add-page", categoryId: "category-1", title: "Deploying" },
    });

    expect(outcome.changed).toBe(true);
    expect(outcome.createdPage).toEqual({
      id: "page-2",
      slug: "deploying",
      title: "Deploying",
    });
    expect(outcome.snapshot.revision).toBe(2);

    const file = await readFile(projectPath("docs", "pages/page-2.md"), "utf8");
    expect(file).toContain('title: "Deploying"');
    // The title reaches the snapshot through the file, not the command.
    expect(outcome.snapshot.pages.at(-1)).toMatchObject({ id: "page-2", title: "Deploying" });
  });

  it("moves a removed page's file to trash instead of deleting it", async () => {
    await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "remove-page", pageId: "page-1" },
    });

    expect(await pageFileNames("docs")).toEqual([]);
    const trashed = await readdir(projectPath("docs", "trash"));
    expect(trashed).toHaveLength(1);
    expect(await readdir(projectPath("docs", "trash", trashed[0] ?? ""))).toEqual([
      "page-1.md",
    ]);
  });

  it("trashes every page file of a removed category", async () => {
    await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "add-page", categoryId: "category-1", title: "Second" },
    });
    await store.applyOutlineCommand("docs", {
      expectedRevision: 2,
      command: { type: "remove-category", categoryId: "category-1" },
    });

    expect(await pageFileNames("docs")).toEqual([]);
    const trashDir = (await readdir(projectPath("docs", "trash")))[0] ?? "";
    expect((await readdir(projectPath("docs", "trash", trashDir))).sort()).toEqual([
      "page-1.md",
      "page-2.md",
    ]);
  });

  it("reconciles replace-doc in both directions", async () => {
    const outcome = await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: {
        type: "replace-doc",
        doc: {
          schemaVersion: 1,
          projectTitle: "Docs",
          categories: [
            {
              id: "category-9",
              slug: "guides",
              title: "Guides",
              pages: [{ id: "page-9", slug: "imported" }],
            },
          ],
        },
      },
    });

    // The imported page had no file; the replaced page's file is not deleted.
    expect(await pageFileNames("docs")).toEqual(["page-9.md"]);
    const trashDir = (await readdir(projectPath("docs", "trash")))[0] ?? "";
    expect(await readdir(projectPath("docs", "trash", trashDir))).toEqual(["page-1.md"]);

    // A stub has no frontmatter to inherit, so its slug becomes its title.
    expect(outcome.snapshot.pages).toEqual([
      { id: "page-9", slug: "imported", categoryId: "category-9", title: "imported" },
    ]);
  });

  it("keeps an existing file when a command adopts its page id", async () => {
    await writeFile(
      projectPath("docs", "pages/page-adopted.md"),
      '---\ntitle: "Written earlier"\n---\n\nkeep me\n',
      "utf8",
    );

    await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: {
        type: "add-page",
        categoryId: "category-1",
        title: "Ignored",
        pageId: "page-adopted",
      },
    });

    const page = await store.readPage("docs", "page-adopted");
    expect(page.frontmatter.title).toBe("Written earlier");
    expect(page.markdown).toBe("keep me\n");
  });

  it("does not bump the revision or write anything for a no-op command", async () => {
    const outcome = await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "rename-category", categoryId: "category-1", title: "Getting started" },
    });

    expect(outcome.changed).toBe(false);
    expect(outcome.snapshot.revision).toBe(1);
    expect((await readProjectFile("docs")).revision).toBe(1);
  });

  it("maps command failures to their own status, never a 500", async () => {
    const notFound = await expectStoreError(
      store.applyOutlineCommand("docs", {
        expectedRevision: 1,
        command: { type: "add-page", categoryId: "nope", title: "X" },
      }),
      "category-not-found",
    );
    expect(notFound.status).toBe(404);

    const conflict = await expectStoreError(
      store.applyOutlineCommand("docs", {
        expectedRevision: 1,
        command: { type: "add-page", categoryId: "category-1", title: "X", slug: "index" },
      }),
      "slug-conflict",
    );
    // 409 is reserved for a stale revision, so a slug clash is 422.
    expect(conflict.status).toBe(422);
  });

  it("refuses a page id that could not be a filename", async () => {
    const error = await expectStoreError(
      store.applyOutlineCommand("docs", {
        expectedRevision: 1,
        command: {
          type: "add-page",
          categoryId: "category-1",
          title: "X",
          pageId: "../escape",
        },
      }),
      "invalid-request",
    );
    expect(error.status).toBe(400);
    expect(snapshot.revision).toBe(1);
  });
});

describe("revision conflicts", () => {
  beforeEach(async () => {
    await store.createProject("Docs");
  });

  it("rejects a stale revision with the current snapshot attached", async () => {
    await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
    });

    const error = await expectStoreError(
      store.applyOutlineCommand("docs", {
        expectedRevision: 1,
        command: { type: "add-category", title: "Reference" },
      }),
      "revision-mismatch",
    );

    expect(error.status).toBe(409);
    expect(error.snapshot?.revision).toBe(2);
    expect(error.snapshot?.outline.categories.map((category) => category.title)).toEqual([
      "Getting started",
      "Guides",
    ]);
  });

  it("lets exactly one of two racing mutations win", async () => {
    const results = await Promise.allSettled([
      store.applyOutlineCommand("docs", {
        expectedRevision: 1,
        command: { type: "add-category", title: "First" },
      }),
      store.applyOutlineCommand("docs", {
        expectedRevision: 1,
        command: { type: "add-category", title: "Second" },
      }),
    ]);

    const won = results.filter((result) => result.status === "fulfilled");
    const lost = results.filter((result) => result.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(StoreError);
    expect(((lost[0] as PromiseRejectedResult).reason as StoreError).code).toBe(
      "revision-mismatch",
    );

    // One commit, so exactly one new category and exactly one revision step.
    const after = await store.readSnapshot("docs");
    expect(after.revision).toBe(2);
    expect(after.outline.categories).toHaveLength(2);
  });
});

describe("page reads and writes", () => {
  beforeEach(async () => {
    await store.createProject("Docs");
  });

  it("writes frontmatter and body together and bumps the revision once", async () => {
    const outcome = await store.writePage("docs", "page-1", {
      expectedRevision: 1,
      frontmatter: { title: "Renamed", description: "New", draft: true },
      markdown: "## Body\n",
    });

    expect(outcome.changed).toBe(true);
    expect(outcome.page.revision).toBe(2);

    const snapshot = await store.readSnapshot("docs");
    expect(snapshot.pages[0]).toEqual({
      id: "page-1",
      slug: "index",
      categoryId: "category-1",
      title: "Renamed",
      description: "New",
      draft: true,
    });
  });

  it("keeps the untouched half when only one field is supplied", async () => {
    await store.writePage("docs", "page-1", {
      expectedRevision: 1,
      markdown: "## Only the body changed\n",
    });
    const page = await store.readPage("docs", "page-1");

    expect(page.frontmatter.title).toBe("Introduction");
    expect(page.markdown).toBe("## Only the body changed\n");
  });

  it("leaves a hand-formatted file untouched when a write supplies neither field", async () => {
    // Unquoted YAML the serializer would canonicalize: a write that asked for
    // nothing must not rewrite it, nor spend a revision doing so.
    const handWritten = "---\ntitle: Plain scalar\n---\n\nbody\n";
    await writeFile(projectPath("docs", "pages/page-1.md"), handWritten, "utf8");

    const outcome = await store.writePage("docs", "page-1", { expectedRevision: 1 });

    expect(outcome.changed).toBe(false);
    expect(outcome.page.revision).toBe(1);
    expect(outcome.page.frontmatter.title).toBe("Plain scalar");
    expect(await readFile(projectPath("docs", "pages/page-1.md"), "utf8")).toBe(handWritten);
  });

  it("treats a byte-identical write as no change at all", async () => {
    const first = await store.readPage("docs", "page-1");
    const outcome = await store.writePage("docs", "page-1", {
      expectedRevision: first.revision,
      frontmatter: first.frontmatter,
      markdown: first.markdown,
    });

    expect(outcome.changed).toBe(false);
    expect(outcome.page.revision).toBe(first.revision);
  });

  it("404s for a page the outline does not know", async () => {
    await expectStoreError(store.readPage("docs", "page-404"), "page-not-found");
  });

  it("404s for an unknown project", async () => {
    await expectStoreError(store.readSnapshot("nothing-here"), "project-not-found");
  });
});

describe("corrupt files", () => {
  beforeEach(async () => {
    await store.createProject("Docs");
  });

  it("quarantines a malformed page file and fails the request", async () => {
    await writeFile(projectPath("docs", "pages/page-1.md"), "no frontmatter here", "utf8");

    const error = await expectStoreError(store.readSnapshot("docs"), "corrupt-file");
    expect(error.status).toBe(500);
    expect(error.message).toContain("corrupt-");

    const quarantined = (await pageFileNames("docs")).filter((name) =>
      name.includes(".corrupt-"),
    );
    expect(quarantined).toHaveLength(1);
    // The author's bytes are moved aside, never overwritten.
    expect(
      await readFile(projectPath("docs", "pages", quarantined[0] ?? ""), "utf8"),
    ).toBe("no frontmatter here");

    // With the bad file gone the project opens again, falling back to the slug.
    const snapshot = await store.readSnapshot("docs");
    expect(snapshot.pages[0]?.title).toBe("index");
  });

  it("quarantines a malformed project.json", async () => {
    await writeFile(projectPath("docs", PROJECT_FILE), "{ not json", "utf8");
    await expectStoreError(store.readSnapshot("docs"), "corrupt-file");

    const remaining = await readdir(projectPath("docs"));
    expect(remaining.some((name) => name.startsWith(`${PROJECT_FILE}.corrupt-`))).toBe(true);
  });

  it("still parses a project.json written before createdAt/updatedAt/preset existed", async () => {
    await writeFile(
      projectPath("docs", PROJECT_FILE),
      `${JSON.stringify({ schemaVersion: PROJECT_SCHEMA_VERSION, title: "Docs", revision: 1 })}\n`,
      "utf8",
    );

    const snapshot = await store.readSnapshot("docs");
    expect(snapshot.createdAt).toBeUndefined();
    expect(snapshot.updatedAt).toBeUndefined();
    expect(snapshot.preset).toBeUndefined();

    // The first edit after the old file backfills createdAt/updatedAt going
    // forward, without quarantining the old file as malformed.
    const outcome = await store.applyOutlineCommand("docs", {
      expectedRevision: 1,
      command: { type: "add-category", title: "Guides" },
    });
    expect(outcome.snapshot.createdAt).toBe("2026-01-02T03:04:05.678Z");
    expect(outcome.snapshot.updatedAt).toBe("2026-01-02T03:04:05.678Z");
  });

  it("refuses to read a page file that is a symbolic link", async () => {
    const secret = path.join(harness.dataDir, "outside.md");
    await writeFile(secret, '---\ntitle: "Leaked"\n---\n', "utf8");
    await rm(projectPath("docs", "pages/page-1.md"));
    await symlink(secret, projectPath("docs", "pages/page-1.md"));

    await expectStoreError(store.readSnapshot("docs"), "unsafe-path");
  });
});

describe("recovery on open", () => {
  it("restores the pre-commit state before serving a project with leftover staging", async () => {
    await store.createProject("Docs");
    const before = await readFile(projectPath("docs", "outline.json"), "utf8");

    // The shape a crash between the outline rename and the project.json rename
    // leaves behind: outline.json already replaced, revision still the old one.
    const staging = projectPath("docs", STAGING_DIR);
    await mkdir(path.join(staging, "prev"), { recursive: true });
    await mkdir(path.join(staging, "next"), { recursive: true });
    await writeFile(path.join(staging, "prev/outline.json"), before, "utf8");
    await writeFile(
      path.join(staging, "commit.json"),
      JSON.stringify({ baseRevision: 1, nextRevision: 2, paths: ["outline.json"] }),
      "utf8",
    );
    await writeFile(
      projectPath("docs", "outline.json"),
      JSON.stringify({ schemaVersion: 1, projectTitle: "Half committed", categories: [] }),
      "utf8",
    );

    const snapshot = await store.readSnapshot("docs");

    expect(snapshot.revision).toBe(1);
    expect(snapshot.outline.projectTitle).toBe("Docs");
    expect(snapshot.outline.categories).toHaveLength(1);
    await expect(
      readFile(path.join(staging, "commit.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("reports what it healed at boot", async () => {
    await store.createProject("Docs");
    await mkdir(projectPath("docs", STAGING_DIR, "next"), { recursive: true });

    expect(await store.recover()).toEqual(new Map([["docs", "discarded"]]));
    expect(await store.recover()).toEqual(new Map());
  });
});
