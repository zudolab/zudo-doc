// zfb plugin module: theme-packs (ADR docs/adr/theme-packs.md, Decision 2;
// #2820 — "Pack asset delivery pipeline"). Closes the interim gap #2819 left
// open: `plugins/routes.ts` already resolves + validates the registry for
// the SSR route-context payload, but nothing yet made the pack FILES
// (`pack.css`, `meta.json`, `fonts/*`) reachable at runtime — this plugin is
// that half.
//
// Wires three lifecycle hooks:
//
//   setup         — resolves the shipped pack dir + validates
//                   `settings.themePack`/`settings.themePacks` against it.
//                   THROWS at setup on an unknown/duplicate slug (naming the
//                   bad slug + the available ones) — never a silent
//                   fallback. This duplicates routes.ts's own validation by
//                   design (each plugin independently fails loud; no shared
//                   state crosses hook boundaries — see
//                   internal/theme-packs/resolve.ts).
//
//   postBuild     — copies every ENABLED pack's files into
//                   `${outDir}/theme-packs/<slug>/…` and writes the
//                   aggregated `${outDir}/theme-packs/index.json` registry
//                   manifest. No-ops when the enabled set has no CSS-bearing
//                   pack (only "default") — dead-weight avoidance for the
//                   common case.
//
//   devMiddleware — serves the same three stable URL shapes
//                   (`<prefix>/index.json`, `<prefix>/<slug>/pack.css`,
//                   `<prefix>/<slug>/fonts/<file>`) directly from the
//                   package's shipped pack directory — no on-disk copy
//                   needed in dev.
//
// Per the ADR's upstream check, no zfb-side change is needed: `postBuild`
// (writes into `ctx.outDir`) + `devMiddleware` is the sanctioned,
// already-proven asset path (the `search-index` plugin is the precedent).
// `zfb preview` serves the built `dist/` verbatim and both Cloudflare
// services deploy `dist/` as static assets, so postBuild-landed files are
// served in every mode with no `previewMiddleware` registration.
//
// Inline plugin functions are not supported by zfb's plugin runtime — see
// the sibling `doc-history.ts` for the standalone-module rationale.

import type {
  ZfbBuildHookContext,
  ZfbDevMiddlewareContext,
  ZfbPlugin,
  ZfbSetupContext,
} from "@takazudo/zfb/plugins";
import {
  resolveThemePacksForOptions,
  hasCssBearingPack,
  copyEnabledThemePacks,
  createThemePacksDevMiddleware,
  type ThemePacksPluginOptions,
} from "./internal/theme-packs/index.js";
import { connectToZfbHandler } from "./connect-adapter.js";
import { getBasePrefix } from "./plugin-utils.js";

/**
 * Resolve the shipped `theme-packs/` directory relative to THIS module —
 * `dist/theme-packs/` once compiled (workspace-built and published shapes
 * alike), `src/theme-packs/` when vitest runs the source directly. Same rule
 * `routes.ts`'s `themePacksDir` uses for its own, independent resolution.
 */
function themePacksDir(): URL {
  return new URL("../theme-packs/", import.meta.url);
}

const plugin: ZfbPlugin = {
  name: "theme-packs",

  setup(ctx: ZfbSetupContext) {
    const options = ctx.options as unknown as ThemePacksPluginOptions;
    // Throws loudly (fail-fast precedent) on an unknown/duplicate slug.
    // Nothing is stored here — postBuild/devMiddleware each re-resolve from
    // their own ctx.options, so no mutable state crosses hook boundaries.
    resolveThemePacksForOptions(themePacksDir(), options);
  },

  async postBuild(ctx: ZfbBuildHookContext) {
    const options = ctx.options as unknown as ThemePacksPluginOptions;
    const enabled = resolveThemePacksForOptions(themePacksDir(), options);
    copyEnabledThemePacks({ packsDir: themePacksDir(), enabled, outDir: ctx.outDir });
  },

  devMiddleware(ctx: ZfbDevMiddlewareContext) {
    const options = ctx.options as unknown as ThemePacksPluginOptions;
    const enabled = resolveThemePacksForOptions(themePacksDir(), options);
    if (!hasCssBearingPack(enabled)) return; // no-op, mirrors postBuild

    const basePrefix = getBasePrefix(options.base);
    const routePrefix = `${basePrefix}/theme-packs`;
    const middleware = createThemePacksDevMiddleware({
      packsDir: themePacksDir(),
      enabled,
      routePrefix,
    });
    ctx.register(routePrefix, connectToZfbHandler(middleware));
  },
};

export default plugin;
