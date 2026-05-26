import type { FeatureModule } from "../compose.js";

/**
 * Design-token-panel (zdtp) feature.
 *
 * Injects the zdtp CSS @import at `@slot:global-css:feature-styles` in
 * `src/styles/global.css`. The bootstrap is loaded by
 * `pages/lib/design-token-panel-bootstrap` as a side effect when the
 * feature is enabled, and the header trigger is rendered by
 * `pages/lib/_header-with-defaults.tsx` from the `settings.headerRightItems`
 * entry `{ type: "trigger", trigger: "design-token-panel" }`.
 */
export const designTokenPanelFeature: FeatureModule = () => ({
  name: "designTokenPanel",
  injections: [
    {
      // Panel chrome CSS — imported here so the rules land in the main page
      // CSS bundle (not a deferred chunk), ensuring the panel renders
      // correctly on first click. Vite library mode strips the source CSS
      // import from the emitted JS, so this CSS-side import is the required
      // pull point. See @takazudo/zdtp PORTABLE-CONTRACT.md §7.
      file: "src/styles/global.css",
      anchor: "/* @slot:global-css:feature-styles */",
      content: `@import "@takazudo/zdtp/styles.css";`,
    },
  ],
});
