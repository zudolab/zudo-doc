// Pure state helpers for the theme-pack switcher flyout island (ADR
// `docs/adr/theme-packs.md` Decision 7; epic Theme Core #2812, sub-issue
// #2821). Kept out of `index.tsx` so the Prev/Next wraparound cycling, the
// active-entry resolution, and the DOM-sync/Escape wiring are unit-testable
// in the package's plain-Node vitest environment (no jsdom) — the
// `color-scheme-sync.test.ts` convention.
//
// This module is intentionally NOT marked "use client": zfb's island scanner
// registers every exported binding of a "use client" file as an island, and
// these are plain functions, not components (the `theme-pack-sync.ts`
// precedent in this same directory).

import {
  readThemePackFromDom,
  subscribeThemePackChanged,
} from "./theme-pack-sync.js";

/**
 * One entry of the flyout's SSR-provided `order` prop — the lightweight
 * projection of a registry entry's meta (ADR Decision 7 "Switcher data
 * flow": `{ slug, name, mode, description }`). The array order IS the
 * Prev/Next cycle order (and the dialog grid order).
 */
export interface ThemePackOrderEntry {
  /** Pack slug (`meta.slug` — equals the pack's directory name). */
  slug: string;
  /** Display name shown as the flyout card title. */
  name: string;
  /** Designed-primary mode badge — a badge, not a capability flag. */
  mode: "light" | "dark";
  /** 1–2 sentence note shown under the title. */
  description: string;
}

/**
 * Resolve the cycle target `step` away from `active` in `order`, wrapping
 * around at both ends (ADR Decision 7: "Ordering IS the switcher order",
 * Prev/Next cycle with wraparound).
 *
 * - Empty `order` → `null` (nothing to cycle to).
 * - `active` not present in `order` (e.g. the html attribute carries a slug
 *   the switcher was not configured with) → the first entry for `+1`, the
 *   last for `-1`, so the UI recovers onto the cycle instead of dead-ending.
 */
export function cyclePackSlug(
  order: readonly ThemePackOrderEntry[],
  active: string,
  step: 1 | -1,
): string | null {
  if (order.length === 0) return null;
  const idx = order.findIndex((entry) => entry.slug === active);
  if (idx === -1) {
    const fallback = step === 1 ? order[0] : order[order.length - 1];
    return fallback?.slug ?? null;
  }
  const next = order[(idx + step + order.length) % order.length];
  return next?.slug ?? null;
}

/** The Prev/Next cycle target after `active` (wraparound). */
export function nextPackSlug(
  order: readonly ThemePackOrderEntry[],
  active: string,
): string | null {
  return cyclePackSlug(order, active, 1);
}

/** The Prev/Next cycle target before `active` (wraparound). */
export function prevPackSlug(
  order: readonly ThemePackOrderEntry[],
  active: string,
): string | null {
  return cyclePackSlug(order, active, -1);
}

/**
 * The `order` entry matching `active`, or `null` when the active slug is not
 * part of the switcher order (the card then falls back to showing the bare
 * slug with no badge/description).
 */
export function resolveActiveEntry(
  order: readonly ThemePackOrderEntry[],
  active: string,
): ThemePackOrderEntry | null {
  return order.find((entry) => entry.slug === active) ?? null;
}

/**
 * Connect a state setter to the live active-pack source of truth: push the
 * CURRENT DOM value once immediately, then re-push on every
 * `theme-pack-changed` event so multiple mounted surfaces (flyout, dialog, a
 * future header trigger) never disagree — the ThemeToggle cross-instance
 * sync pattern (#2012 E3). Returns an unsubscribe function suitable as a
 * `useEffect` cleanup.
 *
 * Note the display state only ever advances FROM this event: a failed or
 * aborted `applyThemePack` never fires it, so the UI never shows a pack that
 * did not commit (ADR Decision 3 failure semantics).
 */
export function connectActivePackSync(onActive: (slug: string) => void): () => void {
  const sync = () => onActive(readThemePackFromDom());
  sync();
  return subscribeThemePackChanged(sync);
}

/**
 * Register a document-level Escape handler (used while the flyout card is
 * open — close on Escape, acceptance criterion of #2821). Returns the
 * matching teardown, suitable as a `useEffect` cleanup.
 */
export function connectEscapeToClose(onEscape: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onEscape();
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}
