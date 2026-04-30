/**
 * normalize-html.mjs — deterministic HTML normalization for snapshot diffing.
 *
 * Pure function, no I/O, no side effects. Intended to be called on both the
 * "before" and "after" HTML snapshots before comparing them, so that
 * build-time noise (content hashes, whitespace, attribute ordering,
 * hydration markers) does not produce false-positive diffs.
 */

import { applyTypographyNormalizationToTextNodes } from "./normalize-typography.mjs";

// Attributes with these prefixes are pure framework noise — strip them.
const STRIP_ATTR_PREFIXES = ["data-zfb-island-", "data-astro-"];

// URL-bearing attributes where sitePrefix / hash normalization applies.
const URL_ATTRS = new Set(["href", "src", "action", "data", "poster", "srcset"]);

// ── Attribute parsing ─────────────────────────────────────────────────────────

/**
 * Parse an attribute string into an array of { name, value } objects.
 * value is null for boolean attributes (no = sign).
 *
 * Handles: double-quoted, single-quoted, and unquoted values.
 */
function parseAttrs(str) {
  const attrs = [];
  // Each iteration advances past one attribute.
  const re =
    /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>"'=`]+)))?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const name = m[1];
    const value =
      m[2] !== undefined
        ? m[2]
        : m[3] !== undefined
          ? m[3]
          : m[4] !== undefined
            ? m[4]
            : null;
    attrs.push({ name, value });
  }
  return attrs;
}

// ── URL normalization helpers ─────────────────────────────────────────────────

/**
 * Strip build-hash query strings from a URL.
 * /foo.js?v=abc123 → /foo.js
 * Handles common patterns: ?v=..., ?rev=..., ?hash=...
 */
function stripHashQuery(url) {
  return url
    .replace(/[?&]v=[a-zA-Z0-9_-]+/g, "")
    .replace(/[?&]rev=[a-zA-Z0-9_-]+/g, "")
    .replace(/[?&]hash=[a-zA-Z0-9_-]+/g, "")
    .replace(/^[?&]/, "")
    .replace(/[?&]$/, "");
}

/**
 * Strip content-hash suffixes from asset filenames under /_assets/.
 * /_assets/main.abc123def4.js → /_assets/main.[hash].js
 */
function stripHashFilename(url) {
  return url.replace(
    /((?:\/_assets\/|\/assets\/)(?:[^?#\s/]*\.))[a-f0-9]{8,}(\.[a-z0-9]+(?:\?|#|$))/gi,
    "$1[hash]$2"
  );
}

/**
 * Normalize a URL value: strip site prefix, hash query, hash filename.
 */
function normalizeUrl(url, sitePrefix) {
  if (!url) return url;
  let result = url;

  if (sitePrefix) {
    // Strip trailing slash from prefix for matching purposes.
    const prefix = sitePrefix.endsWith("/")
      ? sitePrefix.slice(0, -1)
      : sitePrefix;
    if (result.startsWith(prefix + "/") || result === prefix) {
      result = result.slice(prefix.length);
      if (!result.startsWith("/")) result = "/" + result;
    }
  }

  result = stripHashQuery(result);
  result = stripHashFilename(result);
  return result;
}

// ── Tag processing ────────────────────────────────────────────────────────────

/**
 * Process a single open tag:
 *   1. Strip hydration-runtime data-* attributes.
 *   2. Normalize URL values in URL-bearing attributes.
 *   3. Sort remaining attributes alphabetically.
 *   4. Reconstruct the tag string.
 *
 * Closing tags and self-contained constructs (comments, doctype) are returned
 * unchanged.
 */
function processTag(tagStr, sitePrefix) {
  // Closing tags, comments, doctype — leave untouched.
  if (tagStr.startsWith("</") || tagStr.startsWith("<!")) return tagStr;

  const selfClose = tagStr.endsWith("/>");
  // Remove the outer < and > (and the / for self-closing).
  const inner = tagStr.slice(1, selfClose ? tagStr.length - 2 : tagStr.length - 1);

  // Find first whitespace to split tag name from attribute string.
  const wsIdx = inner.search(/\s/);
  if (wsIdx === -1) return tagStr; // No attributes — nothing to do.

  const tagName = inner.slice(0, wsIdx);
  const attrStr = inner.slice(wsIdx);

  let attrs = parseAttrs(attrStr);

  // Strip hydration runtime data-* noise.
  attrs = attrs.filter(
    (a) => !STRIP_ATTR_PREFIXES.some((p) => a.name.startsWith(p))
  );

  // Always normalize URL values (strip hash queries, hash filenames).
  // Site prefix stripping happens only when sitePrefix is provided.
  attrs = attrs.map((a) => {
    if (!URL_ATTRS.has(a.name) || a.value === null) return a;
    return { ...a, value: normalizeUrl(a.value, sitePrefix) };
  });

  // Sort alphabetically by attribute name.
  attrs.sort((a, b) => a.name.localeCompare(b.name));

  const attrsOut = attrs
    .map((a) => (a.value === null ? a.name : `${a.name}="${a.value}"`))
    .join(" ");

  return `<${tagName}${attrsOut ? " " + attrsOut : ""}${selfClose ? " /" : ""}>`;
}

// ── Preserved-block splitter ──────────────────────────────────────────────────

/**
 * Split HTML into alternating segments:
 *   { preserved: true }  — content of <pre>, <code>, <textarea> blocks
 *   { preserved: false } — everything else
 *
 * Whitespace inside preserved blocks must not be collapsed.
 */
function splitPreservedBlocks(html) {
  const segments = [];
  const re =
    /(<(?:pre|code|textarea)(?:\s[^>]*)?>[\s\S]*?<\/(?:pre|code|textarea)>)/gi;
  let lastIdx = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ preserved: false, content: html.slice(lastIdx, m.index) });
    }
    segments.push({ preserved: true, content: m[0] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < html.length) {
    segments.push({ preserved: false, content: html.slice(lastIdx) });
  }
  return segments;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Normalize an HTML string for deterministic snapshot comparison.
 *
 * @param {string} html - Raw HTML page content.
 * @param {{ sitePrefix?: string }} [options]
 *   sitePrefix: URL path prefix used by the deployed site (e.g. "/pj/zudo-doc/").
 *               When set, href/src/canonical values starting with this prefix are
 *               stripped down to the bare path (e.g. /pj/zudo-doc/docs/x → /docs/x).
 *               This is the prefix-normalization layer agreed in codex/gcoc review —
 *               it lives here at the signal-extraction boundary, not in the static server.
 * @returns {string} Normalized HTML.
 */
export function normalizeHtml(html, options = {}) {
  const { sitePrefix = "" } = options;

  let result = html;

  // ── 1. Strip Cloudflare workerd-injected error overlays ──────────────────
  // CF workerd sometimes injects inline error pages / response header dumps.
  result = result.replace(
    /<!--\s*cloudflare[\s\S]*?-->/gi,
    ""
  );
  // CF error overlay divs identified by well-known class/data patterns.
  result = result.replace(
    /<div[^>]*(?:class="[^"]*cf-error[^"]*"|data-cf-[a-z-]+=)[^>]*>[\s\S]*?<\/div>/gi,
    ""
  );

  // ── 2. Collapse whitespace between tags, preserve pre/code/textarea ──────
  // Also canonicalize quote / apostrophe typography in text content so the
  // zfb MDX output (literal `&quot;` entity, U+0027 straight apostrophe)
  // matches Astro's smartypants output (Unicode `“ ” ‘ ’` glyphs). See
  // ./normalize-typography.mjs for the rationale and idempotency guarantee.
  const segments = splitPreservedBlocks(result);
  result = segments
    .map((seg) => {
      if (seg.preserved) return seg.content;
      const collapsed = seg.content
        .replace(/>\s+</g, "><") // whitespace between tags
        .replace(/^\s+|\s+$/g, ""); // leading/trailing
      return applyTypographyNormalizationToTextNodes(collapsed);
    })
    .join("");

  // ── 3. Process open tags (sort attrs, strip runtime data-*, normalize URLs) ─
  // Tag regex: matches open tags handling quoted attribute values.
  // Does not match closing tags (</…>) — they don't start with <[a-zA-Z].
  const OPEN_TAG_RE =
    /<[a-zA-Z][a-zA-Z0-9:-]*(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?(?:\s*\/)?>/g;
  result = result.replace(OPEN_TAG_RE, (match) => processTag(match, sitePrefix));

  return result;
}
