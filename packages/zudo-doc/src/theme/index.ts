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

// Theme-pack SSR helpers. `resolveThemePackSsrSlug` MUST be re-exported here:
// `copy-routes-src.mjs` rewrites a route's `../theme/<file>` import to the bare
// `@takazudo/zudo-doc/theme` subpath, so anything `src/routes/**` imports from
// this directory has to be reachable from this barrel or the site build fails
// with "No matching export" (the in-package relative import typechecks fine).
export { default as ThemePackProvider } from "./theme-pack-provider.js";
export {
  resolveThemePackSsrSlug,
  themePackVersionMap,
  buildThemePackBootstrap,
} from "./theme-pack-provider.js";
export type { ThemePackProviderProps } from "./theme-pack-provider.js";
