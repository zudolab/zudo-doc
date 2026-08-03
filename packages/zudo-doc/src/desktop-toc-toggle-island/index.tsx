"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useState, useEffect, useRef } from "preact/hooks";
import { ChevronRight, ChevronLeft } from "../icons/index.js";
import { AFTER_NAVIGATE_EVENT } from "../transitions/index.js";

export const TOC_STORAGE_KEY = "zudo-doc-toc-visible";

// Exported for unit testing the mount-reconcile logic in a plain Node env
// (no jsdom in the package vitest config) — the same convention the sibling
// DesktopSidebarToggle uses via desktop-sidebar-toggle-island/index.tsx.
// `readState` is the localStorage reader the mount effect uses to reconcile
// `visible` on initial load; `setDataAttribute` is the `<html data-toc-hidden>`
// writer.
export function readState(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(TOC_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setDataAttribute(isVisible: boolean) {
  if (isVisible) {
    document.documentElement.removeAttribute("data-toc-hidden");
  } else {
    document.documentElement.setAttribute("data-toc-hidden", "");
  }
}

export function DesktopTocToggle() {
  // Initial state must match server render (always `true`) to avoid a
  // hydration mismatch when the persisted preference is "hidden". The
  // doc-layout's pre-paint inline script applies `data-toc-hidden`
  // to <html> from localStorage *before* this island mounts, so the
  // visual state stays correct; we only need to sync this island's
  // React state to the persisted preference after hydration. Same
  // pattern as packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx.
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
      localStorage.setItem(TOC_STORAGE_KEY, String(visible));
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

  // After each soft SPA navigation, re-apply the data-attribute so a
  // "hidden" preference is not lost when the router swaps root attributes.
  useEffect(() => {
    const handler = () => setDataAttribute(readState());
    document.addEventListener(AFTER_NAVIGATE_EVENT, handler);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handler);
  }, []);

  // The SPA-navigation flash is handled upstream: doc-layout mounts
  // <ClientRouter preserveHtmlAttrs={["data-toc-hidden", ...]} /> so
  // zfb-runtime re-applies the runtime attribute within the synchronous
  // swap, before paint. Mirrors the sidebar toggle's own comment (#2200).

  return (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="zd-desktop-toc-toggle hidden xl:flex fixed bottom-vsp-xl z-sidebar items-center justify-center w-[1.5rem] h-[3rem] bg-surface border border-muted border-r-0 rounded-l-DEFAULT text-muted cursor-pointer transition-[right,color] duration-200 ease-in-out hover:text-fg"
      aria-label={visible ? "Hide table of contents" : "Show table of contents"}
      aria-pressed={visible}
      data-zfb-transition-persist="desktop-toc-toggle"
    >
      {visible
        ? <ChevronRight className="h-icon-sm w-icon-sm" />
        : <ChevronLeft className="h-icon-sm w-icon-sm" />
      }
    </button>
  );
}
DesktopTocToggle.displayName = "DesktopTocToggle";
