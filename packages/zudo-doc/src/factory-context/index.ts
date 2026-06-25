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

import type { Settings } from "../settings.js";

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
