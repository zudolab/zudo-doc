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
 * panel owns its own storage lifecycle and current persisted-state contract;
 * its own `color-scheme-changed` listener clears applied inline
 * styles and re-seeds the color slice from the newly active scheme. An
 * earlier version of this function deleted `zudo-doc-tweak-state` + `-v2` on
 * every toggle, which (a) targeted stale keys after zdtp moved to v3 — so it
 * no longer did anything — and (b) when it did fire, wiped the whole envelope
 * including scheme-independent spacing/typography/size tweaks, contradicting
 * the documented carry-over guarantee. So the host no longer touches zdtp's
 * private storage keys.
 *
 * The design-token-panel bootstrap ALSO listens for this event and, on toggle,
 * destroys + reconfigures the panel with the new mode's mode-scoped semantic
 * DEFAULTS (see `design-token-panel-bootstrap.ts` + the host's
 * `buildDesignTokenPanelConfig`, #2610). That keeps the panel's per-mode
 * defaults faithful. A *saved* color OVERRIDE is still mode-agnostic here,
 * though — not because zdtp can't key it per scheme (zdtp 0.4.5 ships
 * per-scheme/per-mode keyed color persistence, v4 envelope,
 * Takazudo/zudo-design-token-panel#500 / #509) but because THIS host's color
 * cluster is scheme-less and switches modes externally (destroy + reconfigure
 * above, not zdtp's own `colorMode` field), so zdtp always resolves the same
 * single scheme identity and an override repaints both modes until Reset.
 * See zudo-doc#2037 / #2610.
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
