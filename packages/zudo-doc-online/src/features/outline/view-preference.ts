/**
 * Persistence for the Outline/Board view switch.
 *
 * Own storage key, same read/write asymmetry the theme toggle uses (see the
 * design-system skill): reads are wrapped in try/catch because private
 * browsing and disabled storage can throw on access and losing a persisted
 * preference is not worth a broken surface, while writes are deliberately
 * left bare so a genuinely failing write is visible rather than swallowed.
 *
 * Per-project (#3347): the preference is scoped `:{slug}` like the editor's
 * own chrome state (`features/editor/persistence.ts`'s `scopeStorage`), with
 * the same one-time legacy-value read for `LEGACY_FALLBACK_SLUG` only.
 */

import { LEGACY_FALLBACK_SLUG } from "../../app/project.js";

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

function scopedKey(slug: string): string {
  return `${OUTLINE_VIEW_STORAGE_KEY}:${slug}`;
}

export function readOutlineView(
  projectSlug: string,
  storage?: ViewPreferenceStorage,
): OutlineViewMode {
  try {
    const source = storage ?? resolveDefaultStorage();
    if (source === null) return DEFAULT_OUTLINE_VIEW;
    const scoped = source.getItem(scopedKey(projectSlug));
    if (isOutlineViewMode(scoped)) return scoped;
    if (projectSlug === LEGACY_FALLBACK_SLUG) {
      const legacy = source.getItem(OUTLINE_VIEW_STORAGE_KEY);
      if (isOutlineViewMode(legacy)) return legacy;
    }
    return DEFAULT_OUTLINE_VIEW;
  } catch {
    return DEFAULT_OUTLINE_VIEW;
  }
}

export function writeOutlineView(
  mode: OutlineViewMode,
  projectSlug: string,
  storage?: ViewPreferenceStorage,
): void {
  const target = storage ?? resolveDefaultStorage();
  if (target === null) return;
  target.setItem(scopedKey(projectSlug), mode);
}

function resolveDefaultStorage(): ViewPreferenceStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}
