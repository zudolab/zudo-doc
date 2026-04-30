/**
 * strip-hidden-sidebar.mjs — strip hidden-sidebar DOM before signal extraction.
 *
 * Context (phase B-12, issue #907, option (b)):
 *   Tag-listing routes (/docs/tags/<tag> and JA mirrors) set hideSidebar=true
 *   in their layout. The old Astro layout (site A) rendered the full sidebar
 *   nav tree in the DOM and hid it via CSS — contributing navigation link text
 *   to visibleText. The zfb DocLayout (site B) intentionally omits that tree
 *   when hideSidebar=true, emitting only an empty sr-only <aside> marker.
 *
 *   This DOM reduction is not a regression — it is a deliberate improvement:
 *   less DOM noise on pages where the sidebar is never shown. The harness must
 *   not count the hidden sidebar HTML against site B in the content-loss check.
 *
 *   Strategy: strip the <aside id="desktop-sidebar"> element from both A and B
 *   HTML before signal extraction. When both sides are stripped symmetrically
 *   the sidebar content falls out of the diff entirely, so the route is
 *   classified by its actual visible content rather than by DOM that was always
 *   hidden from the user.
 *
 *   The strip is ONLY applied when the route has a hidden sidebar — detected by
 *   the presence of <aside ... class="sr-only"> on the rendered page, which is
 *   the exact marker the DocLayout emits when hideSidebar=true. On regular doc
 *   pages the aside has a visible CSS class, so stripping is skipped.
 */

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Return true when the HTML contains a hidden-sidebar marker.
 *
 * Two conditions are checked (either is sufficient):
 *   1. The aside has class="sr-only" — this is what zfb DocLayout emits for
 *      hideSidebar=true (site B). It's also what site A emits for the mobile
 *      sidebar-toggle aside when the sidebar is hidden.
 *   2. The aside has a class that starts with "sr-only" — covers the case
 *      where Tailwind produces "sr-only ..." with trailing classes.
 *
 * @param {string} html  Normalized HTML string.
 * @returns {boolean}
 */
export function hasHiddenSidebar(html) {
  // Match <aside id="desktop-sidebar" ...> with sr-only in the class value.
  // The aside may have other attributes (aria-label, style, etc.) in any order.
  // We check for "sr-only" anywhere in the class attribute of the aside.
  return /<aside\b[^>]*\bid="desktop-sidebar"[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>/i.test(html)
    || /<aside\b[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*\bid="desktop-sidebar"[^>]*>/i.test(html);
}

// ── Stripping ─────────────────────────────────────────────────────────────────

/**
 * Remove the <aside id="desktop-sidebar">…</aside> element from HTML.
 *
 * Uses a balanced-depth tracker rather than a simple regex so that nested
 * aside elements (if any) are handled correctly. This is regex-based parsing
 * of controlled Astro/zfb output — the sidebar aside has no nested asides in
 * practice, but being defensive here avoids silent data corruption.
 *
 * The function does NOT use a full DOM parser — the existing harness pipeline
 * is regex-based (see normalize-html.mjs, extract-signals.mjs) and we follow
 * that convention.
 *
 * @param {string} html  HTML string (normalized or raw).
 * @returns {string}     HTML with the desktop-sidebar aside removed.
 */
export function stripDesktopSidebarAside(html) {
  // Find the opening <aside id="desktop-sidebar" ...> tag.
  // The aside may have attributes in any order.
  const openTagRe = /<aside\b(?=[^>]*\bid="desktop-sidebar")[^>]*>/gi;

  let result = html;
  let match;

  while ((match = openTagRe.exec(result)) !== null) {
    const startIdx = match.index;
    const afterOpen = startIdx + match[0].length;

    // Walk from afterOpen to find the matching </aside>.
    // Track nesting depth (aside-within-aside is rare but possible).
    let depth = 1;
    let pos = afterOpen;

    const bodyRe = /<\/?aside\b[^>]*>/gi;
    bodyRe.lastIndex = pos;

    let inner;
    while (depth > 0 && (inner = bodyRe.exec(result)) !== null) {
      if (inner[0].startsWith("</")) {
        depth--;
      } else {
        depth++;
      }
    }

    if (depth !== 0) {
      // Unbalanced aside — leave unchanged to avoid data loss.
      break;
    }

    // inner.index points to the start of the closing </aside>.
    // inner[0].length is the length of </aside>.
    const endIdx = inner.index + inner[0].length;

    // Splice out [startIdx, endIdx).
    result = result.slice(0, startIdx) + result.slice(endIdx);

    // Reset the outer regex since the string has changed.
    openTagRe.lastIndex = startIdx;
  }

  return result;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Conditionally strip the hidden desktop-sidebar aside from an HTML string.
 *
 * When `enabled` is false (or the page does not have a hidden sidebar), the
 * input is returned unchanged. This makes it safe to call unconditionally in
 * the pipeline — if the page shows its sidebar normally, nothing is removed.
 *
 * @param {string}  html     Normalized HTML.
 * @param {boolean} enabled  Master toggle (from config.stripHiddenSidebarDom).
 * @returns {string}         HTML with the hidden sidebar removed (or unchanged).
 */
export function maybeStripHiddenSidebar(html, enabled) {
  if (!enabled) return html;
  if (!hasHiddenSidebar(html)) return html;
  return stripDesktopSidebarAside(html);
}
