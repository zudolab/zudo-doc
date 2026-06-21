/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared bodyEndComponents block for doc pages.
//
// Extracted from the four doc-route render bodies (pages/docs/[...slug].tsx,
// pages/[locale]/docs/[...slug].tsx, pages/v/[version]/docs/[...slug].tsx,
// pages/v/[version]/[locale]/docs/[...slug].tsx) where the block was
// duplicated verbatim across all four routes.
//
// Wraps BodyEndIslands + SidebarResizerInit (the latter conditional on
// settings.sidebarResizer) and forwards the basePath prop that
// BodyEndIslands requires for API URL construction.

import type { JSX } from "preact";
import { settings } from "@/config/settings";
import { BodyEndIslands } from "./_body-end-islands";
import { SidebarResizerInit } from "@takazudo/zudo-doc/sidebar-resizer";

/**
 * The `bodyEndComponents` slot content shared by all four doc-route page
 * components: `BodyEndIslands` (modal overlays, optional client-router
 * bootstrap when `dynamicPageTransition` is on, image-enlarge) and the
 * optional `SidebarResizerInit` drag handle. Whether the client-router
 * bootstrap island is included depends on `settings.dynamicPageTransition`
 * (gated inside `BodyEndIslands`). The SSR `<ClientRouter />` mounted by
 * `DocLayout` self-activates when `enableClientRouter` is `true`; the
 * island here is redundant for that activation path and kept only for the
 * `when="load"` hydration slot.
 */
export function DocBodyEnd(): JSX.Element {
  return (
    <>
      <BodyEndIslands basePath={settings.base ?? "/"} />
      {/* SidebarResizerInit: attach drag handle to #desktop-sidebar on load
          and on AFTER_NAVIGATE_EVENT (zfb:after-swap under the Strategy B
          SPA navigation model). Idempotent — safe on every page. */}
      {settings.sidebarResizer && <SidebarResizerInit />}
    </>
  );
}
