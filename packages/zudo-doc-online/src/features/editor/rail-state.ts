/**
 * The two persisted layout dimensions of the workspace chrome: the rail's
 * mode and the editor|preview split ratio.
 *
 * The rail is deliberately TWO states, not a free-form resizable panel (the
 * user feedback recorded in `_temp-resource/3327-zudo-doc-online/REFERENCE.md`):
 * an expanded page-tree panel, and a 48px icon rail whose pages button opens
 * the same tree as a flyout. A width slider would have made "collapsed"
 * ambiguous — a discrete mode is what the toggle affordance and the persisted
 * value both mean.
 *
 * The split, by contrast, IS free-form, so it is stored as a percentage
 * rather than a pixel width: a workspace reopened on a narrower window keeps
 * the ratio the user chose instead of squeezing one pane to nothing.
 */

import {
  RAIL_MODE_STORAGE_KEY,
  SPLIT_PERCENT_STORAGE_KEY,
  readStoredValue,
  writeStoredValue,
  type KeyValueStorage,
} from "./persistence";

export type RailMode = "expanded" | "collapsed";

export const DEFAULT_RAIL_MODE: RailMode = "expanded";

export function toggleRailMode(mode: RailMode): RailMode {
  return mode === "expanded" ? "collapsed" : "expanded";
}

export function readRailMode(storage?: KeyValueStorage | null): RailMode {
  const raw = readStoredValue(RAIL_MODE_STORAGE_KEY, storage);
  return raw === "expanded" || raw === "collapsed" ? raw : DEFAULT_RAIL_MODE;
}

export function writeRailMode(mode: RailMode, storage?: KeyValueStorage | null): void {
  writeStoredValue(RAIL_MODE_STORAGE_KEY, mode, storage);
}

/** Percent of the split's width given to the EDITOR pane. */
export const MIN_SPLIT_PERCENT = 20;
export const MAX_SPLIT_PERCENT = 80;
export const DEFAULT_SPLIT_PERCENT = 50;

/** One decimal is enough to make a drag feel continuous at any window width. */
export function clampSplitPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPLIT_PERCENT;
  const rounded = Math.round(value * 10) / 10;
  return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, rounded));
}

export function readSplitPercent(storage?: KeyValueStorage | null): number {
  const raw = readStoredValue(SPLIT_PERCENT_STORAGE_KEY, storage);
  if (raw === null) return DEFAULT_SPLIT_PERCENT;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? clampSplitPercent(parsed) : DEFAULT_SPLIT_PERCENT;
}

export function writeSplitPercent(
  percent: number,
  storage?: KeyValueStorage | null,
): void {
  writeStoredValue(SPLIT_PERCENT_STORAGE_KEY, String(clampSplitPercent(percent)), storage);
}

export interface SplitTrack {
  left: number;
  width: number;
}

/** Pointer x → editor-pane percentage, clamped to the usable range. */
export function splitPercentFromPointer(clientX: number, track: SplitTrack): number {
  if (track.width <= 0) return DEFAULT_SPLIT_PERCENT;
  return clampSplitPercent(((clientX - track.left) / track.width) * 100);
}

const KEYBOARD_STEP = 2;
const KEYBOARD_PAGE_STEP = 10;

/**
 * Keyboard resizing for the `role="separator"` handle. Returns `null` for a
 * key this handle does not own, so the caller knows not to `preventDefault`.
 */
export function splitPercentForKey(current: number, key: string): number | null {
  switch (key) {
    case "ArrowLeft":
      return clampSplitPercent(current - KEYBOARD_STEP);
    case "ArrowRight":
      return clampSplitPercent(current + KEYBOARD_STEP);
    case "PageDown":
      return clampSplitPercent(current - KEYBOARD_PAGE_STEP);
    case "PageUp":
      return clampSplitPercent(current + KEYBOARD_PAGE_STEP);
    case "Home":
      return MIN_SPLIT_PERCENT;
    case "End":
      return MAX_SPLIT_PERCENT;
    default:
      return null;
  }
}
