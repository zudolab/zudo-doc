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
//      (`## Text` through `###### Text`, h2–h6).
//   2. Strip inline markdown markup (links, inline code, bold, italic) from the
//      heading text to get the plain visible text — matching what the renderer's
//      `extractText` HAST walker sees after MDX → HTML conversion.
//   3. Compute a GitHub-compatible slug using the same `GithubSlugger` that
//      the `rehype-heading-links` plugin uses at render time, advancing the
//      shared counter for ALL h2–h6 (even those not emitted into the TOC)
//      so TOC anchor hrefs match the rendered heading IDs in the HTML. h1 is
//      NOT slugged — the renderer never assigns an id to h1 (it's the title).
//   4. Return only depth 2–4 headings by default (h1 is the page title; h5–h6
//      are too granular). The window is configurable via `tocMinDepth` /
//      `tocMaxDepth` in settings (restriction-only: min 2, max 4).
//
// Caveats:
//   - This is a regex walk over raw text, not an AST parse. MDX JSX expressions
//     that contain `##` on their own line may be matched. In practice this is
//     rare.
//   - Lines inside code fences (``` … ``` or ~~~ … ~~~) are skipped to avoid
//     treating literal `## code` examples as real headings. Fence detection
//     uses `line.trimStart()` to handle indented fences correctly.
//   - Reference-style links (`[text][id]`) and image links (`![alt](url)`)
//     are not stripped — uncommon in headings, treated as plain text.
//   - Slugger parity is counter-level (npm `github-slugger` vs zfb Rust) — the
//     renderer slugs all h2–h6 regardless of `tocMinDepth`/`tocMaxDepth`, so
//     this extractor must also slug all matched headings (including those outside
//     the emit window) to keep the shared dedup counter in sync.
//   - Residual risks: slugger-parity (npm `github-slugger` vs zfb Rust — an
//     external-binary contract) and text-extraction parity (inline JSX / reference
//     links not fully stripped).

import GithubSlugger from "github-slugger";
import { settings } from "../../src/config/settings";

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
 * Resolve and clamp the depth window from raw (possibly invalid) inputs.
 *
 * Enforces `2 <= min <= max <= 4`. If either value is NaN or the chain breaks,
 * falls back to the full default window [2, 4].
 */
function resolveDepthWindow(
  rawMin: unknown,
  rawMax: unknown,
): { lo: number; hi: number } {
  const min = Math.trunc(Number(rawMin));
  const max = Math.trunc(Number(rawMax));
  if (
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min >= 2 &&
    min <= max &&
    max <= 4
  ) {
    return { lo: min, hi: max };
  }
  return { lo: 2, hi: 4 };
}

/**
 * Extract TOC headings from a raw MDX/markdown body.
 *
 * Uses the same slugging algorithm as `rehype-heading-links` so the
 * `href="#slug"` values in the TOC match the rendered heading element IDs.
 * Slugs ALL matched h2–h6 (advancing the shared dedup counter) but only
 * pushes depth 2–4 items into the result (configurable via settings). h1 is
 * not matched — the renderer does not assign ids to h1.
 *
 * @param body - Raw markdown body string (frontmatter already stripped).
 * @param opts - Optional override for the depth window (used by tests only;
 *   production call sites pass no arguments and read from settings).
 * @returns Array of `{ depth, slug, text }` items in document order.
 */
export function extractHeadings(
  body: string,
  opts?: { tocMinDepth?: number; tocMaxDepth?: number },
): HeadingItem[] {
  const { lo, hi } = resolveDepthWindow(
    opts?.tocMinDepth ?? settings.tocMinDepth,
    opts?.tocMaxDepth ?? settings.tocMaxDepth,
  );

  const slugger = new GithubSlugger();
  const headings: HeadingItem[] = [];

  // Track the opening fence character and length so we correctly match the
  // closing fence. Markdown allows backtick and tilde fences (``` or ~~~),
  // and longer fences to nest shorter same-character ones.
  let codeFenceOpener: string | null = null;
  for (const line of body.split("\n")) {
    // Detect code fence open/close. A fence is 3+ backticks OR 3+ tildes,
    // optionally followed by a language specifier. The closing fence must use
    // the same character and match or exceed the opener's length.
    // Use trimStart() so indented fences (e.g. inside lists) are also detected.
    const trimmed = line.trimStart();
    const fenceMatch = /^([`~]{3,})/.exec(trimmed);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      if (fence === undefined) continue;
      if (codeFenceOpener === null) {
        // Opening fence: record character + length.
        codeFenceOpener = fence;
      } else if (
        fence[0] === codeFenceOpener[0] &&
        fence.length >= codeFenceOpener.length
      ) {
        // Closing fence: must match opener's character and be at least as long.
        codeFenceOpener = null;
      }
      // Whether opening, closing, or a mismatched-character line (content inside
      // a fence), always skip — do not try to parse as a heading.
      continue;
    }
    if (codeFenceOpener !== null) continue;

    // Match ATX headings at depth h2–h6. The renderer's heading-links plugin
    // slugs h2–h6 only (h1 is never assigned an id — the frontmatter title is
    // the page's h1), so matching h1 here would advance the shared dedup counter
    // out of step with the renderer and break the TOC anchor for a same-text h2.
    // Allow one or more spaces/tabs after the hashes (both valid per CommonMark).
    const match = /^(#{2,6})[ \t]+(.+)$/.exec(line.trim());
    if (!match) continue;

    const hashes = match[1];
    const rawText = match[2];
    if (hashes === undefined || rawText === undefined) continue;

    const depth = hashes.length;
    // Strip inline markup to get the plain text the renderer sees, so the slug
    // matches the heading element's rendered id attribute.
    const text = stripInlineMarkdown(rawText.trim());

    // Always advance the slugger counter (maintaining parity with the renderer's
    // shared dedup counter across all h1–h6), but only push within the configured
    // depth window.
    const slug = slugger.slug(text);
    if (depth >= lo && depth <= hi) {
      headings.push({ depth, slug, text });
    }
  }

  return headings;
}
