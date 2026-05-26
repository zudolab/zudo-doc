import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { HeadingItem } from "./types";

/**
 * Pixel offset from the viewport top used as the "above the fold"
 * threshold. A heading whose top is above this line is treated as
 * having scrolled past — matches the original zudo-doc behavior so the
 * scroll-spy keeps the same feel after the migration.
 */
const SCROLL_MARGIN_TOP = 80;
const DEBOUNCE_MS = 200;

/**
 * Pure helper that picks the active heading id given the heading slug
 * order and a slug→element map. Extracted from the hook so it is unit-
 * testable without DOM event plumbing.
 *
 * Algorithm: find the first heading whose top is at or below the
 * SCROLL_MARGIN_TOP threshold ("first visible"). If none, the user has
 * scrolled past every heading — return the last one. If the very first
 * heading is the first visible AND its top is above the viewport
 * midline, treat it as already active. Otherwise activate the
 * predecessor of the first visible heading.
 */
export function getActiveHeadingId(
  headingIds: readonly string[],
  elementMap: ReadonlyMap<string, HTMLElement>,
  viewportHeight: number,
): string | null {
  if (headingIds.length === 0) return null;

  let firstVisibleIndex = -1;
  for (let i = 0; i < headingIds.length; i++) {
    const el = elementMap.get(headingIds[i]!);
    if (!el) continue;
    const { top } = el.getBoundingClientRect();
    if (top >= SCROLL_MARGIN_TOP) {
      firstVisibleIndex = i;
      break;
    }
  }

  if (firstVisibleIndex === -1) {
    return headingIds[headingIds.length - 1] ?? null;
  }

  if (firstVisibleIndex === 0) {
    const el = elementMap.get(headingIds[0]!);
    if (el) {
      const { top } = el.getBoundingClientRect();
      if (top < viewportHeight / 2) {
        return headingIds[0] ?? null;
      }
    }
    return null;
  }

  const el = elementMap.get(headingIds[firstVisibleIndex]!);
  if (el) {
    const { top } = el.getBoundingClientRect();
    if (top < viewportHeight / 2) {
      return headingIds[firstVisibleIndex] ?? null;
    }
  }

  return headingIds[firstVisibleIndex - 1] ?? null;
}

export interface UseActiveHeadingResult {
  activeId: string | null;
  activate: (id: string) => void;
}

/**
 * Scroll-spy hook. Tracks which heading slug should be highlighted
 * based on the current scroll position. Provides an `activate(id)`
 * imperatively-callable helper used by click handlers — sets the
 * active id immediately and suppresses the scroll-driven update until
 * the smooth-scroll completes (`scrollend`, with a timeout fallback
 * for older Safari).
 */
export function useActiveHeading(
  headings: readonly HeadingItem[],
): UseActiveHeadingResult {
  const [activeId, setActiveId] = useState<string | null>(null);
  const headingIdsRef = useRef<readonly string[]>([]);
  const elementMapRef = useRef<Map<string, HTMLElement>>(new Map());
  const suppressedRef = useRef(false);

  const activate = useCallback((id: string) => {
    setActiveId(id);
    suppressedRef.current = true;
    // Safety timeout: unsuppress if no scroll event fires (target already in view)
    setTimeout(() => {
      suppressedRef.current = false;
    }, 2000);
  }, []);

  useEffect(() => {
    const ids = headings.map((h) => h.slug);
    headingIdsRef.current = ids;

    const map = new Map<string, HTMLElement>();
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) map.set(id, el);
    }
    elementMapRef.current = map;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    function update() {
      timerId = null;
      setActiveId(
        getActiveHeadingId(
          headingIdsRef.current,
          elementMapRef.current,
          window.innerHeight,
        ),
      );
    }

    let fallbackTimerId: ReturnType<typeof setTimeout> | null = null;

    function onScroll() {
      if (suppressedRef.current) {
        // Fallback for browsers without scrollend (Safari < 18)
        if (fallbackTimerId !== null) clearTimeout(fallbackTimerId);
        fallbackTimerId = setTimeout(onScrollEnd, 1500);
        return;
      }
      if (timerId !== null) clearTimeout(timerId);
      timerId = setTimeout(update, DEBOUNCE_MS);
    }

    function onScrollEnd() {
      suppressedRef.current = false;
      if (fallbackTimerId !== null) {
        clearTimeout(fallbackTimerId);
        fallbackTimerId = null;
      }
      if (timerId !== null) clearTimeout(timerId);
      update();
    }

    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scrollend", onScrollEnd);
      if (timerId !== null) clearTimeout(timerId);
      if (fallbackTimerId !== null) clearTimeout(fallbackTimerId);
    };
  }, [headings]);

  return { activeId, activate };
}
