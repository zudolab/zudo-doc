"use client";

import { useState, useEffect, useRef } from 'preact/hooks';
import { BEFORE_NAVIGATE_EVENT, AFTER_NAVIGATE_EVENT } from '@takazudo/zudo-doc/transitions';

export const SIDEBAR_STORAGE_KEY = 'zudo-doc-sidebar-visible';

function readState(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function setDataAttribute(isVisible: boolean) {
  if (isVisible) {
    document.documentElement.removeAttribute('data-sidebar-hidden');
  } else {
    document.documentElement.setAttribute('data-sidebar-hidden', '');
  }
}

export default function DesktopSidebarToggle() {
  // Initial state must match server render (always `true`) to avoid a
  // hydration mismatch when the persisted preference is "hidden". The
  // doc-layout's pre-paint inline script applies `data-sidebar-hidden`
  // to <html> from localStorage *before* this island mounts, so the
  // visual state stays correct; we only need to sync this island's
  // React state to the persisted preference after hydration. Same
  // pattern as packages/zudo-doc/src/theme-toggle/index.tsx (commit 9aebd8e).
  const [visible, setVisible] = useState<boolean>(true);
  // Tracks whether the hydration sync (below) has run. The persistence
  // effect below skips the very first mount so we don't overwrite the
  // user's persisted "hidden" preference with the SSR-safe default
  // `true` before the hydration sync gets a chance to fire.
  const hydrated = useRef(false);

  // Persist state changes to localStorage and the <html> data-attribute.
  // The `hydrated.current` guard is the real protection: it is still
  // `false` on the very first effect run (the hydration-sync effect
  // below sets it to `true` only after this one fires, since effects
  // run in declaration order on mount), so the first run bails out
  // and we don't clobber the user's persisted "hidden" preference
  // with the SSR-safe default `true`.
  useEffect(() => {
    if (!hydrated.current) return;
    setDataAttribute(visible);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(visible));
    } catch {
      // ignore storage errors
    }
  }, [visible]);

  // After mount, read the persisted preference and reconcile state
  // with the SSR default. Sets the ref so subsequent runs of the
  // persistence effect above start syncing normally.
  useEffect(() => {
    hydrated.current = true;
    const actual = readState();
    if (actual !== visible) {
      setVisible(actual);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply data-sidebar-hidden to <html> after every SPA nav.
  // zfb's swapRootAttributes wipes all non-preserved <html> attributes on
  // each navigation (data-sidebar-hidden is not in NON_OVERRIDABLE_ZFB_ATTRS),
  // and the pre-paint inline script does not re-run on SPA nav. Since this
  // island is persisted (data-zfb-transition-persist), this listener stays
  // registered across SPA swaps.
  //
  // Strategy: capture the attribute presence just before the swap
  // (BEFORE_NAVIGATE_EVENT fires before swapRootAttributes runs), then
  // restore it once the swap completes (AFTER_NAVIGATE_EVENT). This is
  // authoritative regardless of how the attribute was set (toggle click,
  // localStorage, or external mutation). (#1551, #1552 B10)
  //
  // Flash suppression (#2198): swapRootAttributes wipes data-sidebar-hidden
  // during the body swap, so for one frame the attribute is ABSENT — the CSS
  // (html[data-sidebar-hidden] #desktop-sidebar etc.) sees the sidebar as
  // visible and the 200ms transitions begin animating it open. Our restore on
  // AFTER_NAVIGATE_EVENT re-adds the attribute, but that just reverses the
  // animation (visible → hidden slide), which is the visible flash + slide.
  // Fix: on BEFORE_NAVIGATE_EVENT add a transient `data-sidebar-no-transition`
  // marker that zeroes those transitions (see global.css), so the wipe and the
  // restore both apply instantly with no painted/animated frame. Remove the
  // marker on a double rAF AFTER the restore so the restored hidden state has
  // already been committed with transitions off; a later user toggle (which
  // happens without the marker) still animates normally.
  //
  // Self-healing against a stuck marker: the marker is normally removed by
  // `restore` (double rAF) on a successful swap. But a navigation that fires
  // BEFORE_NAVIGATE_EVENT and never reaches AFTER_NAVIGATE_EVENT (aborted or
  // superseded swap, fetch failure, MPA fallback — the `zfb:navigation-aborted`
  // path in zfb-runtime's router) would leave the marker set with no restore to
  // clear it, permanently killing toggle animations. A superseding navigation
  // self-heals (its own capture → restore cycle clears it), but a lone aborted
  // nav with no follow-up would not. So `capture` also schedules a double-rAF
  // sweep that removes the marker if no `restore` has run by then — a no-op on
  // the normal path (restore already removed it), a safety net on the aborted
  // path. (We cannot listen for the abort directly — @takazudo/zudo-doc/
  // transitions re-exports only the before/after constants, and raw "zfb:*"
  // strings are disallowed.)
  useEffect(() => {
    let wasHidden = false;
    let swapToken = 0;
    const capture = () => {
      wasHidden = document.documentElement.hasAttribute('data-sidebar-hidden');
      document.documentElement.setAttribute('data-sidebar-no-transition', '');
      const token = ++swapToken;
      // Safety net: if this navigation never reaches `restore` (which bumps
      // swapToken via clearMarker), drop the marker after two frames so it
      // cannot stay stuck. The token guard makes this a no-op once a real
      // restore — or a newer navigation — has occurred.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (token === swapToken) {
            document.documentElement.removeAttribute('data-sidebar-no-transition');
          }
        });
      });
    };
    const restore = () => {
      if (wasHidden) {
        document.documentElement.setAttribute('data-sidebar-hidden', '');
      }
      // If not hidden, swapRootAttributes already cleared it — nothing to do.
      // Drop the no-transition marker only after the restored state has been
      // committed. A single rAF can still coincide with the same style recalc
      // that applies the restore and animate it, so defer one extra frame.
      // Bump the token so capture's safety-net sweep for this swap no-ops.
      const token = ++swapToken;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (token === swapToken) {
            document.documentElement.removeAttribute('data-sidebar-no-transition');
          }
        });
      });
    };
    document.addEventListener(BEFORE_NAVIGATE_EVENT, capture);
    document.addEventListener(AFTER_NAVIGATE_EVENT, restore);
    return () => {
      document.removeEventListener(BEFORE_NAVIGATE_EVENT, capture);
      document.removeEventListener(AFTER_NAVIGATE_EVENT, restore);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="zd-desktop-sidebar-toggle hidden lg:flex fixed bottom-vsp-xl z-sidebar items-center justify-center w-[1.5rem] h-[3rem] bg-surface border border-muted border-l-0 rounded-r-DEFAULT text-muted cursor-pointer transition-[left,color] duration-200 ease-in-out hover:text-fg"
      aria-label={visible ? 'Hide sidebar' : 'Show sidebar'}
      aria-pressed={visible}
      data-zfb-transition-persist="desktop-sidebar-toggle"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-icon-sm w-icon-sm"
        aria-hidden="true"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={visible ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  );
}
