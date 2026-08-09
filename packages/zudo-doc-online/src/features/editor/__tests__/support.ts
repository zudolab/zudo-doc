/**
 * Fixtures for the editor-chrome suite.
 *
 * The sample "Aurora Docs" project is reused verbatim rather than a smaller
 * hand-rolled outline: it is what the API server seeds, it has three
 * categories, real descriptions and two `draft: true` pages, so the tree, the
 * draft badge and the Position field are all exercised against the same data
 * a developer sees in the browser.
 */

import {
  createMemoryProjectStore,
  type MemoryProjectStore,
  type PageFrontmatter,
  type ProjectSnapshot,
} from "../../../store/index";
import { auroraDocsOutline, auroraDocsPages } from "../../../sample/aurora-docs";
import type { KeyValueStorage } from "../persistence";

export function frontmatterOf(pageId: string): PageFrontmatter {
  const page = auroraDocsPages.find((entry) => entry.id === pageId);
  if (!page) throw new Error(`No sample page with id "${pageId}".`);
  return {
    title: page.meta.title,
    ...(page.meta.description === undefined ? {} : { description: page.meta.description }),
    ...(page.meta.draft === undefined ? {} : { draft: page.meta.draft }),
  };
}

export function createEditorTestStore(): MemoryProjectStore {
  return createMemoryProjectStore({
    slug: "aurora-docs",
    title: "Aurora Docs",
    outline: structuredClone(auroraDocsOutline),
    pages: Object.fromEntries(
      auroraDocsPages.map((page) => [
        page.id,
        { frontmatter: frontmatterOf(page.id), markdown: page.markdown },
      ]),
    ),
  });
}

export async function loadTestSnapshot(
  store: MemoryProjectStore,
): Promise<ProjectSnapshot> {
  return store.loadSnapshot();
}

export interface FakeStorage extends KeyValueStorage {
  entries: Map<string, string>;
}

export function createFakeStorage(seed: Record<string, string> = {}): FakeStorage {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

/** A storage whose reads throw, standing in for a disabled-storage browser. */
export function createHostileStorage(): KeyValueStorage {
  return {
    getItem() {
      throw new Error("storage disabled");
    },
    setItem() {
      /* writes are allowed to succeed; only reads are hostile here */
    },
  };
}

export const INSTALLATION_ID = "page-getting-started-installation";
export const INTRODUCTION_ID = "page-getting-started-introduction";
export const THEMING_ID = "page-guides-theming";
