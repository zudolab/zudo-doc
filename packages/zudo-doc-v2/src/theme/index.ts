// E5 framework primitives — theme controls.
//
// This subpath publishes the layout-level color scheme provider, the theme
// toggle island, and the design token tweak panel (with its export modal
// and iframe bridge). The host project mounts these directly from
// `@zudo-doc/zudo-doc-v2/theme`.
//
// W3B (#1730): design-token SerDe + the shared tweak-state types live in v2
// now (moved from `src/utils/design-token-{serde,types}.ts`). They are
// re-exported here so host config modules can pull them via
// `@zudo-doc/zudo-doc-v2/theme` without a deeper subpath.

export { default as ThemeToggle } from "./theme-toggle";
export { default as ColorSchemeProvider } from "./color-scheme-provider";
export type {
  ColorSchemeProviderProps,
  ColorSchemeProviderColorMode,
} from "./color-scheme-provider";
export {
  default as DesignTokenTweakPanel,
  DesignTokenTweakPanelInner,
} from "./design-token-tweak-panel";
export { default as ColorTweakExportModal } from "./color-tweak-export-modal";
export {
  DESIGN_TOKEN_SCHEMA,
  DesignTokenSchemaError,
  deserialize,
  serialize,
  type DesignTokenJson,
  type DesignTokenJsonColor,
  type DesignTokenJsonColorBase,
  type DesignTokenJsonOverrides,
  type DesignTokenManifest,
  type DeserializeOptions,
  type DeserializeResult,
  type SerializeOptions,
} from "./design-token-serde";
export {
  emptyOverrides,
  type ColorTweakState,
  type TokenOverrides,
  type TweakState,
} from "./design-token-types";
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
