"use client";

import { useState, useEffect, useRef } from 'react';

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
  // pattern as src/components/theme-toggle.tsx (commit 9aebd8e).
  const [visible, setVisible] = useState<boolean>(true);
  // Tracks whether the hydration sync (below) has run. The persistence
  // effect below skips the very first mount so we don't overwrite the
  // user's persisted "hidden" preference with the SSR-safe default
  // `true` before the hydration sync gets a chance to fire.
  const hydrated = useRef(false);

  // Persist state changes to localStorage and the <html> data-attribute.
  // Declared *before* the hydration-sync effect so on the very first
  // mount this effect's check sees `hydrated.current === false` and
  // bails out — preventing a flash of "visible" when the user has the
  // sidebar hidden.
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
  // with the SSR default. Marks the ref so subsequent effect runs
  // start persisting normally.
  useEffect(() => {
    hydrated.current = true;
    const actual = readState();
    if (actual !== visible) {
      setVisible(actual);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="zd-desktop-sidebar-toggle hidden lg:flex fixed bottom-vsp-xl z-40 items-center justify-center w-[1.5rem] h-[3rem] bg-surface border border-muted border-l-0 rounded-r-DEFAULT text-muted cursor-pointer transition-[left,color] duration-200 ease-in-out hover:text-fg"
      aria-label={visible ? 'Hide sidebar' : 'Show sidebar'}
      aria-pressed={visible}
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
