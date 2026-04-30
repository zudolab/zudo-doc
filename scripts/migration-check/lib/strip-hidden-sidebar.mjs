/**
 * strip-hidden-sidebar.mjs — strip hidden-sidebar DOM before signal extraction.
 *
 * Context (phase B-12, issue #907, option (b); extended in phase B-13-1, issue #912):
 *   Tag-listing routes (/docs/tags/<tag> and JA mirrors) and other hideSidebar=true
 *   routes ship hidden-sidebar markup that the user never sees. The harness must
 *   not count that markup against either side in the content-loss check.
 *
 *   Strategy: strip the hidden-sidebar element from both A (Astro) and B (zfb)
 *   HTML before signal extraction. When both sides are stripped symmetrically the
 *   sidebar content falls out of the diff entirely, so the route is classified by
 *   its actual visible content rather than by DOM that was always hidden.
 *
 *   Two markup shapes are stripped:
 *
 *   1. **B-side (zfb) hidden aside** — `<aside id="desktop-sidebar" class="sr-only">`.
 *      Emitted by zfb DocLayout when `hideSidebar=true`.
 *
 *   2. **A-side (Astro) mobile-drawer aside** — `<aside class="… lg:hidden …
 *      -translate-x-full …">` (multi-line class attribute). Emitted by the
 *      `SidebarToggle` Preact island; hidden on every viewport at first paint
 *      (`lg:hidden` hides on desktop, `-translate-x-full` hides on mobile when
 *      the drawer is closed). Without stripping it, this aside contributes a
 *      complementary landmark plus nested empty navigation landmark plus inner
 *      nav link text on hideSidebar=true routes — the cluster C asymmetry
 *      identified in the post-B-12 analysis.
 *
 *   The strip is gated by `enabled` in the run config and only fires when one
 *   of the two markers is present, so regular doc pages are unaffected.
 */

// ── Tag-level pattern matchers ────────────────────────────────────────────────

/**
 * @param {string} tag  An `<aside ...>` opening tag.
 * @returns {boolean}   True when the tag is the zfb hideSidebar marker.
 */
function isZfbHiddenAsideTag(tag) {
  return /\bid="desktop-sidebar"/i.test(tag)
    && /\bclass\s*=\s*"[^"]*\bsr-only\b[^"]*"/i.test(tag);
}

/**
 * @param {string} tag  An `<aside ...>` opening tag (may span multiple lines).
 * @returns {boolean}   True when the tag is the Astro mobile-drawer aside —
 *                      its class attribute contains both `lg:hidden` and
 *                      `-translate-x-full`. Class may span multiple lines.
 */
function isAstroMobileDrawerAsideTag(tag) {
  const classMatch = tag.match(/\bclass\s*=\s*"([^"]*)"/i);
  if (!classMatch) return false;
  const cls = classMatch[1];
  return /\blg:hidden\b/.test(cls) && /-translate-x-full/.test(cls);
}

/**
 * @param {string} tag  An `<aside ...>` opening tag.
 * @returns {boolean}   True when the tag is one of the recognised hidden-aside
 *                      shapes (B-side zfb sr-only OR A-side mobile drawer).
 */
function isHiddenAsideTag(tag) {
  return isZfbHiddenAsideTag(tag) || isAstroMobileDrawerAsideTag(tag);
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Return true when the HTML contains at least one hidden-sidebar marker —
 * either the zfb `<aside id="desktop-sidebar" class="sr-only">` (B-side) or
 * the Astro mobile-drawer aside whose class attribute contains both
 * `lg:hidden` and `-translate-x-full` (A-side). The aside opening tag may
 * span multiple lines (newlines inside the class attribute value), so we
 * scan with a tag-level walker rather than a single regex.
 *
 * @param {string} html  Normalized HTML string.
 * @returns {boolean}
 */
export function hasHiddenSidebar(html) {
  const openTagRe = /<aside\b[^>]*>/gi;
  let match;
  while ((match = openTagRe.exec(html)) !== null) {
    if (isHiddenAsideTag(match[0])) return true;
  }
  return false;
}

// ── Stripping ─────────────────────────────────────────────────────────────────

/**
 * Remove every hidden-aside element from `html`.
 *
 * For each `<aside ...>` opening tag we recognise as a hidden-aside (zfb or
 * Astro mobile-drawer shape), splice out the entire balanced element including
 * its children. Asides that do not match either pattern are left intact.
 *
 * Uses a balanced-depth walker rather than a simple regex so that nested
 * aside elements (rare but possible) are handled correctly. This is regex-based
 * parsing of controlled Astro/zfb output — the existing harness pipeline is
 * regex-based (see normalize-html.mjs, extract-signals.mjs) and we follow that
 * convention.
 *
 * @param {string} html  HTML string (normalized or raw).
 * @returns {string}     HTML with hidden-aside elements removed.
 */
export function stripHiddenAside(html) {
  let result = html;
  let scanFrom = 0;

  while (true) {
    const openTagRe = /<aside\b[^>]*>/gi;
    openTagRe.lastIndex = scanFrom;
    const match = openTagRe.exec(result);
    if (!match) break;

    if (!isHiddenAsideTag(match[0])) {
      // Not a hidden aside — skip past this opening tag and keep scanning.
      scanFrom = match.index + match[0].length;
      continue;
    }

    const startIdx = match.index;
    const afterOpen = startIdx + match[0].length;

    // Walk from afterOpen to find the matching </aside>.
    // Track nesting depth (aside-within-aside is rare but possible).
    let depth = 1;
    const bodyRe = /<\/?aside\b[^>]*>/gi;
    bodyRe.lastIndex = afterOpen;

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
    const endIdx = inner.index + inner[0].length;
    result = result.slice(0, startIdx) + result.slice(endIdx);

    // Continue scanning from the splice point — the next aside (if any)
    // starts at or after this position in the rewritten string.
    scanFrom = startIdx;
  }

  return result;
}

/**
 * Backward-compat alias for `stripHiddenAside`.
 *
 * The original B-12-5 implementation only stripped the zfb desktop-sidebar
 * aside and was named after that shape. The function now strips both the
 * zfb aside and the Astro mobile-drawer aside (B-13-1), so the new name
 * `stripHiddenAside` reflects the broader contract. The old export is kept
 * so existing imports (notably the unit-test file) continue to work.
 *
 * @param {string} html
 * @returns {string}
 */
export const stripDesktopSidebarAside = stripHiddenAside;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Conditionally strip hidden-sidebar asides from an HTML string.
 *
 * When `enabled` is false (or the page does not have any hidden sidebar
 * marker), the input is returned unchanged. This makes it safe to call
 * unconditionally in the pipeline — pages without a hidden sidebar pass
 * through untouched.
 *
 * @param {string}  html     Normalized HTML.
 * @param {boolean} enabled  Master toggle (from config.stripHiddenSidebarDom).
 * @returns {string}         HTML with hidden-aside elements removed (or unchanged).
 */
export function maybeStripHiddenSidebar(html, enabled) {
  if (!enabled) return html;
  if (!hasHiddenSidebar(html)) return html;
  return stripHiddenAside(html);
}
