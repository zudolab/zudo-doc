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
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { deriveBodyEndIslands } from "../chrome/derive.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

/** Settings subset read by the DocBodyEnd factory. */
export interface DocBodyEndSettings {
  base?: string | null;
  sidebarResizer: boolean;
}

/**
 * Create a `DocBodyEnd` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads `settings` directly; the `BodyEndIslands` block is a HOST-bound slot
 * (`ctx.hostBindings.BodyEndIslands`) that defaults to the package-island subset
 * reconstructed from `settings` (no host-only client-router / token-panel boots).
 */
export function createDocBodyEnd<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): () => JSX.Element {
  assertChromeContext(ctx, "createDocBodyEnd");
  const settings = ctx.settings as unknown as DocBodyEndSettings;
  const BodyEndIslands = deriveBodyEndIslands(ctx) as (props: {
    basePath: string;
  }) => JSX.Element;

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
