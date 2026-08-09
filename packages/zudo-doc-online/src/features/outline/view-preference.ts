/**
 * Persistence for the Outline/Board view switch.
 *
 * Own storage key, same read/write asymmetry the theme toggle uses (see the
 * design-system skill): reads are wrapped in try/catch because private
 * browsing and disabled storage can throw on access and losing a persisted
 * preference is not worth a broken surface, while writes are deliberately
 * left bare so a genuinely failing write is visible rather than swallowed.
 */

export type OutlineViewMode = "outline" | "board";

export const OUTLINE_VIEW_STORAGE_KEY = "zudo-doc-online-outline-view";

export const DEFAULT_OUTLINE_VIEW: OutlineViewMode = "outline";

/** The slice of `Storage` this module uses; tests inject a plain object. */
export interface ViewPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isOutlineViewMode(value: unknown): value is OutlineViewMode {
  return value === "outline" || value === "board";
}

export function readOutlineView(
  storage?: ViewPreferenceStorage,
): OutlineViewMode {
  try {
    const source = storage ?? resolveDefaultStorage();
    if (source === null) return DEFAULT_OUTLINE_VIEW;
    const stored = source.getItem(OUTLINE_VIEW_STORAGE_KEY);
    return isOutlineViewMode(stored) ? stored : DEFAULT_OUTLINE_VIEW;
  } catch {
    return DEFAULT_OUTLINE_VIEW;
  }
}

export function writeOutlineView(
  mode: OutlineViewMode,
  storage?: ViewPreferenceStorage,
): void {
  const target = storage ?? resolveDefaultStorage();
  if (target === null) return;
  target.setItem(OUTLINE_VIEW_STORAGE_KEY, mode);
}

function resolveDefaultStorage(): ViewPreferenceStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}
