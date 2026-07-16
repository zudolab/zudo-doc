// factory-context — the injected-context TYPE shared by every `pages/lib/*`
// factory the package-first migration (epic #2344) relocates into this package.
//
// ## The decision (epic #2344 "Key decision")
//
// Factory context signature is **`{ settings, i18n, components, navSource }`** —
// deliberately NO generic `utils` bag. A `utils` key would re-couple the factory
// API to this project's util surface and defeat the migration; factories instead
// receive exactly the four typed slots below and build everything else from them
// (URL helpers via `makeUrlHelpers(settings, i18n)`, nav trees via
// `buildNavTree(entries, { buildHref })`, etc.). Host-only singletons are
// imported ONLY in the project-side thin stub that constructs this context —
// never inside a package factory.
//
// This module is **types only** — no runtime values, no node builtins — so it
// stays importable from the config eval graph and from client islands alike.

import type { Settings, TagVocabularyEntry } from "../settings.js";
// Type-only imports (erased at build — they never enter the runtime/eval graph,
// so this module stays node-free; the foundation-eval-graph guard covers it).
import type { ColorScheme } from "../color-scheme-utils.js";
import type { ThemePackRegistry } from "../theme-packs-registry/index.js";
import type { UrlHelpers } from "../url-helpers/index.js";
import type { NavSourceDocsAPI } from "../nav-source-docs/index.js";
import type { DocRouteEntriesAPI } from "../doc-route-entries/index.js";
import type { RouteEnumeratorsAPI } from "../route-enumerators/index.js";
import type { ResolvedTag } from "../tag-helpers/index.js";
import type { DocNavNode, DocPageEntry } from "../doc-page-props/index.js";
import type { HeadingItem } from "../extract-headings/index.js";
import type { CategoryMeta } from "../sidebar-tree/index.js";
import type { HeaderRightComponentRegistry } from "../header/types.js";

/**
 * The i18n surface a factory may read. Parameterizes what `base.ts` used to read
 * off the project's `@/config/i18n` singleton directly, so URL/locale logic moves
 * into the package as pure functions (see `makeUrlHelpers`).
 *
 * `Locale` is kept as a plain `string` at the package boundary — the concrete
 * union (`"en" | "ja" | …`) is a project-specific narrowing the host supplies; the
 * package only needs the structural contract.
 */
export interface FactoryI18n {
  /** Default locale code (served from the un-prefixed `/docs/...` routes). */
  defaultLocale: string;
  /** All supported locale codes, default locale first. */
  locales: readonly string[];
  /** Display label for a locale (e.g. `"EN"`, `"日本語"`). */
  getLocaleLabel: (locale: string) => string;
  /**
   * Translate a UI string key for a locale, falling back to the default locale
   * then the key itself. Optional: factories that emit no UI strings omit it.
   */
  t?: (key: string, locale?: string) => string;
}

/**
 * ALLOWED `{ components }` slots — the host-supplied, project-bound component
 * bindings a factory may inject. This is an **explicit allowlist, NOT an open
 * bag**: every key here is a component the package cannot own because it depends
 * on the host's content collections, settings wiring, or showcase-specific
 * markup. Each slot is documented in `packages/zudo-doc/CLAUDE.md`. Do NOT widen
 * this into a dumping ground — a new slot needs a real cross-package coupling
 * reason and a CLAUDE.md entry. All slots are optional so a factory takes only
 * the ones it needs.
 *
 * Components are typed as the structural `FactoryComponent` (a function
 * returning Preact-renderable output) rather than a concrete signature, so the
 * type stays node-free and Preact-version-agnostic at the boundary.
 */
export interface FactoryComponents {
  /** Locale-aware category nav wrapper (reads the project's content collection). */
  CategoryNav?: FactoryComponent;
  /** Locale-aware category-tree nav wrapper. */
  CategoryTreeNav?: FactoryComponent;
  /** Locale-aware site-tree nav wrapper (also used for the demo variant). */
  SiteTreeNav?: FactoryComponent;
  /** HTML-preview wrapper bound to the host's preview config. */
  HtmlPreview?: FactoryComponent;
  /** `<details>` content override. */
  Details?: FactoryComponent;
  /** zfb `<Island>` pass-through (host owns the import so the scanner walks it). */
  Island?: FactoryComponent;
  /** PresetGenerator SSR shell (showcase-only; downstream projects stub it). */
  PresetGenerator?: FactoryComponent;
}

/** Any Preact-renderable component — a function returning a VNode/children. */
export type FactoryComponent = (props: Record<string, unknown>) => unknown;

/**
 * Opaque per-locale nav-source handle. The host owns the actual content-loader
 * implementation (it reads project content collections, which cannot live in the
 * package); a factory receives this handle and passes it to the package's pure
 * nav builders (`buildNavTree`, sidebar/nav-scope helpers) without knowing its
 * internals. Typed `unknown` on purpose — narrowing belongs to the host stub.
 */
export type NavSource = unknown;

/**
 * The injected context every relocated `pages/lib/*` factory receives.
 *
 * @typeParam S - the host's concrete settings shape (defaults to the package
 *   `Settings`). A factory that reads only a subset may accept `Pick<Settings, …>`
 *   at its own call site; this context type carries the full object.
 */
export interface FactoryContext<S = Settings> {
  /** The host's resolved settings object (single source of config truth). */
  settings: S;
  /** The i18n surface (locales, labels, optional translator). */
  i18n: FactoryI18n;
  /** Host-supplied, project-bound component bindings (explicit allowlist). */
  components: FactoryComponents;
  /** Opaque per-locale nav-source handle passed to the pure nav builders. */
  navSource: NavSource;
}

// ===========================================================================
// Unified ChromeContext (epic Collapse Wiring Shells #2420, CTX #2423)
// ---------------------------------------------------------------------------
// The narrow `FactoryContext` above is the per-factory injected slot bag. The
// types below describe the WHOLE route/chrome context the package-owned routes
// (and, later, the host) reconstruct from the serializable virtual module:
//
//   createRouteContext(payload)            → RouteContext   (settings + i18n +
//                                            every reconstructed callable)
//   createChrome(context, hostBindings)    → the wired page-chrome factories
//
// `ChromeContext` is the documented superset = RouteContext + the host-supplied
// component allowlist + the genuinely host-bound slots. These are TYPES ONLY
// (all imports above are `import type`, erased at build), so this module stays
// importable from the config eval graph and client islands unchanged.
// ===========================================================================

/**
 * The serializable route-context payload carried by the
 * `virtual:zudo-doc-route-context` module (ADR `route-injection-seam.md`,
 * Decision 1) — DATA ONLY, no callables. `createRouteContext` rebuilds the full
 * runtime context from it by calling the importable package factories.
 */
export interface RouteContextPayload<S = Settings> {
  /** The host's resolved settings object. */
  settings: S;
  /** Per-locale UI-string tables (`translations[locale][key]`). */
  translations: Record<string, Record<string, string>>;
  /** The tag vocabulary (used only when `settings.tagVocabulary` is on). */
  tagVocabulary: readonly TagVocabularyEntry[];
  /** Host color-scheme palette map; `null` when the host passed none (chrome
   *  then falls back to a neutral default scheme). */
  colorSchemes: Record<string, ColorScheme> | null;
  /**
   * Resolved, enabled, ordered theme-pack registry (ADR
   * `docs/adr/theme-packs.md`, Decision 2 "Registry threading to
   * SSR/islands") — settings ∩ the bundled `theme-packs/` directories, in
   * switcher order. `null` renders the whole feature inert (same accepted
   * coupling class as {@link colorSchemes} for a `packageOwnedRoutes: false`
   * host that builds its own payload without threading one).
   */
  themePackRegistry: ThemePackRegistry | null;
}

/** Aggregated `tag → docs` index entry built by `collectTags`. */
export interface TagInfo {
  tag: string;
  count: number;
  docs: { slug: string; title: string; description?: string }[];
}

/** A docs-href builder: `(slug, locale) => url`. */
export type RouteHrefBuilder = (slug: string, locale: string) => string;

/**
 * The reconstructed route context — `settings` + `i18n` + EVERY callable the
 * package routes rebuild from the serializable payload (URL helpers, nav-scope,
 * heading extraction, tag aggregation, nav-source resolution, doc-route-entry
 * + route enumeration, and the pure nav-tree / slug helpers). Produced by
 * `createRouteContext` and consumed by `createChrome`.
 *
 * It composes the already-typed factory API surfaces ({@link UrlHelpers},
 * {@link NavSourceDocsAPI}, {@link DocRouteEntriesAPI},
 * {@link RouteEnumeratorsAPI}) so the callables stay typed by their owning
 * modules rather than re-declared here.
 */
export interface RouteContext<S = Settings>
  extends UrlHelpers,
    NavSourceDocsAPI,
    DocRouteEntriesAPI,
    RouteEnumeratorsAPI {
  /** The host's resolved settings object. */
  settings: S;
  /** Host color-scheme palette map (or `null`); threaded to chrome head CSS. */
  colorSchemes: Record<string, ColorScheme> | null;
  /** Resolved, enabled, ordered theme-pack registry (or `null`) — see
   *  {@link RouteContextPayload.themePackRegistry}. */
  themePackRegistry: ThemePackRegistry | null;
  /** The reconstructed i18n surface. */
  i18n: FactoryI18n;
  /** Default locale code (un-prefixed `/docs/...`). */
  defaultLocale: string;
  /** All supported locale codes, default first. */
  locales: readonly string[];
  /** Per-locale `{ label, dir }` config lookup. */
  getLocaleConfig(locale: string): { label: string; dir: string } | undefined;
  /** Display label for a locale. */
  getLocaleLabel(locale: string): string;
  /** Translate a UI string key for a locale (falls back to default then key). */
  t(key: string, locale?: string): string;
  /** The full URL-helper bag (also spread as own members via `extends`). */
  urlHelpers: UrlHelpers;
  /** Ordered category prefixes for the header nav. */
  getCategoryOrder(): string[];
  /** The nav section a slug belongs to (or `undefined`). */
  getNavSectionForSlug(slug: string): string | undefined;
  /** Scope a nav tree to a category. */
  getNavSubtree(tree: DocNavNode[], categoryMatch?: string): DocNavNode[];
  /** Extract TOC headings from a doc body (bound to settings depth/strategy). */
  extractHeadings(body: string): HeadingItem[];
  /** Resolve a raw tag against the bound vocabulary + governance. */
  resolveTagBound(raw: string): ResolvedTag;
  /** Aggregate a `tag → docs` index from a doc collection. */
  collectTags(
    entries: ReadonlyArray<{
      slug: string;
      data: { slug?: string; title?: string; description?: string; tags?: string[] };
    }>,
    slugFn: (entrySlug: string, data: { slug?: string }) => string,
  ): Map<string, TagInfo>;
  /** Build a recursive nav tree from a flat doc collection. */
  buildNavTree(
    docs: DocPageEntry[],
    locale: string,
    categoryMeta: Map<string, CategoryMeta> | undefined,
    buildHref: RouteHrefBuilder,
    options?: { buildHref?: RouteHrefBuilder },
  ): DocNavNode[];
  /** Group slug-prefix satellite nodes under their primary node. */
  groupSatelliteNodes(tree: DocNavNode[], prefixes: string[]): DocNavNode[];
  /** Find a node by slug anywhere in a nav tree. */
  findNode(nodes: DocNavNode[], slug: string): DocNavNode | undefined;
  /** Href of the first routed descendant. */
  firstRoutedHref(node: DocNavNode): string | undefined;
  /** Category nodes that have children but no page of their own. */
  collectAutoIndexNodes(nodes: DocNavNode[]): DocNavNode[];
  /** Visibility predicate for nav inclusion. */
  isNavVisible(doc: DocPageEntry): boolean;
  /** The content-bridge handle: identity-stable, draft-filtered docs loader. */
  stableDocs(collectionName: string): DocPageEntry[];
  /** Canonical route slug for a zfb content slug. */
  toRouteSlug(entrySlug: string): string;
  /** Split a route slug into path params. */
  toSlugParams(routeSlug: string): string[];
}

/**
 * The genuinely host-bound chrome slots — bindings the serializable
 * route-context payload deliberately does NOT carry (they are host content /
 * project config, not serializable settings). Each is OPTIONAL; `createChrome`
 * fills any omitted slot with the package-default stub that reproduces the
 * pre-host-collapse (injected package-routes) behaviour BYTE-FOR-BYTE. The host
 * (HOSTCOLLAPSE wave) later passes the real bindings.
 */
export interface ChromeHostBindings {
  /** Primary header chrome. Default: the package HeaderWithDefaults component. */
  Header?: FactoryComponent;
  /** Primary footer chrome. Default: the package FooterWithDefaults component. */
  Footer?: FactoryComponent;
  /** Primary doc sidebar chrome. Default: the package SidebarWithDefaults component. */
  Sidebar?: FactoryComponent;
  /** Primary desktop table of contents. Default: the package Toc component. */
  Toc?: FactoryComponent;
  /** Primary breadcrumb trail. Default: the package Breadcrumb component. */
  Breadcrumb?: FactoryComponent;
  /** Primary previous/next document pager. Default: the package DocPager component. */
  DocPager?: FactoryComponent;
  /** Header search widget. Default: the package SearchWidget bound to the site base. */
  SearchWidget?: FactoryComponent;
  /**
   * Project-owned header-right renderers keyed by the serializable component
   * name in `settings.headerRightItems`. Built-in names are reserved and may
   * not be shadowed. Default: `{}`.
   */
  headerRightComponents?: HeaderRightComponentRegistry;
  /** Per-page git-history meta manifest. Default: `{}` (no Created/Updated block). */
  docHistoryMeta?: Record<string, unknown>;
  /** Sidebar section config. Default: `{}` (auto-generated tree only). */
  sidebarsConfig?: Record<string, unknown>;
  /** Frontmatter preview renderers keyed by field. Default: `{}`. */
  frontmatterRenderers?: Record<string, FactoryComponent>;
  /** Frontmatter preview entry builder. Default: `() => []`. */
  buildFrontmatterPreviewEntries?: (...args: unknown[]) => unknown[];
  /** Footer tag-list loader. Default: `() => []`. */
  loadTagsForLocale?: (...args: unknown[]) => unknown[];
  /** Tag vocabulary for footer columns + the tags area. Default: `[]`. */
  tagVocabulary?: readonly unknown[];
  /** Body-end islands (bootstrap islands). Default: the package-island subset
   *  derived from `settings` (no host-only client-router / token-panel boots). */
  BodyEndIslands?: FactoryComponent;
  /** DocHistory island. Default: a no-op stub rendering an empty fragment. */
  DocHistory?: FactoryComponent;
  /**
   * Design-token panel bootstrap island (#2658). Default: the PACKAGE-DEFAULT
   * `DesignTokenPanelBootstrap` from
   * `@takazudo/zudo-doc/design-token-panel-bootstrap`, statically imported by
   * `chrome/derive.tsx` (`deriveBodyEndIslands`) so EVERY `createChrome`
   * consumer — the injected `routes/_chrome.tsx` path and the locked-manifest
   * self-contained doc stub alike — gets the settings-gated panel island with
   * no explicit wiring (#2659 gate-2 fix; scanner reachability holds through
   * the static route → chrome → derive → bootstrap chain, the #2480
   * contract). Supply this slot only to REPLACE the island with a host's own
   * bootstrap component. Mounting is still gated on
   * `settings.designTokenPanel` inside `createBodyEndIslands` either way.
   */
  DesignTokenPanelBootstrap?: FactoryComponent;
  /** MDX content-component overrides (Details / HtmlPreview / Island /
   *  PresetGenerator). Default: package SSR impls + a `PresetGenerator` stub. */
  mdxExtras?: Record<string, FactoryComponent>;
  /**
   * Extra content rendered inside the doc content header, between the `<h1>`
   * and the metainfo block. A RENDERER (not a component) so it is naturally
   * keyed on the page entry/frontmatter rather than re-deriving them from
   * props. Default: absent → renders nothing (byte-identical output to the
   * pre-seam header). Called for `kind === "entry"` doc pages on all 4 doc
   * routes, INCLUDING versioned pages — it receives `version` and decides for
   * itself whether/how to render on a versioned page.
   */
  docContentHeaderExtras?: (args: {
    entry: DocPageEntry;
    slug: string;
    locale: string;
    isFallback?: boolean;
    version?: string;
  }) => unknown;
  /**
   * Extra content rendered in the home hero. A RENDERER (not a component).
   * Default: absent → renders nothing. The `/` home route is never injected
   * by the routes plugin (zfb rejects `/`), so this binding fires on injected
   * `/[locale]` homes and on any host that threads it through `createChrome`.
   * A `HomePageView` `extras` prop (added in a later task) takes precedence.
   */
  homeExtras?: (args: { locale: string }) => unknown;
}

/**
 * The unified chrome context — the superset that fully wires the page chrome:
 * the reconstructed {@link RouteContext} (settings + i18n + every callable) PLUS
 * the host-supplied component allowlist and the host-bound slots. This single
 * shape governs the package-owned routes today and the host collapse later:
 * `createRouteContext` produces the {@link RouteContext} portion and
 * `createChrome` consumes it together with {@link ChromeHostBindings}, supplying
 * package defaults for the `components` allowlist and every omitted host slot.
 */
export interface ChromeContext<S = Settings> extends RouteContext<S> {
  /** Host-supplied, project-bound component bindings (explicit allowlist). */
  components: FactoryComponents;
  /** Host-bound chrome slots (stub defaults in the injected package path). */
  hostBindings: ChromeHostBindings;
}
