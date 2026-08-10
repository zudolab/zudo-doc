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

/**
 * Wraps a `KeyValueStorage` so every key it sees is transparently scoped to
 * one project slug (`:{slug}` suffix) — the multi-project persistence rule
 * (#3347): open tabs, rail mode, split ratio, and vim mode are all per-project
 * UI state, and every module in this file (`tabs-state.ts`, `rail-state.ts`,
 * `editor-extensions.ts`) reads/writes through the SAME base keys regardless
 * of which project is open, so callers wrap `storage` ONCE here rather than
 * threading a slug through every read/write call site.
 *
 * A legacy, un-scoped value (written before #3347) is readable exactly once,
 * and only for `legacyFallbackSlug` — the project a pre-#3347 hash resolves
 * to (`app/project.ts`'s `LEGACY_FALLBACK_SLUG`). Any other project's scoped
 * key is either present or the value does not exist; it never falls back to
 * another project's data. There is no migration beyond this read: nothing
 * ever WRITES to the unscoped key again once this wrapper is in place.
 */
export function scopeStorage(
  slug: string,
  legacyFallbackSlug: string,
  explicit?: KeyValueStorage | null,
): KeyValueStorage | null {
  const resolved = resolveStorage(explicit);
  if (resolved === null) return null;
  return {
    getItem(key: string): string | null {
      const scoped = resolved.getItem(`${key}:${slug}`);
      if (scoped !== null) return scoped;
      return slug === legacyFallbackSlug ? resolved.getItem(key) : null;
    },
    setItem(key: string, value: string): void {
      resolved.setItem(`${key}:${slug}`, value);
    },
  };
}
