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
//   3. Compute a heading ID that matches what zfb's Rust `HeadingLinks` plugin
//      emits at render time, using the strategy in `settings.headingIdStrategy`
//      (single source of truth, also read by `zfb.config.ts`):
//        - `"flat"`: github-slugger slugs with one dedup counter shared across
//          ALL h2–h6 (even those not emitted into the TOC), so TOC anchor hrefs
//          match the rendered IDs.
//        - `"hierarchical"`: ancestor-prefixed IDs (`## Foo` / `### Moo` /
//          `#### Mew` → `foo`, `foo-moo`, `foo-moo-mew`), deduped on the full
//          path — see `SlugAllocator` below, a faithful mirror of zfb's Rust
//          allocator (upstream zfb#871).
//      Either way the allocator runs over ALL matched h2–h6 so its per-document
//      state (dedup counter + ancestor stack) stays in lockstep with the
//      renderer. h1 is NOT slugged — the renderer never assigns an id to h1.
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
//     the emit window) to keep the shared dedup counter / ancestor stack in sync.
//   - Residual risks: slugger-parity (npm `github-slugger` vs zfb Rust — an
//     external-binary contract) and text-extraction parity (inline JSX / reference
//     links not fully stripped).

// Default export = the stateful, dedup-tracking slugger (flat strategy).
// Named `slug` = the stateless one-shot slugifier with NO dedup — used to
// compute the per-heading base slug in the hierarchical strategy before the
// ancestor prefix + full-path dedup are applied.
import GithubSlugger, { slug as slugifyBase } from "github-slugger";
import { settings } from "../../src/config/settings";

/** Heading-ID (anchor) strategy. Mirrors `settings.headingIdStrategy`. */
export type HeadingIdStrategy = "flat" | "hierarchical";

export interface HeadingItem {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

/**
 * Per-document heading-ID allocator — a faithful TS mirror of zfb's Rust
 * `SlugAllocator` (`crates/zfb-content/src/plugins/heading_links.rs`). Construct
 * one per document; call `allocate(depth, text)` for every matched h2–h6 in
 * document order (the result is the rendered heading `id`).
 *
 * - `"flat"`: delegates to a `GithubSlugger` instance — byte-identical to the
 *   pre-zfb#871 scheme (one dedup counter shared across all levels).
 * - `"hierarchical"`: `base = slug(text)` (no dedup); pop the ancestor stack
 *   while its top is at or deeper than `depth`; `candidate = {parent.id}-{base}`
 *   (just `base` at the top of the outline); dedup the *full candidate* through
 *   a per-document counter; push `(depth, finalId)`. A deduped parent therefore
 *   contributes its FINAL id to children. Empty-text headings get the empty
 *   string and touch no state (the renderer skips them entirely).
 */
class SlugAllocator {
  private readonly strategy: HeadingIdStrategy;
  private readonly flatSlugger = new GithubSlugger();
  /** Hierarchical dedup counter, keyed by full candidate path. */
  private readonly seen = new Map<string, number>();
  /** Hierarchical ancestor stack of `{ depth, final id }`. */
  private readonly stack: { depth: number; id: string }[] = [];

  constructor(strategy: HeadingIdStrategy) {
    this.strategy = strategy;
  }

  allocate(depth: number, text: string): string {
    if (this.strategy === "flat") {
      return this.flatSlugger.slug(text);
    }
    const base = slugifyBase(text);
    if (base === "") return "";
    // Pop ancestors at or below this depth so a sibling/shallower heading
    // re-roots the chain (h2 → h4 jumps nest under the nearest real ancestor).
    for (let top = this.stack.at(-1); top !== undefined && top.depth >= depth; top = this.stack.at(-1)) {
      this.stack.pop();
    }
    const parent = this.stack.at(-1);
    const candidate = parent !== undefined ? `${parent.id}-${base}` : base;
    const id = this.nextSlug(candidate);
    this.stack.push({ depth, id });
    return id;
  }

  /**
   * github-slugger repeat-numbering on an already-slugified candidate: first
   * occurrence returns `candidate`, later ones `candidate-1`, `candidate-2`, …
   * Mirrors zfb's `next_slug` (does NOT re-slugify — the candidate is already
   * a valid slug path).
   */
  private nextSlug(candidate: string): string {
    const count = this.seen.get(candidate) ?? 0;
    this.seen.set(candidate, count + 1);
    return count === 0 ? candidate : `${candidate}-${count}`;
  }
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
 * Uses the same slugging algorithm as zfb's `HeadingLinks` plugin (selected by
 * `settings.headingIdStrategy`, or the `opts.strategy` override) so the
 * `href="#slug"` values in the TOC match the rendered heading element IDs.
 * Allocates over ALL matched h2–h6 (keeping the dedup counter and hierarchical
 * ancestor stack in sync with the renderer) but only pushes depth 2–4 items
 * into the result (configurable via settings). h1 is not matched — the renderer
 * does not assign ids to h1.
 *
 * @param body - Raw markdown body string (frontmatter already stripped).
 * @param opts - Optional overrides for the depth window and heading-ID
 *   strategy (used by tests only; production call sites pass no arguments and
 *   read from settings).
 * @returns Array of `{ depth, slug, text }` items in document order.
 */
export function extractHeadings(
  body: string,
  opts?: {
    tocMinDepth?: number;
    tocMaxDepth?: number;
    strategy?: HeadingIdStrategy;
  },
): HeadingItem[] {
  const { lo, hi } = resolveDepthWindow(
    opts?.tocMinDepth ?? settings.tocMinDepth,
    opts?.tocMaxDepth ?? settings.tocMaxDepth,
  );

  const allocator = new SlugAllocator(opts?.strategy ?? settings.headingIdStrategy);
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

    // Always allocate (advancing the dedup counter and, in hierarchical mode,
    // the ancestor stack — maintaining parity with the renderer across all
    // h2–h6), but only push within the configured depth window.
    const slug = allocator.allocate(depth, text);
    if (depth >= lo && depth <= hi) {
      headings.push({ depth, slug, text });
    }
  }

  return headings;
}
