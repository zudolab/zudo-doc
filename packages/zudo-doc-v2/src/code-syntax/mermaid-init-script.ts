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
// The version pin is a specific `@11.x.y` — see the constant below for
// the rationale and bump policy. Floating on `@11` invited silent
// upstream behaviour drift between SSR-time mermaid (in package.json)
// and runtime mermaid (loaded from esm.sh by this script).
import { AFTER_NAVIGATE_EVENT } from "../transitions/page-events.js";

/**
 * ESM CDN URL the inline init script imports `mermaid` from. esm.sh
 * resolves npm package specifiers to publishable ESM modules.
 *
 * Pinned to a specific minor.patch (not the bare `@11` major) so the
 * runtime version is byte-stable across deploys; floating on the major
 * would silently pull in upstream theme-API or behaviour changes the
 * SSR-time mermaid in package.json hasn't been pinned to. Bump policy:
 * raise this string in the same PR that bumps `mermaid` in
 * package.json so the SSR-time and runtime mermaid versions stay
 * matched. Cross-major jumps need an extra parity smoke (`pnpm build`
 * and a manual diagram render) since esm.sh's exports drift between
 * majors.
 *
 * Exported (rather than baked into the template) so consumers and
 * tests can override the URL — e.g. self-hosted mirrors, version-
 * locked deployments — without re-templating the whole script.
 */
export const MERMAID_CDN_MODULE_URL = "https://esm.sh/mermaid@11.4.1";

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
  // JSON.stringify produces a valid JS string literal but does NOT
  // escape `</script>`; if such a sequence appeared inside `cdnUrl`
  // the browser's HTML parser would close the surrounding inline
  // <script> tag prematurely and start parsing the rest as HTML.
  // Defense-in-depth: rewrite `</` so the literal stays inside the
  // script context. JSON.stringify keeps the URL parseable as JS at
  // runtime — the `\/` sequence is just a character escape that the
  // JS lexer collapses back to "/".
  const safeUrlLiteral = JSON.stringify(cdnUrl).replace(
    /<\/(script)/gi,
    "<\\/$1",
  );
  return `(function () {
  /**
   * Syntactically pick the matching arg from a CSS \`light-dark(a, b)\`
   * value, based on the active theme attribute on \`:root\`.
   *
   * zudolab/zudo-doc#1458: mermaid 11.4.1 ships khroma 2.1.0, which
   * does not understand the CSS \`light-dark()\` function. CSS custom
   * properties on \`:root\` are written as \`light-dark(#hex-light,
   * #hex-dark)\` when colorMode is configured (see
   * \`generateLightDarkCssProperties\` in
   * \`src/config/color-scheme-utils.ts\`), and \`getPropertyValue\`
   * returns them as the literal string. The earlier resolveColor
   * temp-element trick — assigning the value to \`el.style.color\` and
   * reading \`getComputedStyle\` — was unreliable in production
   * (depends on browser \`light-dark()\` support and on
   * \`color-scheme\` propagating to the temp element), so we parse
   * the function syntactically here.
   *
   * Returns the picked hex on success, or \`null\` if the input is not
   * a \`light-dark(...)\` value (caller falls back to resolveColor for
   * \`oklch(...)\`, \`rgb(...)\`, etc.). When the theme attribute is
   * missing — first paint before the color-scheme bootstrap runs, or
   * a host that does not configure colorMode — returns the light arg
   * as a deterministic default.
   */
  function parseLightDark(raw, theme) {
    if (!raw) return null;
    var m = raw.match(/^\\s*light-dark\\s*\\(\\s*([^,]+?)\\s*,\\s*([^)]+?)\\s*\\)\\s*$/);
    if (!m) return null;
    return theme === "dark" ? m[2] : m[1];
  }

  /**
   * Resolve a CSS value to a hex color (#rrggbb).
   * CSS custom properties return raw values from getComputedStyle (e.g.
   * "light-dark(#fff, #000)") which mermaid cannot parse. This uses a
   * temporary element so the browser resolves any CSS function to a
   * concrete rgb() value, then converts it to hex.
   *
   * \`light-dark(...)\` is now handled syntactically in
   * \`parseLightDark\` above (zudolab/zudo-doc#1458) — this function
   * remains as a fallback for any other CSS function value
   * (\`oklch(...)\`, \`rgb(...)\`, named colors, etc.).
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
      var mod = await import(${safeUrlLiteral});
      var mermaid = mod.default;
      var s = getComputedStyle(document.documentElement);
      // Read the active theme attribute that the color-scheme-provider
      // bootstrap pins on :root (see
      // packages/zudo-doc-v2/src/theme/color-scheme-provider.tsx).
      // parseLightDark uses this to pick the matching arg from
      // \`light-dark(#a, #b)\` tokens before they reach mermaid /
      // khroma (zudolab/zudo-doc#1458).
      var theme = document.documentElement.getAttribute("data-theme");
      // Read a custom property, resolve through the temporary-element
      // round-trip to a hex color, and return undefined when the
      // property is unset on :root. mermaid.initialize crashes (khroma
      // "Unsupported color format: ''") if a theme variable is the
      // empty string, but tolerates undefined as "use the default" —
      // so unset host tokens fall back to mermaid's own theme palette.
      var v = function (name) {
        var raw = s.getPropertyValue(name).trim();
        if (!raw) return undefined;
        // light-dark() is parsed syntactically against the active
        // data-theme attribute — khroma 2.1.0 cannot parse the
        // function form (zudolab/zudo-doc#1458). Other CSS function
        // values (oklch(...), rgb(...), etc.) still go through the
        // temp-element resolveColor path below.
        var picked = parseLightDark(raw, theme);
        if (picked) {
          var resolvedPicked = resolveColor(picked);
          return resolvedPicked || undefined;
        }
        var resolved = resolveColor(raw);
        return resolved || undefined;
      };
      var bg = v("--zd-bg");
      // Leave luminance as NaN when --zd-bg is not yet on :root. The
      // Number.isNaN guard below maps NaN to darkMode:true, which is
      // mermaid's safer default — light text on dark fills survives
      // the page eventually flipping into dark mode without a
      // re-render, whereas the inverse produces unreadable diagrams
      // on dark backgrounds. The MutationObserver on the root style
      // attribute (registered further down) will reinit with real
      // luminance once ColorSchemeProvider populates the custom
      // properties.
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

  // Re-render mermaid when:
  //   * the color-tweak panel mutates :root[style] (custom properties), or
  //   * the theme-toggle flips :root[data-theme] between "light" / "dark"
  //     (zudolab/zudo-doc#1458 — diagram colors are baked into the rendered
  //     SVG, so we have to clear data-mermaid-rendered and re-run with
  //     the new theme's hex picks from parseLightDark).
  // Debounced so a synchronous flip of both attributes triggers a
  // single re-render.
  var tweakTimer;
  new MutationObserver(function () {
    clearTimeout(tweakTimer);
    tweakTimer = setTimeout(reinitMermaid, 300);
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "data-theme"],
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
