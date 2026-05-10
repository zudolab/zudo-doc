import type { FeatureModule } from "../compose.js";

export const designTokenPanelFeature: FeatureModule = () => ({
  name: "designTokenPanel",
  injections: [
    {
      // Panel chrome CSS — imported here so the rules land in the main page
      // CSS bundle (not a deferred chunk), ensuring the panel renders
      // correctly on first click. Vite library mode strips the source CSS
      // import from the emitted JS, so this CSS-side import is the required
      // pull point. See @takazudo/zudo-design-token-panel PORTABLE-CONTRACT.md §7.
      file: "src/styles/global.css",
      anchor: "/* @slot:global-css:feature-styles */",
      content: `@import "@takazudo/zudo-design-token-panel/styles.css";`,
    },
    {
      // Bootstrap the zdtp panel as a side-effect dynamic import.
      // The import is gated on the feature flag so the zdtp bundle is excluded
      // from pages that disable the panel. No Island wrapper is needed — zdtp
      // mounts its own DOM when configurePanel() runs inside the bootstrap module.
      file: "src/layouts/doc-layout.astro",
      anchor: "// @slot:doc-layout:imports",
      content: `// Production bootstrap for @takazudo/zudo-design-token-panel (zdtp).
// Loaded as a side-effect when the feature flag is enabled.
if (settings.designTokenPanel || settings.colorTweakPanel) {
  void import("@/lib/design-token-panel-bootstrap");
}`,
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
