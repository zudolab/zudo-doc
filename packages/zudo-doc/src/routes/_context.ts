// routes/_context — thin route-context shim for the package-owned route
// entrypoints (epic Package-First Finale #2356, A1 #2361; ADR
// docs/adr/route-injection-seam.md, Decision 1).
//
// The reconstruction logic was PROMOTED to the public, shared
// `createRouteContext(payload)` builder (`@takazudo/zudo-doc/route-context`,
// CTX #2423). This module is now just the seam that:
//   1. imports the SERIALIZABLE payload from the virtual module
//      `virtual:zudo-doc-route-context` (resolved by the routes plugin),
//   2. calls `createRouteContext` ONCE (the entrypoints share this singleton,
//      preserving the per-build memo / array-identity stability), and
//   3. re-exports the named bindings each entrypoint imports.
//
// The default content bridge (`stableDocs` reading `@takazudo/zfb/content`) is
// supplied by `createRouteContext`; this shim passes no override, so the
// injected package-routes path stays byte-identical.

// Virtual module, resolved by the routes plugin at build via
// addVirtualModule("virtual:zudo-doc-route-context", …). Not present on disk;
// the package ships ambient typings for it (routes/_virtual.d.ts).
import { routeContext } from "virtual:zudo-doc-route-context";

import type { Settings } from "../settings.js";
import type { ColorScheme } from "../color-scheme-utils.js";
import type { ThemePackRegistry } from "../theme-packs-registry/index.js";
import {
  createRouteContext,
  type RouteContextPayload,
} from "../route-context/index.js";

export type { RouteContextPayload, TagInfo } from "../route-context/index.js";

/** The serializable route-context payload (from the virtual module). */
export const ctx = routeContext as unknown as RouteContextPayload;

// Reconstruct the full runtime context ONCE — the entrypoints all import from
// this module, so they share the same memoized closures + stable arrays.
const routeCtx = createRouteContext(ctx);

export { routeCtx };

export const settings: Settings = routeCtx.settings;
/** Host color-scheme palette map. `null` when not supplied — `_chrome.tsx`
 *  falls back to `DEFAULT_SCHEME` in that case. */
export const colorSchemes: Record<string, ColorScheme> | null = routeCtx.colorSchemes;
/** Resolved, enabled, ordered theme-pack registry. `null` when the routes
 *  plugin did not thread one (ADR `docs/adr/theme-packs.md`, Decision 2). */
export const themePackRegistry: ThemePackRegistry | null = routeCtx.themePackRegistry;

export const {
  i18n,
  defaultLocale,
  locales,
  getLocaleConfig,
  getLocaleLabel,
  t,
  urlHelpers,
  withBase,
  stripBase,
  docsUrl,
  versionedDocsUrl,
  navHref,
  isDefaultLocaleOnlyPath,
  absoluteUrl,
  isExternal,
  resolveHref,
  buildLocaleLinks,
  getCategoryOrder,
  getNavSectionForSlug,
  getNavSubtree,
  extractHeadings,
  resolveTagBound,
  collectTags,
  resolveNavSource,
  resolveVersionedLocaleSource,
  loadNavSourceDocs,
  buildDocRouteEntries,
  enumerateDocsRoutes,
  enumerateTagsRoutes,
  enumerateVersionedRoutes,
  enumerateAllRoutes,
  buildNavTree,
  groupSatelliteNodes,
  findNode,
  firstRoutedHref,
  collectAutoIndexNodes,
  isNavVisible,
  stableDocs,
  toRouteSlug,
  toSlugParams,
} = routeCtx;
