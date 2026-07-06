// Local shim until upstream zdtp exports TweakState and emptyOverrides from main.
// Tracks https://github.com/Takazudo/zudo-design-token-panel/issues/49 — remove this file
// and import directly from "@takazudo/zdtp" once that lands.
//
// W3B (#1730 — Generator Pages Migration): moved wholesale from
// `src/utils/design-token-types.ts` so the v2 theme exports can stand
// alone without a host-side `@/utils/*` dependency.
//
// Color Ramp Restructure (zudolab/zudo-doc#2584 / #2591): the color slice is now
// the ramp-native `ColorScheme` ({ ramps, map }) from `color-scheme-utils.ts`.
// The legacy 16-slot `{ palette, background, foreground, cursor, selectionBg,
// selectionFg, semanticMappings }` shape is gone. `ColorTweakState` is kept as a
// name alias for `ColorScheme` so the existing importers (export modal, theme
// barrel) need no rename.

import type { ColorScheme } from "../color-scheme-utils.js";

/** The per-scheme color state the design-token panel edits — a ramp-native
 *  `ColorScheme`. Retained as a named alias so call sites reading
 *  `ColorTweakState` keep compiling after the ramp restructure. */
export type ColorTweakState = ColorScheme;

export type TokenOverrides = Record<string, string>;

export interface TweakState {
  color: ColorScheme;
  spacing: TokenOverrides;
  font: TokenOverrides;
  size: TokenOverrides;
}

export function emptyOverrides(): TokenOverrides {
  return {};
}
