/**
 * strip-toc-heading.mjs — strip TOC heading before signal extraction.
 *
 * Context (phase B-15-2, issue #917):
 *   zfb's DocLayout emits an in-content <h2>On this page</h2> (EN) /
 *   <h2>目次</h2> (JA) heading inside <main>, adjacent to the Toc /
 *   MobileToc islands. Astro's DocLayout renders the TOC heading outside
 *   <main>. This asymmetry causes ~5 routes to surface as solo content-loss
 *   and contributes to ~10 more routes alongside other causes.
 *
 *   Strategy: strip the matching h2 element from both A (Astro) and B (zfb)
 *   HTML before signal extraction. Stripping is symmetric so the heading
 *   falls out of the diff entirely — routes that were clean except for this
 *   heading are reclassified as identical.
 *
 *   Two placement variants are normalized (see hasTocHeading / stripTocHeading):
 *
 *   1. Inside <main> (B-15 pattern): the dominant case where zfb DocLayout
 *      emits the heading adjacent to the MobileToc island inside the main
 *      content area. h2s outside main and h2s with non-matching text are
 *      left intact. Text matching is exact after trimming and stripping inner
 *      tags — a <span> wrapper around the text content is handled transparently.
 *
 *   2. After </main> in the suffix (C-3 residual, phase C): zfb's desktop Toc
 *      island itself emits <h2>On this page</h2> / <h2>目次</h2> in the
 *      sidebar column outside <main>. Astro's Toc component does not emit
 *      this heading at all, so the diff is framework-asymmetric. 4 routes
 *      (/ja/docs/claude-skills, /ja/docs/components/mermaid-diagrams,
 *      /v/1.0/docs/getting-started/installation,
 *      /v/1.0/ja/docs/getting-started/installation) hit this pattern.
 *
 *   h2s before <main> (e.g. in the site header) are never stripped to avoid
 *   false positives.
 *
 *   The strip is gated by `enabled` in the run config so pages without a
 *   TOC heading pass through untouched.
 *
 *   Same pattern as strip-version-switcher.mjs — see that module for the
 *   general regex-based-HTML-walk rationale.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Exact text content strings that identify the in-content TOC heading.
 * EN: "On this page" / JA: "目次"
 */
const TOC_HEADING_TEXTS = ["On this page", "目次"];

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Strip all HTML tags from a fragment and trim surrounding whitespace.
 * Used to extract the visible text content of an h2 element for matching.
 *
 * @param {string} html  Inner HTML of an h2 element.
 * @returns {string}     Visible text, trimmed.
 */
function visibleText(html) {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * Find the inner bounds of the first <main> element in `html`.
 *
 * Returns the character positions of the content between the opening
 * `<main ...>` tag and its matching `</main>`, handling nested mains
 * via a depth counter. Returns null when no <main> is found or the
 * markup is unbalanced.
 *
 * @param {string} html
 * @returns {{ innerStart: number, innerEnd: number } | null}
 */
function findMainInnerBounds(html) {
  const mainOpenRe = /<main\b[^>]*>/i;
  const mainOpenMatch = mainOpenRe.exec(html);
  if (!mainOpenMatch) return null;

  const innerStart = mainOpenMatch.index + mainOpenMatch[0].length;

  let depth = 1;
  const scanRe = /<\/?main\b[^>]*>/gi;
  scanRe.lastIndex = innerStart;

  let closeMatch;
  while (depth > 0 && (closeMatch = scanRe.exec(html)) !== null) {
    if (closeMatch[0].startsWith("</")) {
      depth--;
    } else {
      depth++;
    }
  }

  if (depth !== 0) return null;
  return { innerStart, innerEnd: closeMatch.index };
}

/**
 * Scan `fragment` for h2 elements whose visible text matches one of the
 * TOC_HEADING_TEXTS entries and return true when at least one is found.
 *
 * Since h2 elements cannot nest other h2 elements in valid HTML, we use a
 * simple open/close pair search: for each `<h2 …>` opening tag, find the
 * first `</h2>` after it, extract the inner text, and test for exact match.
 *
 * @param {string} fragment  A substring of normalized HTML (main content only).
 * @returns {boolean}
 */
function fragmentHasTocH2(fragment) {
  let scanFrom = 0;

  while (true) {
    const h2OpenRe = /<h2\b[^>]*>/gi;
    h2OpenRe.lastIndex = scanFrom;
    const openMatch = h2OpenRe.exec(fragment);
    if (!openMatch) break;

    const openEnd = openMatch.index + openMatch[0].length;

    const closeRe = /<\/h2>/gi;
    closeRe.lastIndex = openEnd;
    const closeMatch = closeRe.exec(fragment);
    if (!closeMatch) break;

    const innerHtml = fragment.slice(openEnd, closeMatch.index);
    const text = visibleText(innerHtml);

    if (TOC_HEADING_TEXTS.includes(text)) return true;

    // Not a match — advance past the close tag and keep scanning.
    scanFrom = closeMatch.index + closeMatch[0].length;
  }

  return false;
}

/**
 * Remove all TOC h2 elements from `fragment`.
 *
 * Scans for `<h2 …>…</h2>` pairs whose visible text exactly matches one
 * of the TOC_HEADING_TEXTS entries and splices them out. Non-matching h2s
 * are left intact. Since h2 cannot nest h2, the first `</h2>` after each
 * opening tag is always its closing tag.
 *
 * @param {string} fragment  A substring of normalized HTML (main content only).
 * @returns {string}         Fragment with matching h2 elements removed.
 */
function stripTocH2sFrom(fragment) {
  let result = fragment;
  let scanFrom = 0;

  while (true) {
    const h2OpenRe = /<h2\b[^>]*>/gi;
    h2OpenRe.lastIndex = scanFrom;
    const openMatch = h2OpenRe.exec(result);
    if (!openMatch) break;

    const openStart = openMatch.index;
    const openEnd = openStart + openMatch[0].length;

    const closeRe = /<\/h2>/gi;
    closeRe.lastIndex = openEnd;
    const closeMatch = closeRe.exec(result);
    if (!closeMatch) break;

    const closeEnd = closeMatch.index + closeMatch[0].length;
    const innerHtml = result.slice(openEnd, closeMatch.index);
    const text = visibleText(innerHtml);

    if (TOC_HEADING_TEXTS.includes(text)) {
      // Match — splice out the entire h2 element.
      result = result.slice(0, openStart) + result.slice(closeEnd);
      // Continue scanning from the splice point.
      scanFrom = openStart;
    } else {
      // No match — skip past the close tag and keep scanning.
      scanFrom = closeEnd;
    }
  }

  return result;
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Return true when the HTML contains at least one TOC h2 heading — either
 * "On this page" (EN) or "目次" (JA) — in any of the stripped regions:
 *
 *   1. Inside <main>: the dominant B-15 pattern where zfb DocLayout emitted
 *      the heading adjacent to the MobileToc island inside the main content
 *      area.
 *   2. After </main> (suffix): the C-3 residual pattern where zfb's Toc island
 *      itself emits <h2>On this page</h2> / <h2>目次</h2> in the desktop
 *      sidebar column, which sits outside <main>. Astro's Toc component does
 *      not emit this heading at all, so the diff is framework-asymmetric.
 *
 * h2s before <main> (e.g. in the site header) are intentionally excluded to
 * avoid false positives.
 *
 * @param {string} html  Normalized HTML string.
 * @returns {boolean}
 */
export function hasTocHeading(html) {
  const bounds = findMainInnerBounds(html);
  if (!bounds) return false;
  // Check inside <main> (B-15 pattern).
  if (fragmentHasTocH2(html.slice(bounds.innerStart, bounds.innerEnd))) return true;
  // Also check the suffix after </main> (C-3 residual: Toc island outside main).
  return fragmentHasTocH2(html.slice(bounds.innerEnd));
}

// ── Stripping ─────────────────────────────────────────────────────────────────

/**
 * Remove TOC h2 headings from `html`, covering two distinct placement patterns:
 *
 *   1. Inside <main> (B-15 pattern) — zfb DocLayout emitted the heading
 *      adjacent to the MobileToc island inside the main content area.
 *   2. After </main> in the suffix (C-3 residual pattern) — zfb's desktop Toc
 *      island emits `<h2>On this page</h2>` / `<h2>目次</h2>` as a sidebar
 *      heading outside <main>. Astro's Toc component does not emit this
 *      heading at all (text matching falls outside the sidebar nav entirely),
 *      so the diff is framework-asymmetric and must be normalized.
 *
 * Text matching is exact after stripping inner tags and trimming — a <span>
 * or other inline wrapper around the text content is handled transparently.
 * h2 elements before <main> (site header area) are left intact to avoid
 * false positives.
 *
 * Uses the same regex-based parsing approach as the rest of the harness
 * (see strip-version-switcher.mjs for the general rationale). This is safe
 * for the controlled Astro/zfb HTML output that the harness processes.
 *
 * @param {string} html  HTML string (normalized or raw).
 * @returns {string}     HTML with TOC h2 elements removed from both regions.
 */
export function stripTocHeading(html) {
  const bounds = findMainInnerBounds(html);
  if (!bounds) return html;

  const { innerStart, innerEnd } = bounds;
  const prefix = html.slice(0, innerStart);
  const mainContent = html.slice(innerStart, innerEnd);
  // suffix starts from the </main> tag itself; strip covers the Toc island
  // sidebar that zfb renders immediately after </main>.
  const suffix = html.slice(innerEnd);

  return prefix + stripTocH2sFrom(mainContent) + stripTocH2sFrom(suffix);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Conditionally strip in-content TOC h2 headings from an HTML string.
 *
 * When `enabled` is false (or the page has no matching TOC heading inside
 * main), the input is returned unchanged. Safe to call unconditionally in
 * the pipeline — pages without a TOC heading pass through untouched.
 *
 * @param {string}  html     Normalized HTML.
 * @param {boolean} enabled  Master toggle (from config.stripTocHeadingDom).
 * @returns {string}         HTML with in-content TOC h2 elements removed (or unchanged).
 */
export function maybeStripTocHeading(html, enabled) {
  if (!enabled) return html;
  if (!hasTocHeading(html)) return html;
  return stripTocHeading(html);
}
