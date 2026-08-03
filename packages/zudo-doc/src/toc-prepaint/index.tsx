/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// toc-prepaint — factories for the desktop TOC visibility feature (epic #3252, #3254).
//
// This module owns TWO pieces of the desktop TOC-toggle feature, mirroring
// sidebar-prepaint/index.tsx 1:1:
//
//   1. createTocVisibilityPrepaint — the pre-paint inline `<script>` that
//      restores the persisted "hidden" preference to `<html data-toc-hidden>`
//      BEFORE first paint. It is emitted into the page `<head>` (see
//      doc-page-shell's `head` slot) so it runs before the `.zd-toc-col`
//      wrapper is parsed/painted. Body-end / afterSidebar placement is too
//      late — the browser can paint the expanded TOC before an in-body
//      script runs, producing a hard-reload flash (mirrors zudolab/zudo-doc#2571).
//
//   2. createTocPrepaint — the `afterSidebar` slot content: the
//      `DesktopTocToggle` Island (the collapse/expand button). This stays in
//      the body because it is an interactive island, not a pre-paint script.
//
// Both factories receive `shouldRenderDefaultToc` (computed by the shell from
// `shouldRenderToc && !customTocIsPresent`) alongside the `tocToggle` setting
// value, and gate on the SAME shared predicate (`tocPrepaintActive`) so the
// script and the toggle button always appear together on exactly the pages
// that show the package's OWN default TOC — never on a page with a custom
// `hostBindings.Toc` override, since `data-toc-hidden` persists across SPA
// navigation and an unscoped script/button could collapse a custom Toc
// reached after hiding the default TOC elsewhere (the #2571 pattern, applied
// to the customTocIsPresent gate this feature adds on top of it).

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import {
  DesktopTocToggle,
  TOC_STORAGE_KEY,
} from "../desktop-toc-toggle-island/index.js";

export interface TocPrepaintProps {
  /**
   * Whether the page actually renders the package's own default TOC (i.e.
   * `shouldRenderToc && !customTocIsPresent`, computed by the shell). When
   * false there is no default TOC for the toggle to collapse — the shell
   * either has no TOC at all or renders a custom `hostBindings.Toc` override.
   */
  shouldRenderDefaultToc?: boolean;
}

/** Settings subset read by the toc-prepaint factories. */
export interface TocPrepaintSettings {
  tocToggle?: boolean;
}

/**
 * Shared gate for BOTH toc-prepaint factories: the head pre-paint `<script>`
 * and the `afterSidebar` toggle Island must appear on exactly the same pages,
 * so they read the same predicate here rather than each inlining
 * `settings.tocToggle && shouldRenderDefaultToc` (a one-sided edit could
 * otherwise let the script and the button desync — the #2571 pattern).
 *
 * The predicate cannot know whether a custom Toc exists on its own — the
 * shell computes `shouldRenderDefaultToc` and passes it in.
 */
export function tocPrepaintActive(
  settings: TocPrepaintSettings,
  shouldRenderDefaultToc?: boolean,
): boolean {
  return Boolean(settings.tocToggle) && Boolean(shouldRenderDefaultToc);
}

/**
 * Pre-paint inline script body: restore persisted TOC visibility to
 * `<html data-toc-hidden>` before first paint to avoid a hard-reload flash.
 *
 * A tiny synchronous IIFE that reads `localStorage[TOC_STORAGE_KEY]` and
 * sets `data-toc-hidden` only when the stored value is exactly "false"
 * (the collapsed preference) — the default (visible) needs no attribute and
 * causes no layout shift. Silently no-ops in privacy / disabled-storage modes.
 *
 * The storage key is interpolated from `TOC_STORAGE_KEY` so it stays in
 * sync with the island's reader; the `data-toc-hidden` attribute name is a
 * literal here (the island's `setDataAttribute` hardcodes the same literal —
 * keep the two in sync). Intended for `<head>` placement so it executes before
 * the `.zd-toc-col` TOC column is painted.
 */
export const TOC_VISIBILITY_PREPAINT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  TOC_STORAGE_KEY,
)})==='false'){document.documentElement.setAttribute('data-toc-hidden','');}}catch(e){}})();`;

/**
 * Create a `TocVisibilityPrepaint` component bound to the host's settings.
 *
 * Returns the pre-paint `<script>` (for the page `<head>`) when
 * `settings.tocToggle` is enabled AND the page actually renders the default
 * TOC; returns `undefined` otherwise — the SAME gating as
 * {@link createTocPrepaint}, so the head script and the afterSidebar toggle
 * button always appear together.
 */
export function createTocVisibilityPrepaint(
  settings: TocPrepaintSettings,
): (props: TocPrepaintProps) => JSX.Element | undefined {
  function TocVisibilityPrepaint({
    shouldRenderDefaultToc,
  }: TocPrepaintProps): JSX.Element | undefined {
    if (!tocPrepaintActive(settings, shouldRenderDefaultToc)) return undefined;

    return (
      <script
        dangerouslySetInnerHTML={{ __html: TOC_VISIBILITY_PREPAINT_SCRIPT }}
      />
    );
  }

  return TocVisibilityPrepaint;
}

/**
 * Create a `TocPrepaint` component bound to the host's settings.
 *
 * The host stub calls this once with `{ tocToggle: settings.tocToggle }`
 * and re-exports the result.
 */
export function createTocPrepaint(
  settings: TocPrepaintSettings,
): (props: TocPrepaintProps) => JSX.Element | undefined {
  /**
   * The `afterSidebar` slot content shared by all 4 doc-route page components.
   *
   * Returns the `DesktopTocToggle` Island when `settings.tocToggle` is
   * enabled AND the page actually renders the default TOC; returns
   * `undefined` otherwise. The pre-paint visibility-restore `<script>` is NOT
   * emitted here — it is hoisted into the page `<head>` via
   * {@link createTocVisibilityPrepaint} so it runs before the TOC column
   * paints (mirrors zudolab/zudo-doc#2571).
   */
  function TocPrepaint({
    shouldRenderDefaultToc,
  }: TocPrepaintProps): JSX.Element | undefined {
    if (!tocPrepaintActive(settings, shouldRenderDefaultToc)) return undefined;

    return (
      <>
        {Island({
          when: "load",
          children: <DesktopTocToggle />,
        }) as unknown as VNode}
      </>
    );
  }

  return TocPrepaint;
}
