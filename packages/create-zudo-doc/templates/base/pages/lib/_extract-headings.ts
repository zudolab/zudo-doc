// pages/lib/_extract-headings.ts — extract TOC headings from a raw MDX body.
//
// Shared helper called by all four catch-all `paths()` functions so each page
// passes real heading data to `DocLayoutWithDefaults` rather than an empty
// array. The result drops directly into the `headings` prop of `Toc` /
// `MobileToc` — the shape is byte-aligned with `HeadingItem` in
// `packages/zudo-doc/src/toc/types.ts`.
//
// Algorithm:
//   1. Walk the body line-by-line looking for ATX-style markdown headings
//      (`## Text`, `### Text`, `#### Text`).
//   2. Strip inline markdown markup (links, inline code, bold, italic) from the
//      heading text to get the plain visible text — matching what the renderer's
//      `extractText` HAST walker sees after MDX → HTML conversion.
//   3. Compute a GitHub-compatible slug using the same `GithubSlugger` that
//      the `rehype-heading-links` plugin uses at render time, so the TOC
//      anchor hrefs match the rendered heading IDs in the HTML.
//   4. Return only depth 2–4 headings — depth 1 is the page title (rendered
//      separately as an <h1>); depth 5–6 are too granular for the TOC.
//
// Caveats:
//   - This is a regex walk over raw text, not an AST parse. MDX JSX expressions
//     or code fences that contain `##` on their own line are matched. In
//     practice this is rare.
//   - Lines inside code fences (``` … ```) are skipped to avoid treating
//     literal `## code` examples as real headings. Fence detection uses
//     `line.trimStart()` to handle indented fences correctly.
//   - Reference-style links (`[text][id]`) and image links (`![alt](url)`)
//     are not stripped — uncommon in headings, treated as plain text.
//   - h5/h6 headings are slugged by `rehype-heading-links` but not extracted
//     here. If a doc has h5/h6 text that duplicates an h2–h4, the shared
//     GithubSlugger dedup counter diverges from the renderer's counter, so
//     slugs may mismatch for such pages.

import GithubSlugger from "github-slugger";

export interface HeadingItem {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

/**
 * Strip inline markdown markup from a heading line to obtain the plain visible
 * text that `rehype-heading-links` sees after MDX → HTML conversion.
 *
 * Strips (in order):
 *   - Inline links: `[text](url)` → `text`
 *   - Inline code spans: `` `code` `` → `code`
 *   - Bold: `**text**` or `__text__` → `text`
 *   - Italic: `*text*` or `_text_` → `text`
 */
function stripInlineMarkdown(raw: string): string {
  return (
    raw
      // Inline links [text](url) — replace with link text only.
      // Must run before bold/italic to avoid mismatching `*` inside URLs.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Inline code spans `code` — replace with code text.
      .replace(/`([^`]+)`/g, "$1")
      // Bold **text** or __text__
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      // Italic *text* or _text_ (single delimiter, not already consumed above)
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .trim()
  );
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
    // Use trimStart() so indented fences (e.g. inside lists) are also detected.
    const fenceMatch = /^(`{3,})/.exec(line.trimStart());
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
    // Strip inline markup to get the plain text the renderer sees, so the slug
    // matches the heading element's rendered id attribute.
    const text = stripInlineMarkdown(raw);

    headings.push({
      depth,
      slug: slugger.slug(text),
      text,
    });
  }

  return headings;
}
