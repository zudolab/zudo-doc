# ADR: Package-owned route-injection seam

Status: **Accepted** (A0, epic Package-First Finale #2356 / sub-issue #2357).
Implemented by A1 (#2361). Supersedes the route-injection sketch in #2361.

## Context

The package-first migration moved every `pages/lib/*` rendering/data module into
`@takazudo/zudo-doc` behind injected-context factories. The remaining host
surface is the ~16 `pages/*.tsx` route stubs themselves. The goal of this seam is
to let `@takazudo/zudo-doc` **own the doc routes** so a generated project can ship
an (almost) empty `pages/`, while keeping the current stubs and gating the new
path behind a dormant flag.

zfb `0.1.0-next.62` provides the mechanism: a plugin's `setup(ctx)` hook exposes
`ctx.injectRoute(pattern, entrypoint)` (prerendered at BUILD) and
`ctx.addVirtualModule(specifier, loader)`. `injectRoute` is **build-only** today —
the dev router only logs injected matches and falls through (upstream
Takazudo/zudo-front-builder#1227). So injection is gated OFF by default and the
existing `pages/` stubs stay; with the flag off the build is byte-unchanged.

## Decisions

### 1. How a package entrypoint obtains project context

A new package-shipped plugin `@takazudo/zudo-doc/plugins/routes` is added by the
preset's `buildPlugins()` as a **bare-specifier descriptor** (never an imported
function — preserves the node-free config eval-graph guard). Its `setup(ctx)`:

1. Calls `ctx.addVirtualModule("virtual:zudo-doc-route-context", loader)` where
   the loader returns ESM source exporting a **serializable** payload:
   `settings` (pure data — verified no function-valued fields), the host UI-string
   `translations` table, and `tagVocabulary`. Shape:
   `export const routeContext = { settings, translations, tagVocabulary };`
   (`JSON.stringify` of `plugin.options`, which the preset fills from settings).
2. Calls `ctx.injectRoute(pattern, entrypoint)` for each derived route (Decision 3),
   in the **same hook**.

Every package route **entrypoint** (`@takazudo/zudo-doc/routes/*`) imports the
**serializable config** from the virtual module and the **importable
registries/defaults** from package subpaths — never raw host functions, never
`@/` aliases. It reconstructs the full injected context from those two sources.

Host-injected dependencies in the current stubs and how each is reproduced
package-side **without `@/`** (all already exist as package factories/pure fns):

| Host stub injects | Package-side reproduction (no `@/`) |
|---|---|
| `buildNavTree`, `collectAutoIndexNodes`, `groupSatelliteNodes`, `isNavVisible`, `loadCategoryMeta` | `@takazudo/zudo-doc/sidebar-tree` (+ the package `docs` helpers); `buildNavTree` accepts the optional `buildHref` injection |
| `buildBreadcrumbs` | `@takazudo/zudo-doc/sidebar-tree` |
| `extractHeadings` | `@takazudo/zudo-doc/extract-headings`, called with `tocMinDepth`/`tocMaxDepth`/`headingIdStrategy` read from the virtual-module `settings` |
| `toRouteSlug`, `toSlugParams`, `toHistorySlug`, `toTitleCase` | `@takazudo/zudo-doc/slug` (pure) |
| `collectTags` / `resolveTag` | `@takazudo/zudo-doc/tag-helpers`, parameterized by `settings` + `tagVocabulary` from the virtual module |
| category-metadata loading | `loadCategoryMeta` from `@takazudo/zudo-doc/sidebar-tree` (memoized per resolved dir) |
| `getNavSectionForSlug`, `getNavSubtree`, `getCategoryOrder` | `@takazudo/zudo-doc/nav-scope`, parameterized by `settings.headerNav` |
| URL helpers (`withBase`, `docsUrl`, `versionedDocsUrl`, `navHref`, `isDefaultLocaleOnlyPath`) | `makeUrlHelpers(settings, i18n)` from `@takazudo/zudo-doc/url-helpers` |
| `mergeLocaleDocs` | `@takazudo/zudo-doc/locale-merge` (pure) |
| `stableDocs` / identity-stable docs (content bridge) | rebuilt in the entrypoint from `@takazudo/zfb/content` `getCollection`/`getContentSnapshot` + the package's `memoizeDerived` (`@takazudo/zudo-doc/nav-source-cache`) — same snapshot-anchored `WeakMap` pattern (Decision 5) |
| `resolveNavSource`, `resolveVersionedLocaleSource`, `loadNavSourceDocs` | `createNavSourceDocs(ctx)` from `@takazudo/zudo-doc/nav-source-docs` |
| `buildDocRouteEntries` | `createDocRouteEntries(ctx)` from `@takazudo/zudo-doc/doc-route-entries` |
| route enumeration (sitemap) | `createRouteEnumerators(ctx)` from `@takazudo/zudo-doc/route-enumerators` |
| `t` / `getLocaleLabel` / `defaultLocale` / `locales` (i18n) | reconstructed as a `FactoryI18n` from virtual-module `settings` + `translations` (i18n is entirely settings-derived except the UI-string table, which rides in the virtual module) |
| `components` allowlist (`CategoryNav`, `CategoryTreeNav`, `SiteTreeNav`, `HtmlPreview`, `Details`, `Island`, `PresetGenerator`, …) | the package `mdx-components` factory builds the locale-bound nav wrappers + extras from injected `settings` + active `locale`; these are **package defaults**, not host functions in the virtual module. Showcase-only slots (`PresetGenerator`) get a package stub. The serializable virtual module carries **no component functions**. |

Rule: **virtual module = serializable data only** (`settings`, `translations`,
`tagVocabulary`). **Everything callable is an importable package subpath.** No
host function and no Preact component ever travels through the virtual module.

### 2. zfb content import specifier from inside the package

The host's `zfb/content` is a **tsconfig `paths` alias** (`tsconfig.pages.json`),
typecheck-only and host-scoped — it does **not** resolve from
`node_modules/@takazudo/zudo-doc/dist`. The package must use the **real published
specifier `@takazudo/zfb/content`** (exports map `./content` →
`./dist/content.js`), exactly as the package's own components already import
`@takazudo/zfb` / `@takazudo/zfb/plugins`. `@takazudo/zfb/content` exports
`getCollection`, `getContentSnapshot`, `setContentSnapshot` as real runtime
functions reading `globalThis.__zfb.contentSnapshot`; node resolution finds the
sibling `@takazudo/zfb` package, so `getCollection` is callable at build (and,
once upstream dev rendering lands, at dev). Confirmed against zfb
`0.1.0-next.62`.

### 3. Pattern → entrypoint derivation (route catalog: 16 routes)

`setup()` derives patterns from `settings.locales` / `settings.versions`.
zfb route grammar matches `pages/` filenames.

Static / always-on:

- `/` → root index entrypoint
- `/404` → 404 entrypoint
- `/sitemap.xml` → sitemap entrypoint (uses `createRouteEnumerators`)
- `/robots.txt` → robots entrypoint
- `/docs/[[...slug]]` → default-locale doc catch-all
- `/docs/tags` and `/docs/tags/[tag]` → gated on `settings.docTags`
- `/api/ai-chat` → SSR route, injected with `opts.prerender: false`, gated on `settings.aiAssistant`

Per non-default locale (`Object.keys(settings.locales)`), for each `{locale}`:

- `/[locale]` → locale index
- `/[locale]/docs/[[...slug]]`
- `/[locale]/docs/tags` and `/[locale]/docs/tags/[tag]` (docTags)
- `/[locale]/docs/versions` (when versions configured)

Versions (`settings.versions`):

- `/docs/versions` (+ `/[locale]/docs/versions`)
- `/v/[version]/docs/[[...slug]]`
- `/v/[version]/[locale]/docs/[[...slug]]`

The `[locale]` / `[version]` dynamic params are **single patterns** whose
`paths()` enumerates the concrete locale/version values — A1 injects the dynamic
pattern once, not one per concrete value (matching how the current stubs work).

### 4. The dormant `settings.packageOwnedRoutes` gate

Add `settings.packageOwnedRoutes?: boolean` (default **false**) to the package
`PresetSettings` and the showcase `src/config/settings.ts`. `buildPlugins()` adds
the routes-plugin descriptor **only when true**. Decision: **internal/advanced —
do NOT surface it in `create-zudo-doc` settings-gen or the e2e fixtures this
epic.** A fast-follow flips it on. (Add a `.fixture-settings-drift-allowlist`
entry with a `# reason:` comment so the drift check stays green, since it is not
mirrored into fixtures.)

### 5. Memoization preservation

The entrypoint's content bridge must reproduce the **snapshot-anchored
`WeakMap`** pattern (`pages/lib/_nav-source-cache.ts` `stableDocs`): anchor the
memo on `getContentSnapshot().collections[name]` (the one array stable across the
whole build), so every repeat caller within a build gets the **same** bridged +
draft-filtered array instance, and `buildNavTree`'s identity fast-path +
`buildDocRouteEntries`'s `memoizeDerived` short-circuit. No-snapshot
(fs-fallback / unit tests) path stays unmemoized. `memoizeDerived` already ships
from `@takazudo/zudo-doc/nav-source-cache`; A1 reuses it and adds the
`stableDocs` anchor inside the package (it now imports `@takazudo/zfb/content`
directly rather than the host `zfb/content` alias).

### 6. Precedence / no-op

`injectRoute` drops a package route whose URL shape collides with an existing
user `pages/` route — **user `pages/` wins, injected dropped, silently**
(zfb `0.1.0-next.62` `injectRoute` doc). With the flag dormant **and** the stubs
present, flipping `packageOwnedRoutes` on in a real project is therefore a clean
no-op: every injected route collides with the kept stub and is dropped. Harmless
and reversible — the seam can be enabled for testing without changing output
while the stubs exist.

## Consequences

- A1 (#2361) implements `packages/zudo-doc/src/plugins/routes.ts`, the package
  route entrypoints under `packages/zudo-doc/src/routes/*`, the
  `packageOwnedRoutes` settings field, the preset wiring, and the new
  `package.json#exports` entries (append convention).
- Flag-off ⇒ byte-unchanged build; the node-free preset eval-graph guard stays
  green (descriptor is a bare specifier).
- Dev rendering of injected routes remains a no-op until the upstream zfb dev
  pipeline lands; verify package routes via `zfb build`.
