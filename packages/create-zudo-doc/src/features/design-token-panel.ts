import type { FeatureModule } from "../compose.js";

export const designTokenPanelFeature: FeatureModule = () => ({
  name: "designTokenPanel",
  injections: [
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "// @slot:doc-layout:imports",
      content: `import DesignTokenTweakPanel from "@/components/design-token-tweak";
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "@/config/color-scheme-utils";`,
    },
    {
      // Inline tweak-state script: uses JSX dangerouslySetInnerHTML +
      // template-literal interpolation so the server-side values of
      // SEMANTIC_DEFAULTS and SEMANTIC_CSS_NAMES are embedded into the
      // HTML output at SSR time (same effect as Astro's define:vars).
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:head-scripts -->",
      content: `    {(settings.designTokenPanel || settings.colorTweakPanel) && (
      <script dangerouslySetInnerHTML={{ __html: \`(function () {
  var tweakSemanticDefaults = \${JSON.stringify(SEMANTIC_DEFAULTS)};
  var tweakSemanticCss = \${JSON.stringify(SEMANTIC_CSS_NAMES)};
  var V1_KEY = "zudo-doc-tweak-state";
  var V2_KEY = "zudo-doc-tweak-state-v2";
  function readColorState() {
    var rawV2 = null;
    try { rawV2 = localStorage.getItem(V2_KEY); } catch (e) {}
    if (rawV2) {
      try {
        var parsed = JSON.parse(rawV2);
        if (parsed && parsed.color) return parsed.color;
      } catch (e) {}
    }
    var rawV1 = null;
    try { rawV1 = localStorage.getItem(V1_KEY); } catch (e) {}
    if (rawV1) {
      try { return JSON.parse(rawV1); } catch (e) {}
    }
    return null;
  }
  function applyTweakState() {
    var s = readColorState();
    if (!s || !s.palette || s.palette.length !== 16 || s.background === undefined) return;
    var root = document.documentElement;
    for (var i = 0; i < 16; i++) root.style.setProperty("--zd-" + i, s.palette[i]);
    root.style.setProperty("--zd-bg", s.palette[s.background]);
    root.style.setProperty("--zd-fg", s.palette[s.foreground]);
    root.style.setProperty("--zd-cursor", s.palette[s.cursor]);
    root.style.setProperty("--zd-sel-bg", s.palette[s.selectionBg]);
    root.style.setProperty("--zd-sel-fg", s.palette[s.selectionFg]);
    for (var key in tweakSemanticCss) {
      var m = s.semanticMappings && s.semanticMappings[key];
      if (m === undefined) m = tweakSemanticDefaults[key];
      var val = m === "bg" ? s.palette[s.background] : m === "fg" ? s.palette[s.foreground] : s.palette[m];
      root.style.setProperty(tweakSemanticCss[key], val);
    }
  }
  applyTweakState();
})();\` }} />
    )}`,
      position: "after",
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:body-end-components -->",
      content:
        '    {(settings.designTokenPanel || settings.colorTweakPanel) && <Island when="load"><DesignTokenTweakPanel /></Island>}',
      position: "after",
    },
    {
      file: "src/components/header.astro",
      anchor: "<!-- @slot:header:actions-start -->",
      content: `    {
      (settings.designTokenPanel || settings.colorTweakPanel) && (
        <button
          id="design-token-trigger"
          type="button"
          class="flex items-center justify-center text-muted transition-colors hover:text-fg"
          aria-label="Toggle design token panel"
          onclick="window.dispatchEvent(new CustomEvent('toggle-design-token-panel'))"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="13.5" cy="6.5" r="2.5" />
            <circle cx="17.5" cy="10.5" r="2.5" />
            <circle cx="8.5" cy="7.5" r="2.5" />
            <circle cx="6.5" cy="12.5" r="2.5" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
        </button>
      )
    }`,
      position: "after",
    },
  ],
});
