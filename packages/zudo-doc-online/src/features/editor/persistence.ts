/**
 * `localStorage` plumbing for the editor workspace chrome.
 *
 * Four pieces of chrome state survive a reload — the open tab set, the rail
 * mode, the split ratio, and whether the editor is in vim mode. None of them
 * is project data: losing any of them costs the user one click, so nothing
 * here ever blocks or fails loudly.
 *
 * Read/write asymmetry mirrors `src/theme/color-scheme-sync.ts` (and, through
 * it, `@takazudo/zudo-doc`'s own convention): reads are wrapped in `try/catch`
 * because a disabled-storage browser throws on access and losing persistence
 * is harmless, while writes are left unwrapped so a genuine failure is not
 * silently swallowed. The one thing wrapped on both paths is the
 * "no `localStorage` in this environment at all" case (the node-environment
 * vitest specs, and any future SSR pass) — that is an environment check, not
 * an error to swallow.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PREFIX = "zdo-editor-";

export const OPEN_TABS_STORAGE_KEY = `${PREFIX}tabs`;
export const RAIL_MODE_STORAGE_KEY = `${PREFIX}rail`;
export const SPLIT_PERCENT_STORAGE_KEY = `${PREFIX}split`;
export const VIM_MODE_STORAGE_KEY = `${PREFIX}vim`;

/**
 * `undefined` means "use the ambient `localStorage` if this environment has
 * one"; an explicit `null` means "persist nothing" (used by specs that assert
 * the no-storage fallback path).
 */
export function resolveStorage(
  explicit?: KeyValueStorage | null,
): KeyValueStorage | null {
  if (explicit !== undefined) return explicit;
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function readStoredValue(
  key: string,
  storage?: KeyValueStorage | null,
): string | null {
  const resolved = resolveStorage(storage);
  if (resolved === null) return null;
  try {
    return resolved.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredValue(
  key: string,
  value: string,
  storage?: KeyValueStorage | null,
): void {
  const resolved = resolveStorage(storage);
  if (resolved === null) return;
  resolved.setItem(key, value);
}
