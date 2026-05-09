// Local shim until upstream zdtp exports TweakState and emptyOverrides from main.
// Tracks https://github.com/Takazudo/zudo-design-token-panel/issues/49 — remove this file
// and import directly from "@takazudo/zudo-design-token-panel" once that lands.
//
// Note: the installed zdtp version does not yet ship the ./testing sub-entrypoint
// on disk (package.json declares it but dist/testing.d.ts / dist/testing.js are
// absent). ColorTweakState is defined locally here with the zudo-doc-specific shape
// (no shikiTheme field; TweakState.font instead of .typography) until the upstream
// package stabilises and the shim can be removed.

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
