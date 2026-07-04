// E5 framework primitives — theme controls.
//
// This subpath publishes the layout-level color scheme provider, the theme
// toggle island, and the design-token tweak support modules (export modal
// and iframe bridge). The host project mounts these directly from
// `@takazudo/zudo-doc/theme`. The panel UI itself now lives in the external
// @takazudo/zdtp package, bootstrapped as a side-effect — no panel component
// is re-exported here.
//
// The `ThemeToggle` exported here is the Island-wrapped variant. The BARE
// component (for call sites that wrap in `<Island>` themselves or nest the
// toggle inside another island) lives on the dedicated
// `@takazudo/zudo-doc/theme-toggle` subpath (#2012 E2).
//
// W3B (#1730): design-token SerDe + the shared tweak-state types live in v2
// now (moved from `src/utils/design-token-{serde,types}.ts`). They are
// re-exported here so host config modules can pull them via
// `@takazudo/zudo-doc/theme` without a deeper subpath.

export { default as ThemeToggle } from "./theme-toggle.js";
export { default as ColorSchemeProvider } from "./color-scheme-provider.js";
export type {
  ColorSchemeProviderProps,
  ColorSchemeProviderColorMode,
} from "./color-scheme-provider.js";
export { default as ColorTweakExportModal } from "./color-tweak-export-modal.js";
export {
  DESIGN_TOKEN_SCHEMA,
  DesignTokenSchemaError,
  deserialize,
  serialize,
  type DesignTokenJson,
  type DesignTokenJsonColor,
  type DesignTokenJsonOverrides,
  type DesignTokenManifest,
  type DeserializeOptions,
  type DeserializeResult,
  type SerializeOptions,
} from "./design-token-serde.js";
export {
  emptyOverrides,
  type ColorTweakState,
  type TokenOverrides,
  type TweakState,
} from "./design-token-types.js";
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
} from "./iframe-bridge.js";
