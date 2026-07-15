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
| `extractHeadings` | `@takazudo/zudo-doc/extract-headings`, called with `tocMinDepth`/`tocMaxDepth` read from the virtual-module `settings`; heading IDs are always hierarchical |
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

> **Status update (#2518):** default-on since #2404 — the "dormant" framing
> below is historical.

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

### Island registration under injected routes (DocHistory) — #2480

zfb registers a client island only when the `"use client"` module is reachable
from the scanned page/route import graph. Most package islands (BodyEndIslands,
SearchWidget, enlarge/mermaid) are imported directly by the package factories, so
the injected route graph reaches them. **DocHistory is the exception**: it is a
host-bound slot (`ctx.hostBindings.DocHistory`, default a no-op stub in
`chrome/derive.tsx`), so nothing statically imported the real
`@takazudo/zudo-doc/doc-history` island on the injected path. `DocHistoryArea`
still emitted a `data-zfb-island-skip-ssr="DocHistory"` marker → the marker had
**no matching registry entry** and the History button never hydrated under
`packageOwnedRoutes: true` + `docHistory: true`.

Fix (#2480): the injected chrome shim `routes/_chrome.tsx` **statically imports**
the real `DocHistory` island and threads it via `createChrome(routeCtx, { DocHistory })`
— the same "island-scanner contract" the host `pages/lib/_chrome.ts` documents.
The import MUST stay static (a dynamic/type-only import stops zfb's scanner from
walking it). SSR output is unchanged (the island is skip-SSR and `DocHistoryArea`
gates on `settings.docHistory`), so no host `_register-islands.ts` re-export is
needed — the package registers the island itself. Regression coverage:
`__tests__/route-injection-build.test.ts` (Case DH + the published-shape guard in
the no-src case).

- **`diff` peer implication:** `DocHistory` carries a lazy `import("diff")`.
  Statically importing it pulls `diff` into the injected chrome scan graph for
  every `packageOwnedRoutes: true` project — identical to the pre-existing host
  path. `diff` is already an **optional** `peerDependency` and generated projects
  ship it; `docHistory: true` consumers need it regardless. A hand-assembled
  `packageOwnedRoutes` consumer with `docHistory: false` and no `diff` may now
  need `diff` resolvable at build. This is an accepted tradeoff — you cannot keep
  the static import (required for scanner reachability) *and* avoid bundling
  DocHistory when the feature is off.

### Host-callables channel — `chromeBindingsModule` (#2501)

Under `packageOwnedRoutes: true`, hosts had **no way to pass
`ChromeHostBindings`** at all: the injected chrome shim `routes/_chrome.tsx`
called `createChrome(routeCtx, { DocHistory })` with everything else at stub
defaults, and Decision 1 forbids callables in the route-context virtual module.
So the host-bound slots (`frontmatterRenderers`,
`buildFrontmatterPreviewEntries`, `SearchWidget`, `loadTagsForLocale`, …)
silently stayed stranded on injected routes — e.g. the FrontmatterPreview table
never rendered there (`buildFrontmatterPreviewEntries` defaults to `() => []`).

Decision: a host module **PATH is a string** — serializable — so it rides
`settings` without violating the data-only rule. New optional setting
`settings.chromeBindingsModule?: string`, a project-root-relative path (e.g.
`"./src/chrome-bindings.tsx"`) to a host module with a **named export
`chromeBindings`**, built with `defineChromeBindings()` from
`@takazudo/zudo-doc/chrome-bindings` (#2693 — a typed adapter that per-slot
prop-checks the bindings and returns `ChromeHostBindings`, replacing the old
`as ChromeHostBindings` cast). The routes plugin's `setup(ctx)` registers a
SECOND virtual module, `virtual:zudo-doc-chrome-bindings`, that **re-exports**
the host module; the bundler imports the actual callables through that
re-export. `routes/_chrome.tsx` imports it and spreads the result AFTER the
`DocHistory` default:
`createChrome(routeCtx, { ...defineChromeBindings({ DocHistory }), ...chromeBindings })`
— so a host can override every slot, including DocHistory itself.

- **Data-only rule holds.** Only the PATH is serialized into `settings` (and
  thus into the route-context virtual module); the chrome-bindings virtual
  module is loader-emitted ESM source (a one-line re-export), not JSON payload.
- **Registered UNCONDITIONALLY** — the shim always imports the specifier.
  Setting absent → the loader emits `export const chromeBindings = {};` and
  behavior is byte-identical to before. Setting present but the resolved file
  missing → the plugin **throws at setup**, naming the resolved absolute path
  and the setting name (never a silent empty fallback).
- **Staging interaction.** The staged `routes-src/` copy
  (`<projectRoot>/.zudo-doc/routes-src/`, see the STAGING note in
  `plugins/routes.ts`) lives outside `node_modules`, so this virtual module
  resolves from the staged shim the same way
  `virtual:zudo-doc-route-context` already does. The emitted re-export
  specifier is an absolute path (forward slashes), so it resolves identically
  from the workspace, staged, and published shapes.
- **SSR-presentational contract only.** Client islands defined INSIDE the
  bindings module are NOT guaranteed to register on injected routes — scanner
  reachability through the virtual re-export is not part of the contract
  (contrast the #2480 static `DocHistory` import above, which IS on the
  scanner's static-import graph). Hosts needing a hydrating island on injected
  routes still need a statically-imported registration path.

Regression coverage: `__tests__/route-injection-build.test.ts` (Case CB — the
FrontmatterPreview table appears with the setting, stays absent without it, and
the missing-file error names the resolved path).

### Design-token-panel config channel — `designTokenPanelConfigModule` (#2658)

Closes the last feature-island gap on injected routes: package-owned routes
had no `DesignTokenPanelBootstrap` mount at all (the pre-#2658 `doc-body-end-
islands/index.tsx` deliberately omitted it — the zdtp `PanelConfig` was a
441-line host-owned file with no package-side equivalent), so
`designTokenPanel: true` did nothing under `packageOwnedRoutes`.

Decision (decision wave #2653, "Approach (a)"): ship a **package-default**
`PanelConfig` builder (`@takazudo/zudo-doc/design-token-panel-config`,
`buildDesignTokenPanelConfig(mode)`) derived from the shipped token manifest
and the bundled `defaultColorSchemes`, so the panel works with **no host
config file**. A host that wants full customization still can, via a THIRD
optional setting, `settings.designTokenPanelConfigModule?: string` — the
**exact same mechanics** as `chromeBindingsModule` above: a project-root-
relative path to a host module with a named export
`buildDesignTokenPanelConfig`, re-exported through a THIRD virtual module,
`virtual:zudo-doc-design-token-panel-config`, registered unconditionally by
the same `setup(ctx)` hook.

- **Data-only rule holds**, same as `chromeBindingsModule` — only the PATH
  travels through `settings`.
- **Registered UNCONDITIONALLY.** Setting absent → the loader re-exports the
  PACKAGE DEFAULT (`export { buildDesignTokenPanelConfig } from
  "@takazudo/zudo-doc/design-token-panel-config";` — NOT an empty fallback,
  since there is no meaningful "empty" `PanelConfigBuilder`). Setting present
  but the resolved file missing/empty-string/a-directory → the plugin
  **throws at setup**, naming the resolved absolute path and the setting name
  (never a silent fallback to the package default) — all three guard cases
  mirror `chromeBindingsModule`'s exactly.
- **Different from `chromeBindingsModule` in one important way: scanner
  reachability IS part of this contract.** Unlike the chrome-bindings channel
  (SSR-presentational only — see the caveat above), the real
  `DesignTokenPanelBootstrap` **island component** is NOT itself carried
  through the config virtual module — it is a separate, statically-imported
  component (`@takazudo/zudo-doc/design-token-panel-bootstrap`). Only the
  PanelConfig *data* (mode-scoped builder) travels through the
  `designTokenPanelConfigModule` re-export; the component itself is always
  reachable by zfb's island scanner regardless of whether a host configured
  this setting.
- **Slot default lives at the chrome seam (gate-2 fix, Wave-5 confirm
  #2659).** The static import + slot wiring sit in `chrome/derive.tsx`'s
  `deriveBodyEndIslands` — `hostBindings.DesignTokenPanelBootstrap` DEFAULTS
  to the package island — not in `routes/_chrome.tsx`. Originally the wiring
  mirrored the #2480 `DocHistory` shape (explicit threading in
  `routes/_chrome.tsx` only), which left any OTHER `createChrome` caller —
  specifically the locked-manifest self-contained doc stub (#2653), which
  calls `createChrome(routeCtx)` with no `hostBindings` — silently emitting
  NO panel island under `designTokenPanel: true` (the confirm gate's blocking
  finding on #2658). Defaulting at the seam gives every consumer the
  settings-gated island with zero explicit wiring, while the component slot
  still accepts a host override. If a host supplies a whole `BodyEndIslands`
  override, the derive seam composes the package-owned panel island alongside
  it; the host override does not replace or duplicate the panel mount.
  Consequence: `@takazudo/zudo-doc/chrome` now
  transitively imports `virtual:zudo-doc-design-token-panel-config`, so a
  `packageOwnedRoutes: false` host that bundles chrome must register/alias
  that module itself (the package vitest config aliases it to the package
  default for fast tests).
- **`@takazudo/zdtp` dep implication:** the same static import that makes
  `DesignTokenPanelBootstrap` the seam default (`chrome/derive.tsx`, ~line
  55) makes `@takazudo/zdtp` an **unconditional build-time dependency** of
  every `createChrome` consumer — even `designTokenPanel: false` projects
  (the "Could not resolve '@takazudo/zdtp'" failure class from #2660). Same
  shape as the `diff` peer implication above: only RENDERING is gated on the
  setting, not the import, and there is no way to keep the static import
  (required for scanner reachability) *and* avoid bundling zdtp when the
  feature is off. This is the ACCEPTED, permanent contract per #2668. The
  generator's unconditional `"@takazudo/zdtp"` dependency in
  `generatePackageJson()` (`packages/create-zudo-doc/src/scaffold.ts`) is the
  corresponding scaffold-side guarantee — without it `zfb build` fails with
  the same error even on a fully barebone project.
- **Mode-scoped BUILDER, not a resolved config** (#2610): the virtual module
  re-exports a `(mode: "light" | "dark") => PanelConfig` function, never a
  plain object — `@takazudo/zudo-doc/design-token-panel-bootstrap`'s
  `DesignTokenPanelBootstrap` island passes it straight to
  `bootstrapDesignTokenPanel`, which rebuilds the panel per light/dark mode on
  every `color-scheme-changed` toggle.
- `storagePrefix: "zudo-doc-tweak"` is preserved unchanged in the package
  default (the existing user-save carry-over guarantee) — a host overriding
  via `designTokenPanelConfigModule` may choose its own prefix if desired.

Regression coverage: `__tests__/route-injection-build.slow.test.ts` (Case DTP
— exactly one island marker + a client-bundle registry match with and without
a host body-end override, the host's builder reaching the bundle with the
setting, and the missing-file error naming the resolved path);
`plugins/__tests__/routes.test.ts` (fast,
isolated `setup()` coverage of all three guard cases without a full build);
`design-token-panel-config/__tests__/index.test.ts` (the package-default
builder's tab structure, mode-scoping, and the unchanged `storagePrefix`).
