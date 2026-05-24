// Local shim until upstream zdtp exports TweakState and emptyOverrides from main.
// Tracks https://github.com/Takazudo/zudo-design-token-panel/issues/49 — remove this file
// and import directly from "@takazudo/zdtp" once that lands.

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
