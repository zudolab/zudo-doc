import { describe, expect, it } from "vitest";

import { RevisionConflictError, StoreRequestError } from "../contract";
import { createTestStore } from "./support";

describe("MemoryProjectStore", () => {
  it("loads a composed snapshot", async () => {
    const store = createTestStore();
    const snapshot = await store.loadSnapshot();

    expect(snapshot.slug).toBe("docs");
    expect(snapshot.revision).toBe(1);
    expect(snapshot.pages).toEqual([
      { id: "page-1", slug: "intro", categoryId: "cat-1", title: "Intro" },
      { id: "page-2", slug: "advanced", categoryId: "cat-1", title: "Advanced" },
    ]);
  });

  it("applies an outline command, bumps the revision, and returns the new snapshot", async () => {
    const store = createTestStore();
    const outcome = await store.applyOutlineCommand(1, {
      type: "add-category",
      title: "New Section",
    });

    expect(outcome.changed).toBe(true);
    expect(outcome.revision).toBe(2);
    expect(outcome.snapshot.outline.categories.map((category) => category.title)).toEqual([
      "Guides",
      "New Section",
    ]);
  });

  it("does not bump the revision for a no-op command", async () => {
    const store = createTestStore();
    const outcome = await store.applyOutlineCommand(1, {
      type: "rename-category",
      categoryId: "cat-1",
      title: "Guides",
    });

    expect(outcome.changed).toBe(false);
    expect(outcome.revision).toBe(1);
  });

  it("throws a RevisionConflictError carrying the current snapshot on a stale expectedRevision", async () => {
    const store = createTestStore();
    await store.applyOutlineCommand(1, { type: "add-category", title: "New Section" });

    const attempt = store.applyOutlineCommand(1, { type: "add-category", title: "Another" });
    await expect(attempt).rejects.toBeInstanceOf(RevisionConflictError);

    try {
      await store.applyOutlineCommand(1, { type: "add-category", title: "Another" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RevisionConflictError);
      const conflict = error as RevisionConflictError;
      expect(conflict.snapshot.revision).toBe(2);
    }
  });

  it("maps a rejected-but-current outline command to a non-409 status", async () => {
    const store = createTestStore();
    const attempt = store.applyOutlineCommand(1, {
      type: "set-page-slug",
      pageId: "page-1",
      slug: "advanced",
    });

    await expect(attempt).rejects.toMatchObject({ code: "slug-conflict", status: 422 });
  });

  it("saves a page, bumping the revision", async () => {
    const store = createTestStore();
    const result = await store.savePage("page-1", 1, { markdown: "Updated\n" });

    expect(result.changed).toBe(true);
    expect(result.revision).toBe(2);
    expect(result.markdown).toBe("Updated\n");
  });

  it("does not bump the revision when the write reproduces stored content", async () => {
    const store = createTestStore();
    const result = await store.savePage("page-1", 1, {
      frontmatter: { title: "Intro" },
      markdown: "Hello\n",
    });

    expect(result.changed).toBe(false);
    expect(result.revision).toBe(1);
  });

  it("404s a page save for an unknown id", async () => {
    const store = createTestStore();
    await expect(store.savePage("ghost", 1, { markdown: "x" })).rejects.toMatchObject({
      code: "page-not-found",
      status: 404,
    });
    await expect(store.savePage("ghost", 1, { markdown: "x" })).rejects.toBeInstanceOf(
      StoreRequestError,
    );
  });

  it("applyExternalPageWrite simulates another client's already-committed save", async () => {
    const store = createTestStore();
    store.applyExternalPageWrite("page-2", { markdown: "Changed elsewhere\n" });

    expect(store.getRevision()).toBe(2);
    const attempt = store.savePage("page-1", 1, { markdown: "Mine\n" });
    await expect(attempt).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it("applyExternalOutlineCommand simulates another client's structural change", async () => {
    const store = createTestStore();
    store.applyExternalOutlineCommand({ type: "add-category", title: "External" });

    const snapshot = await store.loadSnapshot();
    expect(snapshot.revision).toBe(2);
    expect(snapshot.outline.categories.map((category) => category.title)).toContain("External");
  });

  it("seeds a newly created page's file lifecycle on add-page", async () => {
    const store = createTestStore();
    const outcome = await store.applyOutlineCommand(1, {
      type: "add-page",
      categoryId: "cat-1",
      title: "Fresh Page",
    });

    expect(outcome.createdPage).toBeDefined();
    const created = outcome.createdPage;
    if (!created) throw new Error("expected createdPage");
    const page = await store.loadPage(created.id);
    expect(page.frontmatter.title).toBe("Fresh Page");
    expect(page.markdown).toBe("");
  });
});
