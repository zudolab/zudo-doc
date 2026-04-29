/**
 * extract-signals.mjs — structured signal extraction from normalized HTML.
 *
 * Pure function, no I/O, no side effects. Call normalizeHtml() first so that
 * build-time noise has already been removed before signals are extracted.
 *
 * Uses only Node.js built-ins (node:crypto) — no external parser dependency.
 * Regex-based parsing is sufficient because inputs are normalized HTML from
 * controlled Astro/zfb builds; we do not need a general-purpose HTML parser.
 */

import { createHash } from "node:crypto";

// ── Hashing ───────────────────────────────────────────────────────────────────

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ── Low-level attribute parser (shared with normalize-html logic) ─────────────

/**
 * Parse an attribute string into { name, value } objects.
 * value is null for boolean attributes.
 */
function parseAttrs(str) {
  const attrs = [];
  const re =
    /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>"'=`]+)))?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    attrs.push({
      name: m[1],
      value:
        m[2] !== undefined
          ? m[2]
          : m[3] !== undefined
            ? m[3]
            : m[4] !== undefined
              ? m[4]
              : null,
    });
  }
  return attrs;
}

/**
 * Get attribute value from a tag's attribute string.
 */
function getAttr(attrStr, attrName) {
  const attrs = parseAttrs(attrStr);
  return attrs.find((a) => a.name === attrName)?.value ?? null;
}

// ── Text extraction ───────────────────────────────────────────────────────────

/**
 * Extract visible text content from HTML (strips all tags and script/style).
 */
function extractVisibleText(html) {
  return html
    .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── DOM shape ─────────────────────────────────────────────────────────────────

/**
 * Extract a coarse DOM shape string: an ordered sequence of tag open/close
 * tokens (tag names only, no attributes, no text).
 * Used to detect structural regressions like headings moving or sections vanishing.
 */
function extractDomShape(html) {
  const tokens = [];
  const re = /<(\/?[a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^>]*)?\/?>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].toLowerCase();
    const selfCloseTags = new Set([
      "area", "base", "br", "col", "embed", "hr", "img", "input",
      "link", "meta", "param", "source", "track", "wbr",
    ]);
    // Self-closing markup in source (e.g. <img />) vs. void elements
    const isSelfClose = m[0].endsWith("/>") || selfCloseTags.has(raw);
    tokens.push(isSelfClose ? `<${raw}/>` : `<${raw}>`);
  }
  return tokens.join("");
}

// ── Headings ──────────────────────────────────────────────────────────────────

function extractHeadings(html) {
  const headings = [];
  const re = /<h([1-6])(?:\s[^>]*)?>( [\s\S]*?)<\/h\1>/gi;
  // Simpler version without the space requirement:
  const re2 = /<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re2.exec(html)) !== null) {
    const level = parseInt(m[1], 10);
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    headings.push([level, text]);
  }
  return headings;
}

// ── Meta tags ─────────────────────────────────────────────────────────────────

/**
 * Extract <meta name=...> and <meta property=...> tags.
 * Covers standard meta, OpenGraph (og:*), and Twitter Cards (twitter:*).
 */
function extractMetaTags(html) {
  const metas = [];
  const re = /<meta\s([^>]*?)(?:\s*\/)?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrStr = m[1];
    const attrs = parseAttrs(attrStr);
    const key =
      attrs.find((a) => a.name === "name") ||
      attrs.find((a) => a.name === "property");
    const content = attrs.find((a) => a.name === "content");
    if (key?.value != null && content != null) {
      metas.push([key.value, content.value ?? ""]);
    }
  }
  return metas;
}

// ── Canonical URL ─────────────────────────────────────────────────────────────

function extractCanonicalUrl(html) {
  const re = /<link\s([^>]*?)(?:\s*\/)?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    const rel = attrs.find((a) => a.name === "rel");
    if (rel?.value?.toLowerCase() === "canonical") {
      return attrs.find((a) => a.name === "href")?.value ?? null;
    }
  }
  return null;
}

// ── JSON-LD ───────────────────────────────────────────────────────────────────

function extractJsonLd(html) {
  const results = [];
  const re = /<script\s[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      results.push(JSON.parse(m[1].trim()));
    } catch {
      // Malformed JSON-LD — skip.
    }
  }
  return results;
}

// ── RSS/Atom links ────────────────────────────────────────────────────────────

function extractRssLinks(html) {
  const links = [];
  const re = /<link\s([^>]*?)(?:\s*\/)?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    const rel = attrs.find((a) => a.name === "rel");
    const type = attrs.find((a) => a.name === "type");
    if (
      rel?.value?.toLowerCase() === "alternate" &&
      (type?.value?.includes("rss") || type?.value?.includes("atom"))
    ) {
      const href = attrs.find((a) => a.name === "href");
      if (href?.value) links.push(href.value);
    }
  }
  return links;
}

// ── Link targets ──────────────────────────────────────────────────────────────

function extractLinkTargets(html) {
  const hrefs = [];
  const re = /<a\s([^>]*?)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = getAttr(m[1], "href");
    if (href != null) hrefs.push(href);
  }
  return hrefs;
}

// ── Asset refs ────────────────────────────────────────────────────────────────

/**
 * Collect all src/href references that point to assets (scripts, stylesheets,
 * images, fonts). Excludes plain anchor hrefs (those are linkTargets).
 */
function extractAssetRefs(html) {
  const refs = new Set();

  // <script src="...">
  const scriptRe = /<script\s([^>]*)>/gi;
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    const src = getAttr(m[1], "src");
    if (src) refs.add(src);
  }

  // <link href="..."> (stylesheets, preloads, etc.)
  const linkRe = /<link\s([^>]*?)(?:\s*\/)?>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    const rel = attrs.find((a) => a.name === "rel")?.value?.toLowerCase() ?? "";
    if (
      rel === "stylesheet" ||
      rel === "preload" ||
      rel === "modulepreload" ||
      rel === "prefetch"
    ) {
      const href = attrs.find((a) => a.name === "href")?.value;
      if (href) refs.add(href);
    }
  }

  // <img src="...">
  const imgRe = /<img\s([^>]*?)(?:\s*\/)?>/gi;
  while ((m = imgRe.exec(html)) !== null) {
    const src = getAttr(m[1], "src");
    if (src) refs.add(src);
  }

  return [...refs];
}

// ── Script inventory ──────────────────────────────────────────────────────────

/**
 * External <script src="..."> only — inline script bodies are excluded.
 */
function extractScriptInventory(html) {
  const srcs = [];
  const re = /<script\s([^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = getAttr(m[1], "src");
    if (src) srcs.push(src);
  }
  return srcs;
}

// ── Landmarks ─────────────────────────────────────────────────────────────────

/**
 * Extract coarse landmark list: [role, accessibleName] pairs.
 * Covers:
 *   - Semantic HTML5 landmarks: <nav>, <main>, <header>, <footer>, <aside>,
 *     <section> (with aria-label), <form> (with aria-label).
 *   - Explicit role="..." attributes.
 */
function extractLandmarks(html) {
  const landmarks = [];
  const IMPLICIT_ROLES = {
    nav: "navigation",
    main: "main",
    header: "banner",
    footer: "contentinfo",
    aside: "complementary",
    form: "form",
    section: "region",
  };

  // Match open tags of landmark elements and role="..." elements.
  // The attribute group is optional so bare tags like <main> also match.
  const re =
    /<(nav|main|header|footer|aside|section|form|article|div|span)(\s[^>]*)?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tagName = m[1].toLowerCase();
    const attrStr = m[2] ?? "";
    const attrs = parseAttrs(attrStr);

    const explicitRole = attrs.find((a) => a.name === "role")?.value ?? null;
    const ariaLabel = attrs.find((a) => a.name === "aria-label")?.value ?? "";

    let role = explicitRole ?? IMPLICIT_ROLES[tagName] ?? null;

    // <section>/<form> only qualify as landmarks when they have an accessible name.
    if ((tagName === "section" || tagName === "form") && !ariaLabel && !explicitRole) {
      continue;
    }

    if (role) {
      landmarks.push([role, ariaLabel]);
    }
  }

  return landmarks;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Extract structured signals from a normalized HTML string.
 *
 * Call normalizeHtml() on the input first to remove build-time noise before
 * extracting signals.
 *
 * @param {string} html - Normalized HTML page content.
 * @returns {Signals}
 */
export function extractSignals(html) {
  const domShape = extractDomShape(html);
  const visibleText = extractVisibleText(html);

  return {
    /** SHA-256 of the structural tag sequence (no attributes, no text). */
    domShapeHash: sha256(domShape),
    /** All visible text content, whitespace-collapsed. */
    visibleText,
    /** SHA-256 of the visible text. */
    textHash: sha256(visibleText),
    /** Ordered list of [level, text] heading pairs. */
    headings: extractHeadings(html),
    /**
     * [name/property, content] pairs for <meta name=...> and
     * <meta property=...> (covers OpenGraph og:* and Twitter twitter:* cards).
     */
    metaTags: extractMetaTags(html),
    /** href of <link rel="canonical"> or null if absent. */
    canonicalUrl: extractCanonicalUrl(html),
    /** Parsed JSON-LD objects from <script type="application/ld+json">. */
    jsonLd: extractJsonLd(html),
    /** href values of <link rel="alternate" type="application/rss+xml|atom+xml">. */
    rssLinks: extractRssLinks(html),
    /** href values of all <a> tags. */
    linkTargets: extractLinkTargets(html),
    /** Unique src/href refs for scripts, stylesheets, images, preloads. */
    assetRefs: extractAssetRefs(html),
    /** src values of external <script src="..."> tags (no inline bodies). */
    scriptInventory: extractScriptInventory(html),
    /**
     * Coarse landmark inventory: [role, accessibleName] pairs.
     * Covers HTML5 semantic elements and explicit role="..." attributes.
     */
    landmarks: extractLandmarks(html),
  };
}
