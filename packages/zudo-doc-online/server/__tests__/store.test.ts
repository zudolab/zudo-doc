/**
 * Store contract: what ends up on disk, and what the composed snapshot says
 * about it. These tests read the real files rather than trusting the return
 * values, because the point of the transaction layer is that the two agree.
 */

import { mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
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

async function readProjectFile(slug: string): Promise<{ revision: number; title: string }> {
  return JSON.parse(await readFile(projectPath(slug, PROJECT_FILE), "utf8")) as {
    revision: number;
    title: string;
  };
}

async function pageFileNames(slug: string): Promise<string[]> {
  return (await readdir(projectPath(slug, "pages"))).sort();
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
    });
    expect(await pageFileNames("aurora-docs")).toEqual(["page-1.md"]);
  });

  it("derives a fresh slug rather than colliding with an existing project", async () => {
    await store.createProject("Docs");
    const second = await store.createProject("Docs");
    expect(second.slug).toBe("docs-2");
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
