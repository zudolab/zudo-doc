/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-body-end — factory for the shared bodyEndComponents block (epic #2344, S7).
//
// The host's `pages/lib/_doc-body-end.tsx` previously read
// `settings.base` and `settings.sidebarResizer` at module scope. This factory
// receives those via injected dependencies so the logic lives in the package
// while the host stub keeps the singleton imports.
//
// BodyEndIslands and SidebarResizerInit remain host-injected (BodyEndIslands
// reads `settings.dynamicPageTransition`, `settings.aiAssistant`,
// `settings.imageEnlarge` etc. — it is itself a host-side component that
// the doc-page-shell factory already accepts as a slot).

import type { JSX } from "preact";
import { SidebarResizerInit } from "../sidebar-resizer/index.js";

/** Settings subset read by the DocBodyEnd factory. */
export interface DocBodyEndSettings {
  base?: string | null;
  sidebarResizer: boolean;
}

/** Dependencies injected by the host stub. */
export interface DocBodyEndDeps {
  settings: DocBodyEndSettings;
  /** The `BodyEndIslands` component (host-side — reads additional settings). */
  BodyEndIslands: (props: { basePath: string }) => JSX.Element;
}

/**
 * Create a `DocBodyEnd` component bound to the host's settings and
 * BodyEndIslands component.
 */
export function createDocBodyEnd(
  deps: DocBodyEndDeps,
): () => JSX.Element {
  const { settings, BodyEndIslands } = deps;

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
  function DocBodyEnd(): JSX.Element {
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

  return DocBodyEnd;
}
