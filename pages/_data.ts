// Current zfb collection helpers used by host page/data modules.

import { getCollection, type CollectionEntry } from "@takazudo/zfb/content";
import type { DocsData } from "@takazudo/zudo-doc/docs-schema";

export type ZfbDocsData = DocsData;
export type ZfbDocsEntry = CollectionEntry<ZfbDocsData>;

/** Load one docs collection from zfb's synchronous content snapshot. */
export function getDocs(collectionName: string): ZfbDocsEntry[] {
  return getCollection<ZfbDocsData>(collectionName);
}

/** Alias retained for callers that describe the operation as a load. */
export function loadDocs(collectionName: string): ZfbDocsEntry[] {
  return getDocs(collectionName);
}

/** Drafts are never included in statically generated routes. */
export function filterDrafts(entries: ZfbDocsEntry[]): ZfbDocsEntry[] {
  return entries.filter((entry) => !entry.data.draft);
}
