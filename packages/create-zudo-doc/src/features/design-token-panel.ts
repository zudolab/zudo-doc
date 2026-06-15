import type { FeatureModule } from "../compose.js";

/**
 * Pre-hydration toggle shim for the zdtp panel (inline, minified).
 *
 * Emitted as a <script dangerouslySetInnerHTML> alongside the
 * DesignTokenPanelBootstrap Island so the header palette button is
 * responsive before the island hydrates. Records the first click as a
 * boolean flag and exposes window.__zdtpReadyClicks so the bootstrap
 * module can drain and re-dispatch once the real zdtp listener is live.
 * Guards against double-installation across SPA body swaps via
 * __zdtpToggleShimInstalled. Mirrors the host's ZDTP_TOGGLE_SHIM_SRC
 * constant (pages/lib/_body-end-islands.tsx, zudolab/zudo-doc#1627 Part B).
 */
const ZDTP_TOGGLE_SHIM_SRC = `(function(){
if(window.__zdtpToggleShimInstalled)return;
window.__zdtpToggleShimInstalled=true;
var pending=false;
function shim(){pending=true;}
window.addEventListener('toggle-design-token-panel',shim);
window.__zdtpReadyClicks=function(){
window.removeEventListener('toggle-design-token-panel',shim);
delete window.__zdtpReadyClicks;
if(pending){pending=false;window.dispatchEvent(new CustomEvent('toggle-design-token-panel'));}
};
})();`;

/**
 * Design-token-panel (zdtp) feature.
 *
 * Injects:
 * 1. The zdtp CSS @import at `@slot:global-css:feature-styles` in
 *    `src/styles/global.css`.
 * 2. The DesignTokenPanelBootstrap import, displayName, and Island mount
 *    (with pre-hydration toggle shim) into
 *    `pages/lib/_body-end-islands.tsx` via the three @slot: anchors
 *    (imports / display-names / extra-islands). Mirrors the tauri feature
 *    injection shape (zudolab/zudo-doc#2162).
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
    // 1. Import the island entry. Inserted AFTER the
    //    `// @slot:body-end-islands:imports` anchor.
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "// @slot:body-end-islands:imports",
      position: "after",
      content: `import DesignTokenPanelBootstrap from "@/components/design-token-panel-bootstrap";`,
    },
    // 2. Stable island marker name (belt-and-braces guard matching the
    //    sibling islands in the file). Inserted AFTER the
    //    `// @slot:body-end-islands:display-names` anchor.
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "// @slot:body-end-islands:display-names",
      position: "after",
      content: `(DesignTokenPanelBootstrap as { displayName?: string }).displayName = "DesignTokenPanelBootstrap";`,
    },
    // 4. Extend HeaderRightTriggerName with "design-token-panel". Uses
    //    replace-range between the :start/:end anchors in settings-types.ts
    //    so the base template emits only "ai-chat" and this injection adds
    //    the zdtp trigger only when the feature is on (zudolab/zudo-doc#2162).
    {
      file: "src/config/settings-types.ts",
      anchor: "// @slot:settings-types:trigger-names:start",
      position: "replace",
      content: `export type HeaderRightTriggerName = "design-token-panel" | "ai-chat";`,
    },
    // 3. Island mount + pre-hydration toggle shim. Inserted AFTER the
    //    `{/* @slot:body-end-islands:extra-islands */}` anchor.
    //    when="load" (not "idle"): the bootstrap module registers the
    //    `toggle-design-token-panel` window listener as a side effect of
    //    its import, so it must hydrate as early as possible (zudolab/zudo-doc#1623).
    //    The inline <script> is the pre-hydration shim (zudolab/zudo-doc#1627 Part B).
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "{/* @slot:body-end-islands:extra-islands */}",
      position: "after",
      content: `      {/* zdtp panel bootstrap: hydrates on load so configurePanel() runs early
          and the toggle-design-token-panel listener is live before the user
          clicks the header trigger. The inline script is the pre-hydration
          shim that queues the first click (zudolab/zudo-doc#1627 Part B). */}
      <script
        dangerouslySetInnerHTML={{ __html: ${JSON.stringify(ZDTP_TOGGLE_SHIM_SRC)} }}
      />
      {Island({
        when: "load",
        children: <DesignTokenPanelBootstrap />,
      }) as unknown as VNode}`,
    },
  ],
});
