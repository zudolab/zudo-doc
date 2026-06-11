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
 * preference, and notify every subscriber (including other mounted
 * ThemeToggle instances and the zdtp design-token panel) via the
 * `color-scheme-changed` window event.
 *
 * Tweak-state reconciliation is intentionally NOT done here (#2037). The zdtp
 * panel owns its own storage lifecycle: it persists the unified tweak envelope
 * under `zudo-doc-tweak-state-v3` (auto-migrating the legacy
 * `zudo-doc-tweak-state-v2` / `zudo-doc-tweak-state` keys into it), and its own
 * `color-scheme-changed` listener clears applied inline styles and re-seeds the
 * color slice from the newly active scheme. An earlier version of this function
 * deleted `zudo-doc-tweak-state` + `-v2` on every toggle, which (a) targeted
 * stale keys after zdtp moved to v3 — so it no longer did anything — and
 * (b) when it did fire, wiped the whole envelope including scheme-independent
 * spacing/typography/size tweaks, contradicting the documented carry-over
 * guarantee. So the host no longer touches zdtp's private storage keys.
 *
 * Whether palette tweaks should instead persist per-scheme (so a light/dark
 * round-trip keeps them) is a zdtp design question tracked upstream at
 * Takazudo/zudo-design-token-panel#343. See zudo-doc#2037.
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
