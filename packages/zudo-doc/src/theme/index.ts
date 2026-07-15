// E5 framework primitives — theme controls.
//
// This subpath publishes the layout-level color scheme provider and the theme
// toggle island. Design-token panel state, import/export, and iframe behavior
// are owned by the external @takazudo/zdtp package.
//
// The `ThemeToggle` exported here is the Island-wrapped variant. The BARE
// component (for call sites that wrap in `<Island>` themselves or nest the
// toggle inside another island) lives on the dedicated
// `@takazudo/zudo-doc/theme-toggle` subpath (#2012 E2).
//
export { default as ThemeToggle } from "./theme-toggle.js";
export { default as ColorSchemeProvider } from "./color-scheme-provider.js";
export type {
  ColorSchemeProviderProps,
  ColorSchemeProviderColorMode,
} from "./color-scheme-provider.js";
