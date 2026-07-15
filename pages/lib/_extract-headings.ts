// Thin showcase wrapper around @takazudo/zudo-doc/extract-headings.
// The package-side extractHeadings takes settings as explicit params (no
// project singleton import). This wrapper re-reads the project settings and
// passes them through so call sites in _doc-route-entries.ts continue to
// call extractHeadings(body) without change.
//
// Moved to the package as part of the package-first migration (#2321, S4 #2327).

import { settings } from "../../src/config/settings";
export type { HeadingItem } from "@takazudo/zudo-doc/extract-headings";
export { slugify } from "@takazudo/zudo-doc/extract-headings";
import { extractHeadings as _extractHeadings } from "@takazudo/zudo-doc/extract-headings";
import type { HeadingItem } from "@takazudo/zudo-doc/extract-headings";

/**
 * Extract TOC headings from a raw MDX/markdown body, using the project's
 * configured `tocMinDepth` and `tocMaxDepth` from `src/config/settings`.
 *
 * Accepts the same optional `opts` overrides as the underlying package
 * function (for tests that want to override the depth window without touching
 * the global settings).
 */
export function extractHeadings(
  body: string,
  opts?: {
    tocMinDepth?: number;
    tocMaxDepth?: number;
  },
): HeadingItem[] {
  return _extractHeadings(body, {
    tocMinDepth: opts?.tocMinDepth ?? settings.tocMinDepth,
    tocMaxDepth: opts?.tocMaxDepth ?? settings.tocMaxDepth,
  });
}
