import type { FeatureModule } from "../compose.js";

export const colorTweakPanelFeature: FeatureModule = () => ({
  name: "colorTweakPanel",
  files: [
    "src/components/color-tweak-panel.tsx",
    "src/components/color-tweak-export-modal.tsx",
    "src/config/color-tweak-presets.ts",
    "src/utils/color-convert.ts",
    "src/utils/export-code.ts",
  ],
  injections: [
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "// @slot:doc-layout:imports",
      content: `import ColorTweakPanel from "@/components/color-tweak-panel";
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "@/config/color-scheme-utils";`,
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:head-scripts -->",
      content: `    {settings.colorTweakPanel && (
      <script is:inline define:vars={{ tweakSemanticDefaults: SEMANTIC_DEFAULTS, tweakSemanticCss: SEMANTIC_CSS_NAMES }}>
        (function () {
          function applyTweakState() {
            var raw = localStorage.getItem("zudo-doc-tweak-state");
            if (!raw) return;
            try {
              var s = JSON.parse(raw);
              if (!s.palette || s.palette.length !== 16 || s.background === undefined) return;
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
            } catch (e) { localStorage.removeItem("zudo-doc-tweak-state"); }
          }
          applyTweakState();
          document.addEventListener("astro:after-swap", applyTweakState);
        })();
      </script>
    )}`,
      position: "after",
    },
    {
      file: "src/layouts/doc-layout.astro",
      anchor: "<!-- @slot:doc-layout:body-end-components -->",
      content: '    {settings.colorTweakPanel && <ColorTweakPanel client:only="preact" />}',
      position: "after",
    },
    {
      file: "src/components/header.astro",
      anchor: "// @slot:header:imports",
      content: 'import { settings } from "@/config/settings";',
    },
    {
      file: "src/components/header.astro",
      anchor: "<!-- @slot:header:actions-start -->",
      content: `    {
      settings.colorTweakPanel && (
        <button
          id="color-tweak-trigger"
          type="button"
          class="flex items-center justify-center text-muted transition-colors hover:text-fg"
          aria-label="Open color tweak panel"
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
