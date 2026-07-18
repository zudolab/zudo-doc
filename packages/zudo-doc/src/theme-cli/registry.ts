// theme-cli/registry — offline catalog resolution (ADR docs/adr/theme-packs.md
// "Catalog source (offline)"): `theme list`/`theme apply` read the INSTALLED
// package's own shipped registry, never the network.
//
// Resolution is relative to THIS module's own `import.meta.url` — the
// eject-pattern rule the ADR calls out explicitly: `bin/zudo-doc.mjs` (and
// this compiled module under `dist/theme-cli/`) lives INSIDE the very
// `@takazudo/zudo-doc` install whose registry we want, so there is no need
// to search a consumer's `node_modules` tree (contrast with `eject`'s
// `defaultResolvePackageRoot`, which walks cwd upward — eject supports
// pointing at an arbitrary installed copy, but the theme catalog is always
// "whichever copy of the package this CLI itself shipped from").
// `dist/theme-cli/registry.js` -> `../theme-packs/` -> `dist/theme-packs/`,
// the same relative shape `src/plugins/theme-packs.ts`'s `themePacksDir()`
// uses for its own independent resolution.

import {
  loadThemePackRegistry,
  type ThemePackRegistry,
  type ThemePackRegistryEntry,
} from "../theme-packs-registry/index.js";

export type { ThemePackRegistry, ThemePackRegistryEntry };

function defaultThemePacksDir(): URL {
  return new URL("../theme-packs/", import.meta.url);
}

export interface LoadInstalledThemePackCatalogOptions {
  /** Override for tests — points at a fixture `theme-packs/` directory
   *  instead of this module's own shipped one. */
  themePacksDir?: string | URL;
}

/**
 * Load the full installed catalog (every pack the running
 * `@takazudo/zudo-doc` ships), validated the same way the package's own
 * build validates it (`loadThemePackRegistry` — throws loudly naming the
 * offending pack on a corrupted install rather than silently degrading).
 */
export function loadInstalledThemePackCatalog(
  options: LoadInstalledThemePackCatalogOptions = {},
): ThemePackRegistry {
  const dir = options.themePacksDir ?? defaultThemePacksDir();
  return loadThemePackRegistry(dir);
}
