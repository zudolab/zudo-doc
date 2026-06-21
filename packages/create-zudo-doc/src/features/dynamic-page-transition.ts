import type { FeatureModule } from "../compose.js";

/**
 * Dynamic page transition feature.
 *
 * When enabled:
 * - Sets `enableClientRouter={settings.dynamicPageTransition}` on every
 *   `<DocLayoutWithDefaults>` render site — the SSR `<ClientRouter />` render
 *   self-activates the SPA router on the client as a top-level module side
 *   effect (primary activation path).
 * - Wires the ClientRouterBootstrap island and the PageLoadingOverlay (pure
 *   SSR) into body-end-islands — the island is now a redundant fallback;
 *   PageLoadingOverlay provides the loading spinner UI.
 * - Injects the View-Transitions CSS + page-loading overlay CSS into global.css.
 *
 * Bug fix (#2265): the page-loading overlay CSS (.page-loading-overlay /
 * .page-loading-spinner / @keyframes page-loading-spin / [data-zd-nav-pending])
 * was never reaching scaffolded projects because it lived unconditionally in
 * the host global.css but had no corresponding injection for the template.
 * Gating this feature makes both the JS island and the CSS land together.
 *
 * The ClientRouterBootstrap component lives in
 * templates/features/dynamicPageTransition/files/src/components/ and is
 * byte-identical to the host src/components/client-router-bootstrap.tsx.
 * The feature-template drift checker enforces this parity automatically.
 */
export const dynamicPageTransitionFeature: FeatureModule = () => ({
  name: "dynamicPageTransition",
  injections: [
    // 1. Import ClientRouterBootstrap and PageLoadingOverlay.
    //    Inserted AFTER the `// @slot:body-end-islands:imports` anchor.
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "// @slot:body-end-islands:imports",
      position: "after",
      content: `import ClientRouterBootstrap from "@/components/client-router-bootstrap";
import { PageLoadingOverlay } from "@takazudo/zudo-doc/page-loading";`,
    },
    // 2. Stable island marker name for ClientRouterBootstrap.
    //    Inserted AFTER the `// @slot:body-end-islands:display-names` anchor.
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "// @slot:body-end-islands:display-names",
      position: "after",
      content: `(ClientRouterBootstrap as { displayName?: string }).displayName =
  "ClientRouterBootstrap";`,
    },
    // 3. Gated island mount + PageLoadingOverlay.
    //    Inserted AFTER the `{/* @slot:body-end-islands:extra-islands */}` anchor.
    //    Gated on `settings.dynamicPageTransition` — mirrors the designTokenPanel
    //    and aiAssistant gating patterns in the same file.
    //    ClientRouterBootstrap: hydrates on "load" so the SPA-router click
    //    intercept is registered as soon as the islands runtime mounts the marker
    //    (zudolab/zudo-doc#1524 W7A fix). PageLoadingOverlay: pure SSR — the
    //    component emits its overlay div and the inline script that wires
    //    zfb:before-preparation / zfb:after-swap listeners at runtime.
    {
      file: "pages/lib/_body-end-islands.tsx",
      anchor: "{/* @slot:body-end-islands:extra-islands */}",
      position: "after",
      content: `      {settings.dynamicPageTransition ? (
        <>
          {/* Pure SSR — no Island wrap. The component emits its overlay div,
              inline styles, and a small inline script that self-wires
              zfb:before-preparation / zfb:after-swap listeners at runtime. */}
          <PageLoadingOverlay />
          {Island({
            when: "load",
            children: <ClientRouterBootstrap />,
          }) as unknown as VNode}
        </>
      ) : null}`,
    },
    // 4. View-Transitions CSS (chrome extraction + cross-fade + reduced motion).
    //    Injected AFTER `/* @slot:global-css:feature-styles */` in global.css.
    //    These rules are required for SPA page transitions via ClientRouter.
    {
      file: "src/styles/global.css",
      anchor: "/* @slot:global-css:feature-styles */",
      position: "after",
      content: `/* Root cross-fade for same-document View Transitions (Strategy B).
 *
 * @view-transition { navigation: auto; } (Strategy A, cross-document) is
 * deleted — Strategy B uses <ClientRouter /> which drives same-document
 * transitions via document.startViewTransition on each navigation.
 *
 * Chrome extraction via view-transition-name (Strategy B+, zudolab/zudo-doc#1558):
 * <header>, <aside id="desktop-sidebar">, <footer>, and the desktop-sidebar-toggle
 * button each carry a data-zfb-transition-persist attribute whose value is keyed
 * by locale and nav-section. The four attribute selectors below assign a stable
 * view-transition-name based on the attribute value prefix, extracting those
 * elements from the root snapshot into their own named layers:
 *   - header-{lang}          → zfb-header
 *   - sidebar-{locale}-…     → zfb-sidebar
 *   - footer-{lang}          → zfb-footer
 *   - desktop-sidebar-toggle → zfb-sidebar-toggle
 *
 * Once extracted, the root cross-fade animates only non-chrome content (main,
 * article, TOC, etc.). The twelve ::view-transition-{old,new,group}(<name>)
 * rules disable animation for all four chrome layers. The group pseudo must be
 * neutralised too — even when old/new are static the group container can still
 * produce a geometry-morph animation when snapshot size/position differs.
 *
 * Entry/exit cross-fade (zudolab/zudo-doc#2072): animation: none is only
 * correct when the chrome element exists on BOTH pages of a navigation.
 * When it exists on one side only (docs page with sidebar → top page
 * without), the named group holds a single snapshot — frozen at full
 * opacity for the whole transition, then dropped abruptly at finish. The
 * :only-child rules below detect that one-sided case and cross-fade the
 * lone snapshot in sync with the root content fade (spec-standard
 * entry/exit pattern; :only-child outranks the animation: none rules via
 * the extra pseudo-class specificity). */

/* Chrome extraction — assign view-transition-name from data-zfb-transition-persist */
[data-zfb-transition-persist^="header-"]               { view-transition-name: zfb-header; }
[data-zfb-transition-persist^="sidebar-"]              { view-transition-name: zfb-sidebar; }
[data-zfb-transition-persist^="footer-"]               { view-transition-name: zfb-footer; }
[data-zfb-transition-persist="desktop-sidebar-toggle"] { view-transition-name: zfb-sidebar-toggle; }

/* Disable animation for all four chrome layers (old, new, and group) */
::view-transition-old(zfb-header),
::view-transition-new(zfb-header),
::view-transition-group(zfb-header),
::view-transition-old(zfb-sidebar),
::view-transition-new(zfb-sidebar),
::view-transition-group(zfb-sidebar),
::view-transition-old(zfb-footer),
::view-transition-new(zfb-footer),
::view-transition-group(zfb-footer),
::view-transition-old(zfb-sidebar-toggle),
::view-transition-new(zfb-sidebar-toggle),
::view-transition-group(zfb-sidebar-toggle) { animation: none; }

/* Entry/exit: chrome element present on one side only (#2072).
 * Exit — lone old snapshot fades out with the content cross-fade. */
::view-transition-old(zfb-header):only-child,
::view-transition-old(zfb-sidebar):only-child,
::view-transition-old(zfb-footer):only-child,
::view-transition-old(zfb-sidebar-toggle):only-child {
  animation: 150ms ease-in both contentFadeOut;
}
/* Entry — lone new snapshot fades in with the content cross-fade. */
::view-transition-new(zfb-header):only-child,
::view-transition-new(zfb-sidebar):only-child,
::view-transition-new(zfb-footer):only-child,
::view-transition-new(zfb-sidebar-toggle):only-child {
  animation: 300ms ease-out both contentFadeIn;
}

/* Root cross-fade rules — animate only the non-chrome snapshot */
::view-transition-old(root) {
  animation: 150ms ease-in both contentFadeOut;
}
::view-transition-new(root) {
  animation: 300ms ease-out both contentFadeIn;
}

/* Reduced motion: collapse all view-transition animation to an instant
 * swap (zudolab/zudo-doc#2086). With every snapshot animation at none the
 * transition settles immediately — no cross-fade, no translateY slide.
 * Covers the root cross-fade and the #2072 :only-child entry/exit rules;
 * the both-sides chrome layers are already animation: none above. Equal
 * specificity per selector, but later in source order, so these win.
 * ::view-transition-group(root) must be neutralized too (zudolab/zzmod#845):
 * the UA animates the root group for its full duration even when the old/new
 * root snapshots are at animation: none, leaving a brief frozen,
 * non-interactive frame. The chrome groups are already animation: none in the
 * unconditional chrome block above, so only the root group is added here. */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root),
  ::view-transition-group(root),
  ::view-transition-old(zfb-header):only-child,
  ::view-transition-old(zfb-sidebar):only-child,
  ::view-transition-old(zfb-footer):only-child,
  ::view-transition-old(zfb-sidebar-toggle):only-child,
  ::view-transition-new(zfb-header):only-child,
  ::view-transition-new(zfb-sidebar):only-child,
  ::view-transition-new(zfb-footer):only-child,
  ::view-transition-new(zfb-sidebar-toggle):only-child {
    animation: none;
  }
}

/* Page-loading overlay CSS — moved out of PageLoadingOverlay's inline
 * <style> block to avoid the <style>-inside-<body> HTML5 content-model
 * violation flagged by html-validate (same pattern as version-switcher
 * fix in zudolab/zudo-doc#1505; see W2A confirm zudolab/zudo-doc#1543). */
.page-loading-overlay {
  position: fixed;
  inset: 0;
  /* Full-screen blocking load overlay — modal tier (was a raw z-index:9999).
     It sits below the transient \`drag\` tier (sidebar-resizer ghost), which is
     fine: a full page-load overlay and an active pointer-drag never coexist. */
  z-index: var(--z-index-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--color-overlay) 60%, transparent);
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease-out;
}

.page-loading-overlay[data-visible] {
  opacity: 1;
}

a[data-zd-nav-pending],
button[data-zd-nav-pending] {
  color: var(--color-accent);
}

.page-loading-spinner {
  width: 48px;
  height: 48px;
  border: 5px solid var(--color-fg, #fff);
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: page-loading-spin 1s linear infinite;
}

@media (min-width: 1024px) {
  .page-loading-spinner {
    width: 64px;
    height: 64px;
    border-width: 6px;
  }
}

@keyframes page-loading-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .page-loading-spinner {
    animation: none;
    border-bottom-color: var(--color-fg, #fff);
    opacity: 0.5;
  }
}`,
    },
  ],
});
