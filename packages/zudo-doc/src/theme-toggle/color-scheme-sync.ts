// Shared color-scheme state helpers for ThemeToggle (#2012 E3).
//
// Two ThemeToggle instances can be mounted at once (header + mobile
// sidebar footer). Each instance holds its own `mode` state, so a
// toggle in one used to leave the other's icon stale — the instances
// only read the DOM at mount. These helpers centralise the write path
// (`applyColorScheme`) and give every instance a subscription point
// (`subscribeColorSchemeChanged`) keyed on the `color-scheme-changed`
// window event, which `applyColorScheme` dispatches after mutating the
// DOM. The same event is already consumed by the zdtp design-token
// panel, so the event name is a cross-package contract — do not rename.
//
// This module is intentionally NOT marked "use client": zfb's island
// scanner registers every exported binding of a "use client" file as an
// island, and these helpers are plain functions, not components. They
// run in the browser only (called from the ThemeToggle island and
// unit tests).

export type ColorSchemeMode = "light" | "dark";

export const COLOR_SCHEME_CHANGED_EVENT = "color-scheme-changed";

const STORAGE_KEY = "zudo-doc-theme";

/**
 * Read the active color scheme from `<html data-theme>`. Falls back to
 * `defaultMode` when the attribute is missing or holds an unexpected
 * value (e.g. before the ColorSchemeProvider bootstrap script ran).
 */
export function readColorSchemeFromDom(
  defaultMode: ColorSchemeMode,
): ColorSchemeMode {
  const actual = document.documentElement.getAttribute("data-theme");
  return actual === "light" || actual === "dark" ? actual : defaultMode;
}

/**
 * Apply `next` as the active color scheme: mutate the DOM, persist the
 * preference, clear stale tweak state, and notify every subscriber
 * (including other mounted ThemeToggle instances) via the
 * `color-scheme-changed` window event.
 */
export function applyColorScheme(next: ColorSchemeMode): void {
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next;
  localStorage.setItem(STORAGE_KEY, next);
  // Clear both v1 and v2 tweak state so the new scheme's palette takes effect.
  localStorage.removeItem("zudo-doc-tweak-state");
  localStorage.removeItem("zudo-doc-tweak-state-v2");
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
