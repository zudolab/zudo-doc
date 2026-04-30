/**
 * strip-version-switcher.mjs — strip version-switcher DOM before signal extraction.
 *
 * Context (phase B-14-2, issue #914):
 *   A's Astro DocLayout renders <div class="version-switcher"> inline in <main>
 *   next to the breadcrumb. The element contains a button ("Version: Latest")
 *   and a hidden <ul> with version links (Latest, 1.0.0, All versions — ~45 chars).
 *   zfb's host puts the version-switcher only in the header; the inline dropdown
 *   is cosmetic chrome that is functionally redundant with the header switcher.
 *
 *   Coverage: ~30 of 51 content-loss routes have "Version: Latest" in A's main
 *   extraction, making this the dominant false-positive signal.
 *
 *   Strategy: strip version-switcher <div> elements from both A (Astro) and B
 *   (zfb) HTML before signal extraction. When both sides are stripped
 *   symmetrically the switcher text ("Version: Latest", "1.0.0", "All versions")
 *   falls out of the diff entirely. Two markup shapes are stripped:
 *
 *   1. **A-side (Astro) div.version-switcher** — `<div class="version-switcher" …>`.
 *      Emitted inline in <main> by A's DocLayout next to the breadcrumb.
 *
 *   2. **B-side marker** — `<div data-version-switcher …>`. Emitted when zfb's
 *      DocLayout renders its own switcher component; stripped so that any
 *      incidental inline switcher on B falls out of the diff too.
 *
 *   The strip is gated by `enabled` in the run config and only fires when one
 *   of the two markers is present, so pages without a version-switcher pass
 *   through untouched.
 *
 *   Same pattern as strip-hidden-sidebar.mjs — see that module for the general
 *   balanced-depth walk rationale.
 */

// ── Tag-level pattern matchers ────────────────────────────────────────────────

/**
 * @param {string} tag  A `<div …>` opening tag.
 * @returns {boolean}   True when the tag's class attribute contains
 *                      the word "version-switcher" (A-side Astro pattern).
 */
function isVersionSwitcherClassTag(tag) {
  const classMatch = tag.match(/\bclass\s*=\s*"([^"]*)"/i);
  if (!classMatch) return false;
  // Split on whitespace and require exact token equality so that
  // compound class names like "version-switcher-wrapper" are NOT matched.
  return classMatch[1].split(/\s+/).some((token) => token === "version-switcher");
}

/**
 * @param {string} tag  A `<div …>` opening tag.
 * @returns {boolean}   True when the tag carries a `data-version-switcher`
 *                      attribute (B-side zfb marker).
 */
function isVersionSwitcherDataTag(tag) {
  return /\bdata-version-switcher\b/i.test(tag);
}

/**
 * @param {string} tag  A `<div …>` opening tag.
 * @returns {boolean}   True when the tag is one of the recognised
 *                      version-switcher shapes (A-side class OR B-side data
 *                      attribute).
 */
function isVersionSwitcherDivTag(tag) {
  return isVersionSwitcherClassTag(tag) || isVersionSwitcherDataTag(tag);
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Return true when the HTML contains at least one version-switcher marker —
 * either a `<div class="… version-switcher …">` (A-side) or a
 * `<div data-version-switcher …>` (B-side).
 *
 * Only `<div>` opening tags are scanned — both known markup shapes use a
 * `<div>` as the container.
 *
 * @param {string} html  Normalized HTML string.
 * @returns {boolean}
 */
export function hasVersionSwitcher(html) {
  const openTagRe = /<div\b[^>]*>/gi;
  let match;
  while ((match = openTagRe.exec(html)) !== null) {
    if (isVersionSwitcherDivTag(match[0])) return true;
  }
  return false;
}

// ── Stripping ─────────────────────────────────────────────────────────────────

/**
 * Remove every version-switcher div element from `html`.
 *
 * For each `<div …>` opening tag we recognise as a version-switcher (class or
 * data-attribute shape), splice out the entire balanced element including its
 * children. Other divs are left intact.
 *
 * Uses a balanced-depth walker to correctly handle nested `<div>` elements
 * inside the switcher (the hidden `<ul>`, button, etc.). This is regex-based
 * parsing of controlled Astro/zfb output — the existing harness pipeline is
 * regex-based throughout and we follow that convention.
 *
 * @param {string} html  HTML string (normalized or raw).
 * @returns {string}     HTML with version-switcher div elements removed.
 */
export function stripVersionSwitcher(html) {
  let result = html;
  let scanFrom = 0;

  while (true) {
    const openTagRe = /<div\b[^>]*>/gi;
    openTagRe.lastIndex = scanFrom;
    const match = openTagRe.exec(result);
    if (!match) break;

    if (!isVersionSwitcherDivTag(match[0])) {
      // Not a version-switcher div — skip past this opening tag and keep scanning.
      scanFrom = match.index + match[0].length;
      continue;
    }

    const startIdx = match.index;
    const afterOpen = startIdx + match[0].length;

    // Walk from afterOpen to find the matching </div>.
    // Track nesting depth (div-within-div is common inside the switcher dropdown).
    let depth = 1;
    const bodyRe = /<\/?div\b[^>]*>/gi;
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
      // Unbalanced div — leave unchanged to avoid data loss.
      break;
    }

    // inner.index points to the start of the closing </div>.
    const endIdx = inner.index + inner[0].length;
    result = result.slice(0, startIdx) + result.slice(endIdx);

    // Continue scanning from the splice point — the next div (if any)
    // starts at or after this position in the rewritten string.
    scanFrom = startIdx;
  }

  return result;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Conditionally strip version-switcher div elements from an HTML string.
 *
 * When `enabled` is false (or the page does not have any version-switcher
 * marker), the input is returned unchanged. This makes it safe to call
 * unconditionally in the pipeline — pages without a version-switcher pass
 * through untouched.
 *
 * @param {string}  html     Normalized HTML.
 * @param {boolean} enabled  Master toggle (from config.stripVersionSwitcherDom).
 * @returns {string}         HTML with version-switcher elements removed (or unchanged).
 */
export function maybeStripVersionSwitcher(html, enabled) {
  if (!enabled) return html;
  if (!hasVersionSwitcher(html)) return html;
  return stripVersionSwitcher(html);
}
