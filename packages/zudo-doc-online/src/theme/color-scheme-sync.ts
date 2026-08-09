// Shared color-scheme state helpers for ThemeToggle — mirrors
// @takazudo/zudo-doc's own `theme-toggle/color-scheme-sync.ts` mechanism
// (FOUC-free bootstrap script in index.html applies the same resolution
// rule before first paint), but under this app's OWN storage key so the
// two apps never collide or couple (see epic #3327's design-separation
// contract; the design-system skill documents this decision).
//
// Apply = set `data-theme` (informational only — read back via
// `readColorSchemeFromDom`; nothing in tokens.css selects on it) AND set
// `documentElement.style.colorScheme`, which is what actually drives the
// `light-dark()` branch selection in tokens.css.

export type ColorSchemeMode = "light" | "dark";

export const COLOR_SCHEME_CHANGED_EVENT = "color-scheme-changed";

const STORAGE_KEY = "zudo-doc-online-theme";

/**
 * Read the active color scheme from `<html data-theme>`. Falls back to
 * `defaultMode` when the attribute is missing or holds an unexpected value
 * (e.g. before the FOUC bootstrap script ran).
 */
export function readColorSchemeFromDom(
  defaultMode: ColorSchemeMode,
): ColorSchemeMode {
  const actual = document.documentElement.getAttribute("data-theme");
  return actual === "light" || actual === "dark" ? actual : defaultMode;
}

/**
 * Apply `next` as the active color scheme: mutate the DOM, persist the
 * preference, and notify every subscriber (mounted ThemeToggle instances)
 * via the `color-scheme-changed` window event.
 */
export function applyColorScheme(next: ColorSchemeMode): void {
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next;
  localStorage.setItem(STORAGE_KEY, next);
  window.dispatchEvent(new CustomEvent(COLOR_SCHEME_CHANGED_EVENT));
}

/**
 * Subscribe to color-scheme changes. Returns an unsubscribe function
 * (suitable as a `useEffect` cleanup).
 */
export function subscribeColorSchemeChanged(listener: () => void): () => void {
  window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, listener);
  return () => window.removeEventListener(COLOR_SCHEME_CHANGED_EVENT, listener);
}
