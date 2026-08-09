/**
 * Live cross-window theme propagation for the pop-out window
 * (popout-pattern.md recipe item 4).
 *
 * The pop-out window serves the SAME `index.html` the main window does, so
 * its FOUC-free inline bootstrap script (`index.html`'s `<head>`) already
 * applies the stored theme synchronously, before this module — or any of
 * this app's own JS — ever runs. That covers the "theme applied
 * synchronously pre-mount" half of the recipe for free.
 *
 * What that bootstrap script does NOT cover is a LIVE toggle in an already-
 * open main window: `color-scheme-sync.ts`'s `applyColorScheme` dispatches a
 * `color-scheme-changed` `CustomEvent`, but a `CustomEvent` never crosses a
 * window boundary. The native `storage` event does — it fires in every
 * OTHER same-origin window/tab (never the one that made the change) when
 * `localStorage` actually changes — which is exactly the signal this module
 * listens for.
 *
 * `STORAGE_KEY` is duplicated here rather than imported from
 * `color-scheme-sync.ts`, mirroring `index.html`'s own inline bootstrap
 * script, which documents the same tradeoff for the same reason: keeping
 * this module's only dependency the browser's `storage` event, not an
 * import graph into the main window's theme module. Keep both in sync if
 * the key ever renames.
 */

export type PopoutColorSchemeMode = "light" | "dark";

const STORAGE_KEY = "zudo-doc-online-theme";

function isColorSchemeMode(value: string | null): value is PopoutColorSchemeMode {
  return value === "light" || value === "dark";
}

/** Mirrors `applyColorScheme`'s DOM half only — this window must never re-write `localStorage` in response to a change that already came FROM `localStorage`, or a `storage` event in a third window could see this window as its origin. */
function applyDom(mode: PopoutColorSchemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
  document.documentElement.style.colorScheme = mode;
}

/**
 * Subscribes to the main window's live theme toggles. Returns an
 * unsubscribe function (suitable as a `useEffect` cleanup). A `storage`
 * event for an unrelated key, or an invalid value, is ignored — `newValue`
 * is `null` on `localStorage.removeItem`, which this treats as "nothing to
 * apply" rather than falling back to a default (the bootstrap script's
 * resolution already ran once; there is no better default to fall back to
 * here).
 */
export function subscribePopoutThemeSync(): () => void {
  const handler = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY) return;
    if (isColorSchemeMode(event.newValue)) applyDom(event.newValue);
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
