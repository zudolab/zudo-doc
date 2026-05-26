// Local shim until upstream zdtp exports TweakState and emptyOverrides from main.
// Tracks https://github.com/Takazudo/zudo-design-token-panel/issues/49 — remove this file
// and import directly from "@takazudo/zdtp" once that lands.
//
// W3B (#1730 — Generator Pages Migration): moved wholesale from
// `src/utils/design-token-types.ts` so the v2 theme exports can stand
// alone without a host-side `@/utils/*` dependency. Shape preserved
// verbatim — every importer in this PR rewires its import path only.

export interface ColorTweakState {
  palette: string[];
  background: number;
  foreground: number;
  cursor: number;
  selectionBg: number;
  selectionFg: number;
  semanticMappings: Record<string, number | "bg" | "fg">;
}

export type TokenOverrides = Record<string, string>;

export interface TweakState {
  color: ColorTweakState;
  spacing: TokenOverrides;
  font: TokenOverrides;
  size: TokenOverrides;
}

export function emptyOverrides(): TokenOverrides {
  return {};
}
