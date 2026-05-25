// E5 framework primitives — theme controls.
//
// This subpath publishes the layout-level color scheme provider, the theme
// toggle island, and the design token tweak panel (with its export modal
// and iframe bridge). The host project mounts these directly from
// `@zudo-doc/zudo-doc-v2/theme`.

export { default as ThemeToggle } from "./theme-toggle";
export { default as ColorSchemeProvider } from "./color-scheme-provider";
export {
  default as DesignTokenTweakPanel,
  DesignTokenTweakPanelInner,
} from "./design-token-tweak-panel";
export { default as ColorTweakExportModal } from "./color-tweak-export-modal";
export {
  BRIDGE_SOURCE,
  isBridgeMessage,
  installIframeReceiver,
  onIframeReady,
  sendApplyCssVars,
  sendClearCssVars,
  type BridgeMessage,
  type ApplyCssVarsMessage,
  type ClearCssVarsMessage,
  type ReadyMessage,
  type ErrorMessage,
  type CssVarPair,
} from "./iframe-bridge";
