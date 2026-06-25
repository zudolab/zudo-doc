/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// sidebar-prepaint — factory for the afterSidebar slot (epic #2344, S5).
//
// The host's `pages/lib/_sidebar-prepaint.tsx` previously imported
// `settings` and `DesktopSidebarToggle` from the package. Moving this
// logic into the package allows the host stub to be a thin re-export.
//
// Note: `DesktopSidebarToggle` is already a package-internal component
// (from `@takazudo/zudo-doc/desktop-sidebar-toggle-island`). The factory
// just needs to receive the `sidebarToggle` setting value and the
// `Island` slot component so it never imports `@/config/settings`.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { DesktopSidebarToggle } from "../desktop-sidebar-toggle-island/index.js";

export interface SidebarPrepaintProps {
  /**
   * Mirrors the page's `hide_sidebar: true` frontmatter. When true the desktop
   * toggle is skipped — there is no visible sidebar for it to collapse.
   */
  hideSidebar?: boolean;
}

/** Settings subset read by {@link createSidebarPrepaint}. */
export interface SidebarPrepaintSettings {
  sidebarToggle?: boolean;
}

/**
 * Create a `SidebarPrepaint` component bound to the host's settings.
 *
 * The host stub calls this once with `{ sidebarToggle: settings.sidebarToggle }`
 * and re-exports the result.
 */
export function createSidebarPrepaint(
  settings: SidebarPrepaintSettings,
): (props: SidebarPrepaintProps) => JSX.Element | undefined {
  /**
   * The `afterSidebar` slot content shared by all 4 doc-route page components.
   *
   * Returns the pre-paint localStorage script + `DesktopSidebarToggle` Island
   * when `settings.sidebarToggle` is enabled AND the page actually shows a
   * sidebar; returns `undefined` when the toggle is disabled or the page hides
   * the sidebar.
   */
  function SidebarPrepaint({
    hideSidebar,
  }: SidebarPrepaintProps): JSX.Element | undefined {
    if (!settings.sidebarToggle || hideSidebar) return undefined;

    return (
      <>
        {/* Pre-paint inline script: restore persisted sidebar visibility to
            <html data-sidebar-hidden> before first paint to avoid flash.
            Rendered only when the toggle is enabled and the page shows a
            sidebar; the attribute is only set when localStorage says "false"
            so the default (visible) needs no attribute and causes no layout shift. */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{if(localStorage.getItem('zudo-doc-sidebar-visible')==='false'){document.documentElement.setAttribute('data-sidebar-hidden','');}}catch(e){}})();`,
        }} />
        {Island({
          when: "load",
          children: <DesktopSidebarToggle />,
        }) as unknown as VNode}
      </>
    );
  }

  return SidebarPrepaint;
}
