/**
 * strip-toc-heading.mjs — strip in-content TOC heading before signal extraction.
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
 *   Only h2 elements inside <main> are stripped. h2s outside main, h2s with
 *   different text (including partial matches like "On this page only"), and
 *   h3s with the same text are left untouched. Text matching is exact after
 *   trimming and stripping inner tags — a <span> or similar wrapper around
 *   the text content is handled transparently.
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
 * Return true when the HTML contains at least one in-content TOC h2 heading
 * inside <main> — either "On this page" (EN) or "目次" (JA).
 *
 * Only h2 elements inside the first <main> element are checked. h2s outside
 * main are ignored. Text matching is exact after stripping inner tags and
 * trimming — a <span> wrapper around the text does not prevent detection.
 *
 * @param {string} html  Normalized HTML string.
 * @returns {boolean}
 */
export function hasTocHeading(html) {
  const bounds = findMainInnerBounds(html);
  if (!bounds) return false;
  return fragmentHasTocH2(html.slice(bounds.innerStart, bounds.innerEnd));
}

// ── Stripping ─────────────────────────────────────────────────────────────────

/**
 * Remove in-content TOC h2 headings from the <main> element of `html`.
 *
 * Strips every `<h2>On this page</h2>` (EN) and `<h2>目次</h2>` (JA)
 * element found inside <main>. Text matching is exact after stripping inner
 * tags and trimming — a <span> or other inline wrapper around the text
 * content is handled transparently. h2 elements outside <main> and h2s with
 * non-matching text are left intact.
 *
 * Uses the same regex-based parsing approach as the rest of the harness
 * (see strip-version-switcher.mjs for the general rationale). This is safe
 * for the controlled Astro/zfb HTML output that the harness processes.
 *
 * @param {string} html  HTML string (normalized or raw).
 * @returns {string}     HTML with in-content TOC h2 elements removed.
 */
export function stripTocHeading(html) {
  const bounds = findMainInnerBounds(html);
  if (!bounds) return html;

  const { innerStart, innerEnd } = bounds;
  const prefix = html.slice(0, innerStart);
  const mainContent = html.slice(innerStart, innerEnd);
  const suffix = html.slice(innerEnd);

  return prefix + stripTocH2sFrom(mainContent) + suffix;
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
