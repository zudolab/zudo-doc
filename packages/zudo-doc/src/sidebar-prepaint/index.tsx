/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// sidebar-prepaint — factories for the sidebar-visibility feature (epic #2344, S5).
//
// This module owns TWO pieces of the desktop sidebar-toggle feature:
//
//   1. createSidebarVisibilityPrepaint — the pre-paint inline `<script>` that
//      restores the persisted "hidden" preference to `<html data-sidebar-hidden>`
//      BEFORE first paint. It is emitted into the page `<head>` (see
//      doc-page-shell's `head` slot) so it runs before the `<aside>` desktop
//      sidebar is parsed/painted. Body-end / afterSidebar placement is too late:
//      the browser can paint the expanded `<aside>` before an in-body script
//      runs, producing a hard-reload flash (zudolab/zudo-doc#2571). This mirrors
//      the sibling sidebar-RESIZER restore script, which is likewise hoisted
//      into `<head>` (SIDEBAR_RESIZER_RESTORE_SCRIPT in head-with-defaults).
//
//   2. createSidebarPrepaint — the `afterSidebar` slot content: the
//      `DesktopSidebarToggle` Island (the collapse/expand button). This stays in
//      the body because it is an interactive island, not a pre-paint script.
//
// Both factories receive the `sidebarToggle` setting value and gate on the same
// condition (`settings.sidebarToggle && !hideSidebar`) so the script and the
// toggle button always appear together on exactly the pages that show a
// collapsible sidebar. `DesktopSidebarToggle` is already a package-internal
// component (from `@takazudo/zudo-doc/desktop-sidebar-toggle-island`); the
// factories just need the setting value and the `Island` slot component so they
// never import `@/config/settings`.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import {
  DesktopSidebarToggle,
  SIDEBAR_STORAGE_KEY,
} from "../desktop-sidebar-toggle-island/index.js";

export interface SidebarPrepaintProps {
  /**
   * Mirrors the page's `hide_sidebar: true` frontmatter. When true the desktop
   * toggle is skipped — there is no visible sidebar for it to collapse.
   */
  hideSidebar?: boolean;
}

/** Settings subset read by the sidebar-prepaint factories. */
export interface SidebarPrepaintSettings {
  sidebarToggle?: boolean;
}

/**
 * Shared gate for BOTH sidebar-prepaint factories: the head pre-paint `<script>`
 * and the `afterSidebar` toggle Island must appear on exactly the same pages, so
 * they read the same predicate here rather than each inlining
 * `settings.sidebarToggle && !hideSidebar` (a one-sided edit could otherwise let
 * the script and the button desync — #2571).
 */
function sidebarPrepaintActive(
  settings: SidebarPrepaintSettings,
  hideSidebar?: boolean,
): boolean {
  return Boolean(settings.sidebarToggle) && !hideSidebar;
}

/**
 * Pre-paint inline script body: restore persisted sidebar visibility to
 * `<html data-sidebar-hidden>` before first paint to avoid a hard-reload flash.
 *
 * A tiny synchronous IIFE that reads `localStorage[SIDEBAR_STORAGE_KEY]` and
 * sets `data-sidebar-hidden` only when the stored value is exactly "false"
 * (the collapsed preference) — the default (visible) needs no attribute and
 * causes no layout shift. Silently no-ops in privacy / disabled-storage modes.
 *
 * The storage key is interpolated from `SIDEBAR_STORAGE_KEY` so it stays in
 * sync with the island's reader; the `data-sidebar-hidden` attribute name is a
 * literal here (the island's `setDataAttribute` hardcodes the same literal —
 * keep the two in sync). Intended for `<head>` placement so it executes before
 * the `<aside>` sidebar is painted.
 */
export const SIDEBAR_VISIBILITY_PREPAINT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  SIDEBAR_STORAGE_KEY,
)})==='false'){document.documentElement.setAttribute('data-sidebar-hidden','');}}catch(e){}})();`;

/**
 * Create a `SidebarVisibilityPrepaint` component bound to the host's settings.
 *
 * Returns the pre-paint `<script>` (for the page `<head>`) when
 * `settings.sidebarToggle` is enabled AND the page actually shows a sidebar;
 * returns `undefined` when the toggle is disabled or the page hides the sidebar
 * — the SAME gating as {@link createSidebarPrepaint}, so the head script and
 * the afterSidebar toggle button always appear together.
 */
export function createSidebarVisibilityPrepaint(
  settings: SidebarPrepaintSettings,
): (props: SidebarPrepaintProps) => JSX.Element | undefined {
  function SidebarVisibilityPrepaint({
    hideSidebar,
  }: SidebarPrepaintProps): JSX.Element | undefined {
    if (!sidebarPrepaintActive(settings, hideSidebar)) return undefined;

    return (
      <script
        dangerouslySetInnerHTML={{ __html: SIDEBAR_VISIBILITY_PREPAINT_SCRIPT }}
      />
    );
  }

  return SidebarVisibilityPrepaint;
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
   * Returns the `DesktopSidebarToggle` Island when `settings.sidebarToggle` is
   * enabled AND the page actually shows a sidebar; returns `undefined` when the
   * toggle is disabled or the page hides the sidebar. The pre-paint
   * visibility-restore `<script>` is NOT emitted here — it is hoisted into the
   * page `<head>` via {@link createSidebarVisibilityPrepaint} so it runs before
   * the `<aside>` paints (zudolab/zudo-doc#2571).
   */
  function SidebarPrepaint({
    hideSidebar,
  }: SidebarPrepaintProps): JSX.Element | undefined {
    if (!sidebarPrepaintActive(settings, hideSidebar)) return undefined;

    return (
      <>
        {Island({
          when: "load",
          children: <DesktopSidebarToggle />,
        }) as unknown as VNode}
      </>
    );
  }

  return SidebarPrepaint;
}
