// pages/lib/_extract-headings.ts — extract TOC headings from a raw MDX body.
//
// Shared helper called by all four catch-all `paths()` functions so each page
// passes real heading data to `DocLayoutWithDefaults` rather than an empty
// array. The result drops directly into the `headings` prop of `Toc` /
// `MobileToc` — the shape is byte-aligned with `HeadingItem` in
// `packages/zudo-doc-v2/src/toc/types.ts`.
//
// Algorithm:
//   1. Walk the body line-by-line looking for ATX-style markdown headings
//      (`## Text`, `### Text`, `#### Text`).
//   2. Compute a GitHub-compatible slug using the same `GithubSlugger` that
//      the `rehype-heading-links` plugin uses at render time, so the TOC
//      anchor hrefs match the rendered heading IDs in the HTML.
//   3. Return only depth 2–4 headings — depth 1 is the page title (rendered
//      separately as an <h1>); depth 5–6 are too granular for the TOC.
//
// Caveats:
//   - This is a regex walk over raw text, not an AST parse. MDX JSX expressions
//     or code fences that contain `##` on their own line are matched. In
//     practice this is rare; Astro's `entry.render()` returned the same shape
//     and relied on the same assumption (headings extracted pre-render).
//   - Lines inside code fences (``` … ```) are skipped to avoid treating
//     literal `## code` examples as real headings.

import GithubSlugger from "github-slugger";

export interface HeadingItem {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

/**
 * Extract depth-2/3/4 headings from a raw MDX/markdown body.
 *
 * Uses the same slugging algorithm as `rehype-heading-links` so the
 * `href="#slug"` values in the TOC match the rendered heading element IDs.
 *
 * @param body - Raw markdown body string (frontmatter already stripped).
 * @returns Array of `{ depth, slug, text }` items in document order.
 */
export function extractHeadings(body: string): HeadingItem[] {
  const slugger = new GithubSlugger();
  const headings: HeadingItem[] = [];

  // Track the opening fence string (`` ``` `` or ```` ```` ````) so we match the
  // correct closing fence — Markdown allows longer fences to nest shorter ones.
  let codeFenceOpener: string | null = null;
  for (const line of body.split("\n")) {
    // Detect code fence open/close. A fence is 3+ backticks optionally followed
    // by a language specifier. The closing fence must match the opener's length.
    const fenceMatch = /^(`{3,})/.exec(line);
    if (fenceMatch) {
      const fence = fenceMatch[1] as string;
      if (codeFenceOpener === null) {
        codeFenceOpener = fence;
      } else if (fence.length >= codeFenceOpener.length) {
        codeFenceOpener = null;
      }
      continue;
    }
    if (codeFenceOpener !== null) continue;

    // Match ATX headings at depth 2, 3, or 4. Allow one or more spaces/tabs
    // after the hash characters (both are valid per the CommonMark spec).
    const match = /^(#{2,4})[ \t]+(.+)$/.exec(line.trim());
    if (!match) continue;

    const depth = (match[1] as string).length;
    const raw = (match[2] as string).trim();

    headings.push({
      depth,
      slug: slugger.slug(raw),
      text: raw,
    });
  }

  return headings;
}
