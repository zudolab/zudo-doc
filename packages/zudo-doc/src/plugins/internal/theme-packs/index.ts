// plugins/internal/theme-packs — package-internal surface for the public
// `@takazudo/zudo-doc/plugins/theme-packs` zfb plugin (ADR
// docs/adr/theme-packs.md, Decision 2, #2820). Three independent pieces,
// mirroring the `search-index`/`llms-txt` internal module shape:
//
//   - `resolveThemePacksForOptions` / `hasCssBearingPack` — shared
//     registry-resolution + no-op gating, reused by every hook.
//   - `copyEnabledThemePacks` — the postBuild copy step.
//   - `createThemePacksDevMiddleware` — the dev-time static-file server.
//
// Note: relative imports keep the explicit `.js` extension so the runtime
// ESM loader (Node's native TS support, used by zfb's plugin host) can
// resolve them without a TS-aware loader — same convention as the sibling
// `search-index`/`llms-txt` barrels.

export { resolveThemePacksForOptions, hasCssBearingPack } from "./resolve.js";
export { copyEnabledThemePacks } from "./copy.js";
export type { CopyThemePacksParams, CopyThemePacksResult } from "./copy.js";
export { createThemePacksDevMiddleware } from "./dev-middleware.js";
export type {
  ThemePacksMiddleware,
  ThemePacksNextFn,
  CreateThemePacksDevMiddlewareParams,
} from "./dev-middleware.js";
export type { ThemePacksPluginOptions, ThemePacksIndexManifest } from "./types.js";
