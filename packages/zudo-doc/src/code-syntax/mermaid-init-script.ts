// Browser init script for mermaid diagram rendering.
//
// Converted from the TypeScript <script> block in
// the legacy `mermaid-init` component — TypeScript syntax stripped
// so the string can be emitted via `dangerouslySetInnerHTML` and parsed
// by the browser directly.
//
// Wrapped in an IIFE to avoid polluting the global scope.
// Kept in a separate module so future edits can be reviewed in isolation.
//
// Lifecycle vocabulary: the page-navigate-end hook reads
// `AFTER_NAVIGATE_EVENT` from `transitions/page-events.ts` rather than
// a hard-coded `astro:*` literal — see that module's header for the
// full vocabulary rationale (zudolab/zudo-doc#1335 E2 task 2 half B
// introduced the constant; zudolab/zudo-doc#1523 flipped it from the
// browser-standard `DOMContentLoaded` to zfb's Strategy B SPA event
// `zfb:after-swap`).
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
export const MERMAID_CDN_MODULE_URL = "https://esm.sh/mermaid@11.15.0";

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
   * #hex-dark)\` when colorMode is configured, and may be
   * \`light-dark(oklch(...), oklch(...))\` after the OKLCH migration
   * (zudolab/zudo-doc#2474). \`getPropertyValue\` returns the literal string.
   *
   * Uses a paren-balance-aware splitter instead of a regex so that nested
   * function calls (\`oklch()\`, \`color(srgb ...)\`, \`rgb()\`) inside each
   * arm do not confuse the top-level comma separator.
   *
   * Returns the picked value (may be hex, oklch, rgb, etc.) on success,
   * or \`null\` if the input is not a \`light-dark(...)\` value. Caller
   * passes the result to \`resolveColor\`. When the theme attribute is
   * missing — first paint before the color-scheme bootstrap runs, or
   * a host that does not configure colorMode — returns the light arg
   * as a deterministic default.
   */
  function parseLightDark(raw, theme) {
    if (!raw) return null;
    var s = raw.replace(/^\\s+|\\s+$/g, "");
    var prefix = "light-dark(";
    if (s.indexOf(prefix) !== 0) return null;
    if (s.charAt(s.length - 1) !== ")") return null;
    var inner = s.slice(prefix.length, s.length - 1);
    var depth = 0;
    var splitIdx = -1;
    for (var i = 0; i < inner.length; i++) {
      var ch = inner.charAt(i);
      if (ch === "(") { depth++; }
      else if (ch === ")") { depth--; }
      else if (ch === "," && depth === 0) { splitIdx = i; break; }
    }
    if (splitIdx === -1) return null;
    var light = inner.slice(0, splitIdx).replace(/^\\s+|\\s+$/g, "");
    var dark = inner.slice(splitIdx + 1).replace(/^\\s+|\\s+$/g, "");
    if (!light || !dark) return null;
    return theme === "dark" ? dark : light;
  }

  /**
   * Resolve a CSS value to a hex color (#rrggbb).
   * CSS custom properties return raw values from getComputedStyle (e.g.
   * "light-dark(#fff, #000)") which mermaid cannot parse. This uses a
   * temporary element so the browser resolves any CSS function to a
   * concrete color, then converts it to hex.
   *
   * After the OKLCH migration (zudolab/zudo-doc#2474) the browser may
   * serialize computed colors as \`oklch(...)\` or \`color(srgb ...)\`
   * instead of \`rgb()\`. When the resolved value is not rgb/rgba,
   * this function falls back to a 1x1 canvas paint-and-read so the
   * browser converts the wide-gamut value to sRGB bytes — no library
   * dependency needed.
   *
   * \`light-dark(...)\` is handled syntactically in \`parseLightDark\`
   * above (zudolab/zudo-doc#1458) — this function receives already-picked
   * arms or raw non-light-dark values.
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
    // Fast path: rgb() / rgba() — browser serialised the color in sRGB.
    var m = resolved.match(/^rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (m) {
      return "#" + [m[1], m[2], m[3]].map(function (n) { return Number(n).toString(16).padStart(2, "0"); }).join("");
    }
    // Wide-gamut fallback: browser serialised oklch()/color(srgb ...) for
    // a wide-gamut CSS value. Paint onto a 1×1 canvas so the browser
    // converts to sRGB for us, then read back the RGBA bytes (zudolab/zudo-doc#2474).
    if (resolved) {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        var ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = resolved;
          ctx.fillRect(0, 0, 1, 1);
          var data = ctx.getImageData(0, 0, 1, 1).data;
          return "#" + [data[0], data[1], data[2]].map(function (n) { return n.toString(16).padStart(2, "0"); }).join("");
        }
      } catch (e) {}
    }
    return value;
  }

  // The --zd-* tokens the value-reader v() consumes. The observer gate
  // snapshots their RESOLVED computed values so a :root[style] mutation
  // that touches none of them correctly no-ops, while one that changes a
  // tracked token (or data-theme) re-renders (zudolab/zudo-doc#2181).
  var TRACKED_TOKENS = [
    "--zd-bg",
    "--zd-mermaid-node-bg",
    "--zd-mermaid-text",
    "--zd-mermaid-line",
    "--zd-mermaid-note-bg",
    "--zd-mermaid-label-bg",
  ];

  /**
   * Snapshot the active theme state: the data-theme attribute plus the
   * RESOLVED computed value of every tracked token. getComputedStyle is
   * read fresh (not the raw style-attribute string) so an unrelated
   * :root[style] change does not look like a token change, and a real
   * token change is caught even when written indirectly.
   */
  function captureThemeState() {
    var cs = getComputedStyle(document.documentElement);
    var tokens = {};
    TRACKED_TOKENS.forEach(function (name) {
      tokens[name] = cs.getPropertyValue(name).trim();
    });
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      tokens: tokens,
    };
  }

  /**
   * Decide whether a genuine theme/token change occurred between two
   * snapshots. Treats an empty/undefined -> real-value transition as a
   * change: --zd-bg may be UNSET at first paint (luminance NaN); the
   * observer is exactly what reinits once ColorSchemeProvider later
   * populates the tokens, so that first colorization MUST still fire
   * (zudolab/zudo-doc#2181).
   */
  function hasThemeStateChanged(prev, next) {
    if (!prev) return true;
    if (prev.theme !== next.theme) return true;
    for (var i = 0; i < TRACKED_TOKENS.length; i++) {
      var name = TRACKED_TOKENS[i];
      if (prev.tokens[name] !== next.tokens[name]) return true;
    }
    return false;
  }

  /**
   * zfb 0.1.0-next.78's HTML minifier collapses text inside
   * <div data-mermaid>, but Mermaid's DSL uses line/statement boundaries
   * as syntax. Only repair single-line sources; already-multiline source
   * keeps its authored layout.
   */
  function normalizeCollapsedMermaidSource(raw) {
    var source = (raw || "").replace(/\\r\\n?/g, "\\n");
    if (source.indexOf("\\n") !== -1) return source;
    source = source.replace(/^\\s+|\\s+$/g, "").replace(/\\s+/g, " ");
    if (!source) return source;

    var out = source
      .replace(/^(graph|flowchart)\\s+(TB|TD|BT|RL|LR)\\s+/i, "$1 $2\\n")
      .replace(/^(sequenceDiagram|stateDiagram(?:-v2)?|classDiagram|erDiagram|journey|gantt|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram)\\s+/i, "$1\\n");

    if (/^(graph|flowchart)\\b/i.test(out)) {
      out = out
        .replace(/\\bend\\s+subgraph\\b/gi, "end;\\nsubgraph")
        .replace(/\\bsubgraph\\s+([A-Za-z0-9_-]+)\\s+(?=(?:[A-Za-z0-9_][\\w-]*|\\[\\*\\])[\\[{(]?)/gi, "subgraph $1;\\n")
        .replace(/([\\]\\)\\}])\\s+\\bend\\b/gi, "$1;\\nend")
        .replace(/\\bend\\s+((?:[A-Za-z0-9_][\\w-]*|\\[\\*\\])\\s*(?:[-=.xo<~]+|--?>))/gi, "end;\\n$1")
        .replace(/([\\]\\)\\}])\\s+((?:[A-Za-z0-9_][\\w-]*|\\[\\*\\])\\s*(?:[-=.xo<~]+|--?>))/g, "$1;\\n$2");
    } else if (/^sequenceDiagram\\b/i.test(out)) {
      out = out
        .replace(/\\s+(create\\s+(?:participant|actor)|participant|actor)\\s+/gi, ";\\n$1 ")
        .replace(/\\s+([A-Za-z][\\w.-]*\\s*(?:-+>>\\+?|-+>\\+?|-+\\)\\+?|-+x\\+?))/g, ";\\n$1")
        .replace(/\\s+(Note\\s+(?:left|right|over)\\s+of\\s+)/gi, ";\\n$1")
        .replace(/\\s+(loop|alt|else|opt|par|and|rect|critical|break|end)\\b/gi, ";\\n$1");
    } else if (/^stateDiagram(?:-v2)?\\b/i.test(out)) {
      out = out.replace(
        /([A-Za-z0-9_*\\]\\)\\}])\\s+((?:\\[\\*\\]|[A-Za-z0-9_][\\w-]*)\\s*--?>)/g,
        "$1;\\n$2",
      );
    }

    return out
      .replace(/\\n\\s*;\\s*\\n/g, "\\n")
      .replace(/^(sequenceDiagram|stateDiagram(?:-v2)?);\\n/i, "$1\\n")
      .replace(/;{2,}/g, ";")
      .replace(/^\\s+|\\s+$/g, "");
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
      // packages/zudo-doc/src/theme/color-scheme-provider.tsx).
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
      // Cache each diagram's source BEFORE mermaid.run consumes it
      // (mermaid replaces the graph text with the rendered <svg> and
      // sets data-processed). Use textContent — the DECODED source
      // mermaid consumes — NOT innerHTML, which would re-encode/decode
      // entities and corrupt diagrams containing \`-->\` arrows or \`&\`.
      // Only set when absent so repeated reinits keep the ORIGINAL
      // source (zudolab/zudo-doc#2181).
      els.forEach(function (el) {
        var source = normalizeCollapsedMermaidSource(el.textContent);
        el.textContent = source;
        if (!el.hasAttribute("data-mermaid-src")) {
          el.setAttribute("data-mermaid-src", source);
        }
      });
      await mermaid.run({ nodes: Array.from(els) });
      els.forEach(function (el) { el.setAttribute("data-mermaid-rendered", ""); });
    } catch (e) {
      console.error("[mermaid-init] Failed to render mermaid diagrams:", e);
    }
  }

  /**
   * Re-render all mermaid diagrams from their cached source text.
   *
   * By the time this runs, mermaid.run has already CONSUMED the source
   * (replaced the graph text with the rendered <svg> and set
   * data-processed), so clearing data-mermaid-rendered alone leaves the
   * node permanently blank — initMermaid re-selects it but mermaid.run
   * skips nodes that still have data-processed, and there is no source
   * left to regenerate from. Restore the cached source, drop the SVG,
   * and remove BOTH data-processed AND data-mermaid-rendered so the next
   * initMermaid pass regenerates cleanly. Keep data-mermaid-src so
   * repeated theme toggles keep working (zudolab/zudo-doc#2181).
   */
  function reinitMermaid() {
    document.querySelectorAll("[data-mermaid-rendered]").forEach(function (el) {
      var src = el.getAttribute("data-mermaid-src");
      if (src !== null) el.textContent = src;
      var svg = el.querySelector("svg");
      if (svg) svg.remove();
      el.removeAttribute("data-processed");
      el.removeAttribute("data-mermaid-rendered");
    });
    // Refresh the theme snapshot now that the genuine change is applied,
    // so the observer's gate measures the NEXT change against this state.
    lastThemeState = captureThemeState();
    initMermaid();
  }

  // First-paint render — under zfb's Strategy B SPA navigation,
  // AFTER_NAVIGATE_EVENT (zfb:after-swap) does NOT fire on the initial
  // page load (only post-swap), so we have to invoke initMermaid()
  // synchronously at script-evaluation time to render diagrams on the
  // landing page. The listener below covers the re-render path for
  // every subsequent SPA hop. zudolab/zudo-doc#1523.
  initMermaid();
  document.addEventListener(${JSON.stringify(AFTER_NAVIGATE_EVENT)}, function () { initMermaid(); });

  // Re-render mermaid when:
  //   * the color-tweak panel mutates :root[style] (custom properties), or
  //   * the theme-toggle flips :root[data-theme] between "light" / "dark"
  //     (zudolab/zudo-doc#1458 — diagram colors are baked into the rendered
  //     SVG, so we have to clear data-mermaid-rendered and re-run with
  //     the new theme's hex picks from parseLightDark).
  // Debounced so a synchronous flip of both attributes triggers a
  // single re-render.
  //
  // zudolab/zudo-doc#2181: gate on a REAL theme/token change. zfb-runtime's
  // client router (swapRootAttributes) removes+re-adds ALL :root attributes
  // on every soft navigation, so unchanged data-theme/style still fire
  // mutations — without this gate the observer reinits ~300ms after every
  // nav and (combined with the old destructive reinit) blanks every
  // diagram. New diagrams reached by soft-nav are already handled by the
  // AFTER_NAVIGATE_EVENT -> initMermaid() listener above, so the observer
  // only needs to fire for genuine theme/token changes.
  //
  // Seed the snapshot at script-eval time — BEFORE ColorSchemeProvider
  // runs, so the tokens are likely empty. hasThemeStateChanged treats
  // empty -> real as a change, so the first legitimate colorization still
  // fires; reinitMermaid then refreshes the snapshot.
  var lastThemeState = captureThemeState();
  var tweakTimer;
  new MutationObserver(function () {
    var next = captureThemeState();
    if (!hasThemeStateChanged(lastThemeState, next)) return;
    lastThemeState = next;
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
