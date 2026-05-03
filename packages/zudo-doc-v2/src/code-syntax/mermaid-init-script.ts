// Browser init script for mermaid diagram rendering.
//
// Converted from the TypeScript <script> block in
// `src/components/mermaid-init.astro` — TypeScript syntax stripped
// so the string can be emitted via `dangerouslySetInnerHTML` and parsed
// by the browser directly.
//
// Wrapped in an IIFE to avoid polluting the global scope.
// Kept in a separate module so future edits can be reviewed in isolation.
//
// Lifecycle vocabulary: the page-navigate-end hook reads
// `AFTER_NAVIGATE_EVENT` from `transitions/page-events.ts` rather than
// a hard-coded `astro:*` literal — see that module's header for the
// full vocabulary rationale (zudolab/zudo-doc#1335 E2 task 2 half B).
//
// ## Mermaid module URL — Wave 13 (zudolab/zudo-doc#1355 Topic 4)
//
// The legacy script under Astro+Vite did `await import("mermaid")` and
// relied on Vite to bundle the bare specifier into the page's JS
// pipeline. Under zfb the script reaches the browser as plain inline
// JS — no bundler is in the path — so the bare specifier raised
// `Failed to resolve module specifier 'mermaid'` at runtime and the
// `[data-mermaid]` containers were never converted to SVG. The fix
// here is to import mermaid from a public ESM CDN
// (`MERMAID_CDN_MODULE_URL` below). Trade-offs:
//
//   * Pros — keeps mermaid out of the islands esbuild bundle (mermaid
//     pulls in `roughjs`, `d3-sankey`, `dayjs`, `@braintree/sanitize-url`,
//     `ts-dedent`, … which exceed esbuild's default neutral-platform
//     resolve set in this consumer). Pages without diagrams continue
//     to pay zero runtime cost — the dynamic import is gated on a
//     non-empty `[data-mermaid]:not([data-mermaid-rendered])` query.
//
//   * Cons — adds a runtime dependency on esm.sh availability for any
//     page that actually uses a mermaid diagram. `esm.sh` is a free
//     mirror with established uptime; sites that want self-hosted
//     mermaid should override `bodyEndScripts` on `<DocLayoutWithDefaults>`
//     and emit their own script that imports mermaid through their own
//     bundler.
//
// The version pin is intentionally a major-only `@11` so security
// patches and bug fixes flow through automatically; package.json's
// `mermaid` dep should be kept on the same major to avoid theme-API
// drift between SSR-time mermaid (used in build/test) and runtime
// mermaid (loaded by this script).
import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";

/**
 * ESM CDN URL the inline init script imports `mermaid` from. esm.sh
 * resolves npm package specifiers to publishable ESM modules. The pin
 * stays on major-11 so the dependency bump in package.json (`mermaid:
 * ^11.x`) and the script's runtime resolution land on the same major
 * version family.
 *
 * Exported (rather than baked into the template) so consumers and
 * tests can override the URL — e.g. self-hosted mirrors, version-
 * locked deployments — without re-templating the whole script.
 */
export const MERMAID_CDN_MODULE_URL = "https://esm.sh/mermaid@11";

/**
 * Build the inline init script with a caller-supplied module URL.
 *
 * Why a builder (vs. just exporting `MERMAID_INIT_SCRIPT`): the
 * constant interpolates `MERMAID_CDN_MODULE_URL` at module-load time,
 * so reassigning the exported binding has no runtime effect — ESM
 * exports are read-only and the script string is already frozen by
 * the time consumers see it. Hosts that need a self-hosted /
 * version-pinned / CSP-allowlisted mermaid URL call this builder
 * with their URL and pass the result to `<MermaidInit script={…}/>`
 * (or to their own `<script dangerouslySetInnerHTML>` site).
 *
 * The default-URL flow stays available via `MERMAID_INIT_SCRIPT`
 * (built once below by calling this builder with
 * `MERMAID_CDN_MODULE_URL`) so existing callers keep working
 * unchanged.
 */
export function buildMermaidInitScript(cdnUrl: string): string {
  return makeScript(cdnUrl);
}

function makeScript(cdnUrl: string): string {
  return `(function () {
  /**
   * Resolve a CSS value to a hex color (#rrggbb).
   * CSS custom properties return raw values from getComputedStyle (e.g.
   * "light-dark(#fff, #000)") which mermaid cannot parse. This uses a
   * temporary element so the browser resolves any CSS function to a
   * concrete rgb() value, then converts it to hex.
   */
  function resolveColor(value) {
    if (!value) return value;
    if (/^#[0-9a-fA-F]{3}$/.test(value)) {
      return "#" + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
    }
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
    if (/^#[0-9a-fA-F]{8}$/.test(value)) return value.slice(0, 7);
    if (/^#[0-9a-fA-F]{4}$/.test(value)) {
      return "#" + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
    }
    var el = document.createElement("div");
    el.style.display = "none";
    el.style.color = value;
    document.body.appendChild(el);
    var resolved;
    try {
      resolved = getComputedStyle(el).color;
    } finally {
      el.remove();
    }
    var m = resolved.match(/(\d+)/g);
    if (m && m.length >= 3) {
      return "#" + m.slice(0, 3).map(function (n) { return Number(n).toString(16).padStart(2, "0"); }).join("");
    }
    return value;
  }

  async function initMermaid() {
    var els = document.querySelectorAll("[data-mermaid]:not([data-mermaid-rendered])");
    if (els.length === 0) return;

    try {
      // Wave 13 (zudolab/zudo-doc#1355 Topic 4): import mermaid from a
      // public ESM CDN URL because the inline <script> reaches the
      // browser without a bundler — bare specifiers like "mermaid"
      // cannot be resolved at runtime. See the file header for the
      // full trade-off rationale.
      var mod = await import(${JSON.stringify(cdnUrl)});
      var mermaid = mod.default;
      var s = getComputedStyle(document.documentElement);
      // Read a custom property, resolve through the temporary-element
      // round-trip to a hex color, and return undefined when the
      // property is unset on :root. mermaid.initialize crashes (khroma
      // "Unsupported color format: ''") if a theme variable is the
      // empty string, but tolerates undefined as "use the default" —
      // so unset host tokens fall back to mermaid's own theme palette.
      var v = function (name) {
        var raw = s.getPropertyValue(name).trim();
        if (!raw) return undefined;
        var resolved = resolveColor(raw);
        return resolved || undefined;
      };
      var bg = v("--zd-bg");
      // Default luminance to 0.5 (treated as light by the < 0.5 check
      // below) when --zd-bg is not yet on :root. NaN would cascade into
      // an "is dark" decision via the Number.isNaN guard, but skipping
      // the parse entirely is cleaner and lets the page's <html
      // data-theme> attribute remain authoritative.
      var luminance = NaN;
      if (bg && bg.charAt(0) === "#" && bg.length === 7) {
        var hex = bg.replace("#", "");
        var r = parseInt(hex.substring(0, 2), 16) / 255;
        var g = parseInt(hex.substring(2, 4), 16) / 255;
        var b = parseInt(hex.substring(4, 6), 16) / 255;
        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      // Build themeVariables dynamically so undefined values don't
      // reach khroma's color parser. mermaid's defaults fill in the
      // gaps for any host token that is unset (e.g. when the consumer
      // has not yet mounted ColorSchemeProvider on :root).
      var themeVariables = {
        darkMode: Number.isNaN(luminance) ? true : luminance < 0.5,
        background: "transparent",
        fontFamily: "inherit",
      };
      function setIfDefined(key, value) {
        if (value !== undefined) themeVariables[key] = value;
      }
      var nodeBg = v("--zd-mermaid-node-bg");
      var textColor = v("--zd-mermaid-text");
      var lineColor = v("--zd-mermaid-line");
      var noteBg = v("--zd-mermaid-note-bg");
      var labelBg = v("--zd-mermaid-label-bg");
      setIfDefined("primaryColor", nodeBg);
      setIfDefined("primaryTextColor", textColor);
      setIfDefined("primaryBorderColor", lineColor);
      setIfDefined("lineColor", lineColor);
      setIfDefined("secondaryColor", noteBg);
      setIfDefined("tertiaryColor", noteBg);
      setIfDefined("edgeLabelBackground", labelBg);
      setIfDefined("labelTextColor", textColor);
      setIfDefined("transitionColor", lineColor);
      setIfDefined("transitionLabelColor", textColor);
      setIfDefined("stateLabelColor", textColor);
      setIfDefined("noteBkgColor", noteBg);
      setIfDefined("noteTextColor", textColor);
      setIfDefined("noteBorderColor", lineColor);
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: themeVariables,
      });
      await mermaid.run({ nodes: Array.from(els) });
      els.forEach(function (el) { el.setAttribute("data-mermaid-rendered", ""); });
    } catch (e) {
      console.error("[mermaid-init] Failed to render mermaid diagrams:", e);
    }
  }

  /** Re-render all mermaid diagrams (clear rendered state so initMermaid picks them up). */
  function reinitMermaid() {
    document.querySelectorAll("[data-mermaid-rendered]").forEach(function (el) {
      el.removeAttribute("data-mermaid-rendered");
      // Remove rendered SVG so mermaid regenerates from source text.
      var svg = el.querySelector("svg");
      if (svg) svg.remove();
    });
    initMermaid();
  }

  // AFTER_NAVIGATE_EVENT fires on initial parse (DOMContentLoaded under
  // the zfb runtime) — every navigation is a real page load, so this
  // listener also covers the post-navigation re-render path.
  document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)}, function () { initMermaid(); });

  // Re-render mermaid when color tweak panel changes CSS custom properties (debounced).
  var tweakTimer;
  new MutationObserver(function () {
    clearTimeout(tweakTimer);
    tweakTimer = setTimeout(reinitMermaid, 300);
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style"],
  });
})();`;
}

/**
 * Default-URL init script. Built once at module load by passing
 * `MERMAID_CDN_MODULE_URL` to `buildMermaidInitScript`. Kept as the
 * primary export for backward compatibility — `<MermaidInit/>` (no
 * props) and any direct consumer that grabs this string both end up
 * importing mermaid from `https://esm.sh/mermaid@11`.
 *
 * For a custom URL (self-hosted mirror, version-pinned package,
 * CSP-allowlisted host) call `buildMermaidInitScript(yourUrl)` and
 * pass the result to `<MermaidInit script={…}/>`.
 */
export const MERMAID_INIT_SCRIPT = buildMermaidInitScript(MERMAID_CDN_MODULE_URL);
