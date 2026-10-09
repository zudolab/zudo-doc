# @takazudo/zudo-doc

Shared layout + content-rendering package consumed by both this repo's showcase
(`workspace:*`) and every project scaffolded by `create-zudo-doc` (published npm).
Components are zudo-react `.tsx` compiled by tsup (`bundle:false`, 1:1 source→`dist/`
so `"use client"` directives survive — see `tsup.config.ts`). The `exports` map
in `package.json` is the API surface; consumers import from `dist/`.

The current public API contract is documented in `API.md` (this directory):
subpath exports, `zudoDocPreset` options (`Settings`), Wind tokens and CSS variables,
`doclayout` slot anchors, and the ejectable component list.

## Note-tray schema and navigation

`src/docs-schema/index.ts` owns the note-tray frontmatter fields. Cross-field and
calendar validation lives in `src/site-schema/note-tray-validate.ts`; shared ordering,
rank, grouping, and date behavior lives in `src/note-tray-model/`. The sidebar,
`NoteTrayIndex`, pager, and home page must consume that shared model rather than
re-deriving tray behavior.

## Build: tsup (JS) + tsc (DTS) — two passes, not one

`build`/`prepare` run **`gen-search-widget-script.mjs`, `gen-nav-overflow-script.mjs`,
`gen-switcher-scripts.mjs`, THEN tsup, THEN `tsc -p tsconfig.build.json`** (`--emitDeclarationOnly`). All three
generators must run first: `gen-search-widget-script.mjs` (#3412) writes
`src/search-widget-script/generated-script.ts` that `search-widget-script/index.ts`
imports, and `gen-nav-overflow-script.mjs` (#3534) writes
`src/header/nav-overflow-generated-script.ts` that `header/nav-overflow-script.ts`
imports — without either, the first tsup/tsc pass fails resolving the missing
`./generated-script.js` / `./nav-overflow-generated-script.js` (both generators
are also wired into `predev` and the tsup `onSuccess` chain for the same
reason). tsup emits only the JS
(`dts:false`); `tsc` emits the `.d.ts`. Switcher scripts are frozen from
`scripts/switcher-script-source.ts`; the generator emits
`src/i18n-version/switcher-generated-scripts.ts`, with drift validation
in the prepack contract. The split exists
because tsup's `dts:true` rollup-based declaration bundler is **combinatorial in
memory across entries** — with `bundle:false` + ~200 source entries it OOMs even
at an 8GB Node heap (the JS pass alone finishes in ~150ms). `tsc
--emitDeclarationOnly` emits per-file 1:1 (same flat layout as the `bundle:false`
JS), is **linear in file count**, and completes under the default ~2GB heap, so
CI no longer needs (and the scripts no longer set) a raised `NODE_OPTIONS` heap.
`tsconfig.build.json` extends `tsconfig.json` with `emitDeclarationOnly`/`outDir:dist`/
`rootDir:src` and excludes test globs so test files don't emit. See zudolab/zudo-doc
epic #2344.

Since zudolab/zudo-doc#3431, `generated-script.ts` is committed to git (a
deliberate departure from the gitignored-generated-file convention below —
see the generator's own header comment) with a `pnpm check:search-widget-drift`
guard (b4push + CI) proving the committed bytes match a fresh regeneration;
`pretest`/`pretypecheck` no longer regenerate it ahead of those runs, so
`test`/`typecheck` exercise whatever is actually checked in. Since
zudolab/zudo-doc#3534, `src/header/nav-overflow-generated-script.ts` is
committed the same way, guarded by the mirrored `pnpm check:nav-overflow-drift`
(b4push + CI, #3535).

`dev` mirrors that same two-pass split as two parallel watchers (#3113):
`dev:js` (`tsup --watch`) and `dev:dts`
(`tsc -p tsconfig.build.json --watch --preserveWatchOutput`), joined by `run-parallel`.
Declarations therefore stay current during package dev — they no longer lag behind
the JS. The two do not fight over `dist/`: they write disjoint extensions, and tsup's
watcher already ignores `dist/`, so the `.d.ts` writes cannot retrigger a JS rebuild.
Three consequences of pairing them:

- tsup runs `clean: !options.watch`, so a watch session does not wipe `dist/` (it could
  not regenerate the `.d.ts` it destroyed). `build`/`prepare` still clean.
- Because nothing cleans under watch, a deleted or renamed source file leaves a stale
  `.js`/`.d.ts` behind — run `pnpm build:workspace` after one.
- `predev` runs `scripts/ensure-workspace-build.mjs` because `dev:dts` typechecks
  `pre-build.ts`, which imports the sibling `@takazudo/zudo-doc-history-server`'s
  `git-history` declarations — on a cold tree that watcher dies immediately with TS2307.
  No-op when warm.

### A watcher exit tears down the whole dev session (accepted, #3129)

`run-parallel` **aborts its sibling** when one task exits non-zero, and root `pnpm dev`
nests this `run-parallel` inside another one
(`run-parallel dev:zfb dev:history dev:claude-watch dev:zudo-doc`). So a fatal `dev:dts`
exit kills `dev:js`, which fails `dev:zudo-doc`, which takes down `zfb dev` and the
doc-history server with it. Two hops, verified against `npm-run-all2@7.0.2` — not
assumed — and preserved deliberately when that dependency was replaced by the
package-owned `bin/run-parallel.mjs` (its header documents the parity).

**This is accepted behaviour, not an open bug.** It is loud and self-announcing:

```
ERROR: "dev:dts" exited with 1.
ERROR: "dev:zudo-doc" exited with 1.
```

and `pnpm dev` returns to the shell prompt. Re-running `pnpm dev` is usually all it takes —
the two exceptions (a startup build error, and inotify exhaustion) are called out below.

**Mid-session, exposure is narrow.** Once a session is up both watchers survive ordinary
work: `tsc --watch` reports type errors and keeps watching, and `tsup --watch` logs a
failed rebuild and keeps watching. So only *fatal* exits cascade — a missing or unreadable
`tsconfig.build.json`, an OOM, or inotify exhaustion.

inotify is a real hazard on WSL2 here, and its two limits surface as **different errno
values**. Match the errno to the limit before tuning, or you will raise a ceiling that was
never the problem:

- **`EMFILE`** → `fs.inotify.max_user_instances` (128 here). This is the one that actually
  bites: orphaned watchers and codex brokers accumulate until `inotify_init` fails.
- **`ENOSPC`** → `fs.inotify.max_user_watches` (524288 here). Much rarer.

Re-running `pnpm dev` fixes neither — free instances or raise the ceiling the errno
actually points at (see the `/codex-sweep` and `/dev-clean-wsl` skills).

**Startup is stricter, and the two watchers differ there.** `tsup --watch` exits non-zero
when its *first* build fails, so launching `pnpm dev` with a syntax error already sitting
in `packages/zudo-doc/src/**` tears the whole session down immediately. `tsc --watch` does
not — it prints the errors and watches anyway. Both verified against the installed
tsup 8.5.1 / TypeScript. This case is instant and self-evident rather than insidious: fix
the syntax error and relaunch. Before #3126 there was a single watcher, so neither shape
of this cascade existed.

**Do NOT "fix" this by adding a `--continue-on-error` equivalent to `run-parallel`.**
(npm-run-all2 spelled it `run-p --continue-on-error`; the replacement deliberately ships
no such flag.) It keeps the surviving watcher
alive, but the dead one then fails *silently*: a dead `dev:dts` leaves `dist/*.d.ts`
frozen at its last-emitted state while the JS keeps updating around it. That is the same
class of `dist`-out-of-sync-with-source problem the paired-watcher split (#3126) was added
to end — and a nastier variant of it. #3113's declarations were *absent* (tsup's
`clean: true` wiped all 285 of them and nothing regenerated them), which fails loudly with
`TS2306`/`TS2724`; frozen declarations instead typecheck cleanly against stale types. A
loud crash you re-run beats a quiet lie.

If the inotify case starts happening for real, the remedy is to supervise the watchers
(restart with capped backoff, **indefinitely**) rather than to continue-on-error. Note
that a supervisor which gives up after N retries but stays alive is the same trap: it
leaves a dev session that looks healthy while its output is knowingly stale.

## Shared-surface (exports / tsup) append convention — package-first migration

The `package.json#exports` map and `tsup.config.ts` are a **shared surface** that
the package-first migration (epic #2321) touches from several parallel tasks
(S3/S4/S7/S8/S9). To keep those edits conflict-free, the convention established
by S2 (#2325) is:

- **New `.ts`/`.tsx` source under `src/**`** (e.g. `src/preset.ts`) is compiled
  automatically by the tsup `entry` globs — **no `tsup.config.ts` edit needed**.
  Just **append one `exports` entry** (a `{ "types", "default" }` pair pointing
  at the matching `dist/*` path). Append it to the **JS subpath group**, right
  before the `.css` static-asset entries at the bottom of the map (the
  `./preset` entry is the current tail of that group — append after it). Order
  within the group is cosmetic; keep one entry per line so parallel diffs touch
  disjoint lines.
- **`exports` cannot carry inline comments** — Node (and esbuild) reject a `"//"`
  key sitting alongside `.`-prefixed subpath keys. So the append point is
  documented here and in `tsup.config.ts`, not as a JSON comment.
- **Source files the tsup globs do NOT match** (e.g. S3's relocated `.mjs`
  plugin wrappers) append at the marked `ENTRY APPEND POINT` in
  `tsup.config.ts#entry`, or copy via the `onSuccess` chain.

### `"./routes-src/*"` must stay in the map (zfb ≥ 0.1.0-next.97)

`exports` carries `"./routes-src/*": "./routes-src/*"` even though nothing
imports that subpath by name. zfb next.97 added a bundler **stage-escape audit**
that rejects any metafile input reached inside a workspace package at a location
the package does not declare — and the routes plugin injects the raw
`routes-src/*.tsx` entrypoints by absolute path (it must: zfb extracts `paths()`
by AST from the `.tsx` source, never from compiled `.js`). Without the wildcard
entry, `zfb build` fails with `SSR work-mirror stage-escape audit failed` naming
every `routes-src/*.tsx` and `_context.ts`. Shipping them via `files[]` alone is
not enough — the audit reads `exports`.

## Factory context type + foundation primitives (epic #2344, S1a)

The package-first Wave 3 migration relocates the `pages/lib/*` rendering/data
modules into this package behind **injected-context factories**. The shared
contract those factories receive is the factory-context TYPE, and the
load-bearing pure primitives they build on ship from S1a. None of these import
node builtins or the host `@/` alias (enforced by `check:no-host-alias-in-package`
and the `foundation-eval-graph` node-free guard).

### `./factory-context` — `FactoryContext` (types only)

Signature **`{ settings, i18n, components, navSource }`** — deliberately NO
generic `utils` bag (a `utils` key would re-couple the factory API to this
project's util surface and defeat the migration). A factory receives exactly
these four typed slots and builds everything else from them.

- **`settings`** — the host's resolved `Settings` object (single config source).
- **`i18n`** (`FactoryI18n`) — `{ defaultLocale, locales, getLocaleLabel, t? }`.
- **`components`** (`FactoryComponents`) — the **allowlist** below.
- **`navSource`** — opaque per-locale nav-source handle (host owns the loader;
  factories pass it to the pure nav builders without inspecting it).

#### ALLOWED `{ components }` slots (explicit allowlist — NOT a dumping ground)

Every key is a component the package CANNOT own because it depends on the host's
content collections / settings wiring / showcase markup. All slots are optional.
Adding a slot requires a real cross-package coupling reason AND an entry here —
do not widen this into a generic component bag.

| Slot | Why it can't live in the package |
|---|---|
| `CategoryNav` | locale-aware; reads the project's content collection |
| `CategoryTreeNav` | locale-aware category-tree wrapper |
| `SiteTreeNav` | locale-aware site-tree wrapper (also serves the demo variant) |
| `HtmlPreview` | bound to the host's preview config |
| `Details` | `<details>` content override |
| `Island` | zfb `<Island>` pass-through (host owns the import so the scanner walks it) |
| `PresetGenerator` | showcase-only SSR shell; downstream projects stub it |

### Foundation primitive exports (S1a)

- **`./render-markdown`** — `renderMarkdown(src)`: the chat-message markdown→HTML
  renderer (escape-first, safe by construction).
- **`./slug`** — `toRouteSlug` / `toHistorySlug` / `toSlugParams` / `toTitleCase`:
  the canonical root-slug rule (#1891 / #1873). The package `md-utils` imports
  `toRouteSlug` from here instead of re-inlining the rule.
- **`./smart-break`** — `isPathLike` / `smartBreak` / `SmartBreak` /
  `escapeAndInjectWbr` / `smartBreakToHtml`. The former toc-local copy
  (`toc/smart-break.tsx`) was consolidated into this single module; toc and
  content overrides import it from here.
- **`./use-modal-dialog`** — `modalDialog(scope, options)` with exported
  `ModalDialogOptions` / `ModalDialogResult`: setup-only dialog synchronization,
  native-close/backdrop callbacks, navigation close and focus return. It is an
  ordinary module; `useModalDialog` is removed. A conditional dialog needs a
  child component/scope inside `Show` so the helper owns its actual element.
- **`./island-types`** — shared island prop/type contracts: `ChatMessage`,
  `DocHistoryData` (+ `DocHistoryEntry`), and the enlarge-dialog shared
  constants (`ENLARGE_DIALOG_STYLE`, `IMAGE_ENLARGE_DIALOG_CLASS`,
  `MERMAID_ENLARGE_DIALOG_CLASS`, `EnlargeDialogProps`).
- **`./url-helpers`** — `makeUrlHelpers(settings, i18n)`: the base.ts URL logic
  parameterized into a constructor (withBase / docsUrl / navHref /
  getPathForLocale / buildLocaleLinks / versionedDocsUrl / …). The host's
  `src/utils/base.ts` keeps the singleton import; the logic lives here.

Host code imports these canonical package subpaths directly. The host
`buildNavTree(entries, lang, categoryMeta, { buildHref })` adapter retains its
explicit `buildHref` injection point for current route construction.

## `./preset` — `zudoDocPreset()`

`src/preset.ts` (exported as `@takazudo/zudo-doc/preset`) returns the zfb config
fragment every project used to hand-write in `zfb.config.ts` — collections loop,
`markdown.features`, dual-theme `codeHighlight`, `resolveMarkdownLinks`,
`stripMdExt`, `trailingSlash`, `minifyHtml`, and the integration `plugins` array. The host
spreads it into `defineConfig` and keeps only the shell fields it still owns
(`port`, `wind`, `bundle`, `base`, `adapter`).

- **Signature:** `zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary })`.
  `buildDocsSchema` and `directiveVocabulary` are **passed in, not imported**, so
  the preset never re-imports the project's `settings` / `tag-vocabulary` /
  `docs-schema` singletons (already in the config eval) and its own import graph
  stays node-builtin-free.
- **Plugins are bare-specifier descriptors** (`{ name: "@takazudo/zudo-doc/plugins/<x>", options }`),
  never imported plugin functions — importing the plugin modules would drag
  their `node:fs`/`node:path` graph into the config eval. All integration plugins
  now resolve via `@takazudo/zudo-doc/plugins/*`; the old project-relative
  `copy-public-plugin.mjs` was removed in #2358 (zfb native `publicDir` replaces it).
- **Node-free eval-graph guard** (`src/__tests__/preset.test.ts`): esbuild-bundles
  `src/preset.ts` with `--platform=neutral` (mirrors zfb's `loader.rs:277`),
  no `external`, and FAILS on any reachable `node:*` builtin. Under
  `platform: neutral` esbuild does NOT shim builtins — an unresolvable `node:*`
  makes `build()` **reject** with a `Could not resolve "node:…"` diagnostic, so
  the guard scans BOTH the rejection's `.errors` AND (defensively) the emitted
  bundle for a literal passthrough. A companion self-test bundles a `node:fs`
  probe to prove the detector stays live (not dead code). Non-negotiable — keep
  it green when adding imports to the preset.
- **`zod` is a required peerDependency.** `preset.ts` imports `zod` for
  `z.toJSONSchema`; with `bundle:false` that bare import ships verbatim in
  `dist/preset.js` and resolves against the consumer's `node_modules`. The host
  already supplies zod (it owns `buildDocsSchema`), so a required peer shares
  that single instance — avoiding a dual-zod hazard for `toJSONSchema` and a
  `Cannot find package 'zod'` at config-eval time in generated projects.
- **`katex` and `diff` are optional peers, and must stay non-build-fatal.**
  `katex` is needed only when `math: true`, and `diff` only for docHistory's
  Compare view. Both are reachable from the always-bundled route graph
  (`mdx-components → math-block`, `_chrome → doc-history`), so each is loaded
  ONLY through a rejection-handled `import("pkg").then(onFulfilled, onRejected)`.
  esbuild leaves that shape unresolved when the package is absent instead of
  failing the build. A static import or a bare `await import()` reintroduces
  `Could not resolve` for consumers without the peer (#4206 / #4209). The
  packed-tarball OPT-KATEX-DIFF case in `route-injection-build.slow.test.ts`
  proves it. Do not use the `addVirtualModule` shadow here: that channel
  carries a HOST-supplied callable/path (`chromeBindingsModule` /
  `designTokenPanelConfigModule` — see `src/plugins/routes.ts`), not a way to
  make an optional npm peer conditional — a virtual module's loader is plain
  ESM source, so a `katex`/`diff` import inside it would still resolve (or
  fail) at build time exactly like a static import does today. The
  rejection-handled `import("pkg").then(...)` pattern above is the actual
  mechanism that keeps the peer optional.
- **Package-owned route injection** (`settings.packageOwnedRoutes`, default
  `true` since #2404) is pinned in `docs/adr/route-injection-seam.md` — the authoritative
  seam spec for the `@takazudo/zudo-doc/plugins/routes` plugin + `routes/*`
  entrypoints (virtual module carries serializable `settings`/`translations`/
  `tagVocabulary`; everything callable is an importable package subpath; package
  routes use `@takazudo/zfb/content`, not the host `zfb/content` tsconfig alias).

## Shipped CSS artifacts and Wind manifest

The current migration target is published zfb family **4.2.1**, peers **^4.2.1**.
The coordinated zudo-doc/create-zudo-doc **6.0.0 is not released**. Source package
versions still read 5.28.2. Upstream zfb #4097 remains an open browser/navigation
gate; do not infer release readiness from these architecture instructions.

`theme.css`, `content.css`, `page-loading.css`, and `features.css` are copied from
`src/` to `dist/` by the tsup `onSuccess` chain. `gen-wind-manifest.mjs` then
produces `dist/wind.json` from compiled JS, and one-shot builds run
`gen-compiled-css.mjs`. Watch builds skip compiled CSS generation. All five CSS
files and `wind.json` have public export subpaths. The former `safelist.css` and
`theme-no-reset.css` exports, generators and imports are removed.

Consumer entry order:

```css
@layer zw-reset, zd-flow;
@import "@takazudo/zudo-doc/theme.css";
@import "@takazudo/zudo-doc/content.css";
@import "@takazudo/zudo-doc/page-loading.css";
@import "@takazudo/zudo-doc/features.css";
```

Add `@takazudo/zdtp/styles.css` only for a panel-enabled consumer. Use public CSS
exports, never physical package `dist/*.css` paths. `theme.css` owns the default
`:root` custom properties and reset-parity/base rules; `content.css` owns the
single `.zd-content` typography/flow contract; `page-loading.css` owns navigation
overlay/pending styles; `features.css` owns highlighting, preview, math, sidebar,
transition, enlarge and history styles. Keep the existing theme-independent
page-loading spinner fallback rather than replacing it with scheme foreground.

`zudoDoc()` supplies the `definePreset`-owned Wind fragment, including
`@takazudo/zudo-doc/wind.json`, var-backed token mappings, `reset: "owned-v1"`,
`dark: false`, and sm/lg/xl breakpoints (640/1024/1280px). Consumers ordinarily
do not register the package manifest themselves. No implicit numeric spacing
scale is enabled. `wind` is a top-level engine option, not a Settings field.
zfb deep-merges a supplied override over defaults; explicit `wind: false`
disables generation. Override variable values in ordinary `:root` rules after
the imports, or mapping values through `zudoDoc({ wind: { tokens: … } })`.

Remove Tailwind imports and directives (`@theme`, `@source`, `@apply`, etc.).
Keep token names, including bare `--color-*` and namespaced `--color-zd-*`; do
not reintroduce the former `--color-*: initial` palette reset. Unsupported Wind
utility forms need authored `zd-` CSS and a coverage disposition. Generated
utilities are unlayered and follow authored CSS: check actual specificity,
hover/focus winners and computed values rather than assuming layer parity.

`compiled.css` is the browser-ready embedding export. Its entry is
`src/compiled.entry.css`. `gen-compiled-css.mjs` invokes native `zfb css` with
`--no-auto-source --code-highlight-mode class` and a temporary config using the
package Wind defaults and strict manifest. It does not scan host content or
package outDir as a substitute for the manifest. Never hand-edit generated
`dist/` files. CSS-only edits do not trigger tsup's source watcher; rebuild the
package when source CSS changes.

`check:prepack-contract` covers static CSS, Wind manifest, compiled CSS, generated
scripts, routes, declarations, browser-safe API graphs and other public artifacts.
Run `pnpm check:package-wind-manifest` and
`pnpm exec zfb wind audit --project-root . --fail-on error` for their distinct
coverage. Native audit needs the error exit flag and does not establish emitted
CSS completeness. Retain authored/emitted-rule tests and browser computed-style
evidence. Historical 3.x source-resolution probes use
`ZFB3_SOURCE_RESOLVE=1`; normal released consumers use the built/packed public
exports and declaration graphs, never stale v2 dist or private source imports.

## Theme-pack nav `:hover` guard — pack-author contract (epic #4032)

**Rule.** A theme pack (`src/theme-packs/*/pack.css`) that authors a nav `:hover` rule
setting `color` **or** `background` MUST exclude `[aria-current="page"]`, on the
**anchor**, in **both** header DOM shapes. Until epic #4032 this rule existed only as a
code comment inside one pack (`blueprint/pack.css`, calling it "the scandi/washi guard
pattern") — tribal knowledge. The survey that drove the epic found 14 packs violating
it and four packs that did guard using the wrong attribute (see the trap below).

**Why.** The active nav item carries the base inverted fill —
`NAV_TOP_ACTIVE = ["bg-fg", "text-bg"]` (`src/header/nav-class-tokens.ts:28`). A pack
selector like `html[data-theme-pack="x"] [data-nav-item]:hover` is unlayered at
specificity `(0,3,1)`, which beats the base Wind `text-bg` rule at
`(0,1,0)`. An unguarded hover therefore repaints the active pill's ink or its
background and collapses the contrast — measured as low as **1.00:1** (identical fg
and bg, text literally invisible) across the packs that shipped this bug.

**Reference pattern** — `src/theme-packs/phosphor/pack.css:241-251` guards both header
DOM shapes:

```css
html[data-theme-pack="phosphor"] a[data-nav-item]:not([aria-current="page"]):hover,
html[data-theme-pack="phosphor"] [data-nav-item-dropdown] > a:not([aria-current="page"]):hover {
  text-decoration: none;
  color: var(--zd-accent);
  ...
}
```

Guarding only the wrapper `[data-nav-item-dropdown]` `div` is **ineffective** — the
colors live on the child `<a>`, and that same child carries `aria-current`
(dropdown-item anchor: `src/header/header.tsx:487`; plain top-level item's own anchor:
`src/header/header.tsx:550`).

**The `data-nav-active` trap.** `:not([data-nav-active])` looks like the same guard
and is not:

- **Never emitted on header nav items** — `header.tsx:487` and `:550` set only
  `aria-current`, never `data-nav-active`. `:not([data-nav-active])` on a header
  selector is a structural no-op; the hover rule runs unguarded regardless of the
  active state.
- **Incomplete on the sidebar** — an active root/category node gets
  `aria-current="page"` at `sidebar-tree-island/index.tsx:766` WITHOUT
  `data-nav-active` (`:767` sets it only when `!isRoot && isActive`, i.e. never on a
  root). observatory, washi, riso, and sakura shipped exactly this guard and still
  failed on an active category row — this exact mistake is why it propagated to four
  packs.

Guard with `:not([aria-current="page"])`, and only that, on both the header and the
sidebar.

**Audit-gated exception.** A rule that sets `color` **and** `background` together
replaces the pill wholesale rather than tinting the existing fill. Several packs
(sakura, scandi, bauhaus, drift's header rule) do this deliberately, unguarded, and
measure AA-clean. Do not "fix" these by adding a guard on sight — omitting the guard
here is correct **only while `pnpm theme-a11y:audit` proves the state green**. The
audit is the arbiter, not the shape of the rule.

**A second trap: descendant color.** A pack's anchor-level `color` reaches only what
inherits from it. Card-style links can put their own ink on a `group-hover:text-fg` /
`group-hover:text-accent` utility class on a descendant `<span>`, which wins over the
anchor's inherited color — a fix that only recolors the anchor reads correct in a
static look at the rule and is still wrong on screen. `brutalist/pack.css:389-414` is
the concrete case: the prose-link hover rule (`:400-407`) needed a companion
`… a:hover *` rule (`:408-414`) to actually reach the note-tray card spans it shares a
selector with. This is why `pnpm theme-a11y:audit` renders real pages and reads
computed styles instead of computing contrast from CSS declarations alone.

Which ink those descendants should carry is fixed by the Link Color Rule in `src/CLAUDE.md` (rule 3: card links sit at `text-fg`, descendant icons/spans follow via `group-hover:text-accent` / `group-focus-visible:text-accent`) — a pack override must reach them the same way.

See also: the `color-scheme-a11y` skill's "Theme-pack nav `:hover` guard" section and
`TESTING.md`'s "Theme A11y Audit" section for the verification tooling.

## Shipped ambient type shims + tsconfig base (#2656, minimal-scaffold epic #2651)

Three files ship from the **package root** (not `dist/`) so a downstream
project's tsconfig can pull them in with almost no boilerplate of its own.
Two are hand-authored and checked into git (`tsconfig.base.json`,
`zfb-config-shim.d.ts`); the third (`virtual-modules.d.ts`) is **generated**
at build time. Consumer-level regression proof (running tsc/`zfb check`
against a real fixture project that extends the base) is deliberately NOT
duplicated here — it is the Wave-5 central confirm case (#2659), which must
exercise the self-referencing `import("@takazudo/zudo-doc/factory-context")`
specifier end-to-end.

1. **`tsconfig.base.json`** — exported as `@takazudo/zudo-doc/tsconfig.base.json`.
   A project extends it (`"extends": "@takazudo/zudo-doc/tsconfig.base.json"`)
   and keeps `include` plus any required project-local aliases (see below).
   Carries every `compilerOptions` flag the pre-package-first project template
   (`packages/create-zudo-doc/templates/base/tsconfig.json`) hand-rolled
   (strict + `noImplicit*` set, `target`/`module`/`moduleResolution`, `jsx:
   "react-jsx"` + `jsxImportSource: "@takazudo/zfb/zudo-react"`, …), **plus** a top-level `files: ["./zfb-config-shim.d.ts",
   "./virtual-modules.d.ts"]` to pull in the two ambient shims below.
   - **MUST ship the shims via `files`, never `include`.** `files`/`include`/
     `exclude` are all **override-only across `extends`** (the inheriting
     config's value replaces the base's; a base value applies only when the
     project declares none of its own). That makes a base-level `include`
     wrong in BOTH directions — spike #2652 Q5: an extends-only project
     tsconfig inherits ONLY the base's shim-`include`, so the project's own
     files are silently never typechecked (a planted error passed `zfb
     check`); conversely a project that declares its own `include` silently
     discards the base's, dropping the shims. Shipping via base `files` works
     because the project tsconfig declares `include` (its own file set) but
     no top-level `files`, so the base's `files` is inherited intact
     alongside it.
   - **Consumer caveat (same override rule): a project extending the base
     must NOT declare its own top-level `files`** — doing so replaces the
     base's and silently drops both shims from the program (surfacing later
     as confusing TS2307s on `zfb/config` / `virtual:*` imports). The
     documented project-tsconfig shape (below) uses only
     `extends`/`include`/`compilerOptions.paths`.
   - **Deliberately carries NO `paths`.** See the GOTCHA below.
   - `scripts/check-shim-artifacts.mjs` (prepack) asserts this shape (no
     `include`/`exclude`, `files` at the top level — not nested in
     compilerOptions, TS5023 — and exactly these two entries) so the traps
     above can't silently regress.

2. **`zfb-config-shim.d.ts`** — exported as `@takazudo/zudo-doc/zfb-config-shim.d.ts`.
   The ambient `declare module "zfb/config"` a project previously had to
   copy-paste as a local `zfb-shim.d.ts` (183 lines). **No hand-sync duty
   (since #3237)**: the shim re-exports `@takazudo/zfb/config` (`export *`)
   rather than restating its shape, so it carries no fields of its own and
   tracks whatever `@takazudo/zfb` version the consumer has installed
   automatically. It previously WAS a hand-copied subset and drifted twice —
   `bundle` (Takazudo/zudo-front-builder#678 / zudolab/zudo-doc#1834) and
   then 12 top-level fields including `copyPublicWithBase` (#3237) — each
   drift failing a valid config field with TS2353. That class of bug is now
   structurally impossible: there is nothing left to lag. Do NOT add a
   top-level `import`/`export` to this file (outside the `declare module`
   block) — that would turn it into a module and the block would stop being
   ambient. This is the ONLY copy — the pre-#2656 per-project
   `zfb-shim.d.ts` files (root and `templates/base/`) were deleted when the
   cutover completed (epic #2651 Wave 7 #2663; see `e2e/CLAUDE.md`), so there
   is no dual-copy sync duty left. Consumers reach the shim transitively via
   `tsconfig.base.json`'s `files`.

3. **`virtual-modules.d.ts`** — exported as `@takazudo/zudo-doc/virtual-modules.d.ts`.
   Ambient declarations for `virtual:zudo-doc-route-context` and
   `virtual:zudo-doc-chrome-bindings` — the two zfb virtual modules the routes
   plugin injects at build time (no on-disk source, so an importing HOST file
   needs an ambient `declare module` or `zfb check` fails TS2307). Needed once
   a project's tsconfig `include` covers `pages/` (the minimal-scaffold floor
   does this on purpose, unlike the pre-#2656 template which excludes
   `pages/` and so never typechecked it) and `pages/` contains a file that
   imports one of these virtuals directly (e.g. a `pages/index.tsx` re-export
   stub calling `createRouteContext(routeContext)`).
   - **GENERATED, not hand-authored — no sync duty.** Built from the single
     source of truth `src/routes/_virtual.d.ts` by
     `scripts/copy-virtual-modules.mjs` (tsup `onSuccess`), which prepends a
     do-not-edit banner and rewrites the parent-relative `import(...)` type
     specifier to the bare `@takazudo/zudo-doc/factory-context` subpath —
     the same rewrite `copy-routes-src.mjs` applies, for the same reason (the
     shipped copy resolves types from a consumer's node_modules). Gitignored
     like `routes-src/`, published via `files[]`/`exports`. To change the
     virtual-module contract, edit `src/routes/_virtual.d.ts` and rebuild —
     never edit the generated file. `scripts/check-virtual-modules.mjs`
     (prepack) guards presence + the rewritten specifier.

4. **Chrome bindings are the public customization boundary.**
   `defineChromeBindings` type-checks exact call-side props for all six primary
   components (`Header`, `Footer`, `Sidebar`, `Toc`, `Breadcrumb`, `DocPager`)
   and carries named `headerRightComponents` separately from serializable
   `settings.headerRightItems`. Omitted keys retain package defaults. Fresh
   base/i18n stubs consume the virtual object; the generator's doc-history
   patch must spread it before replacing only `DocHistory`. Components declared
   only inside the virtual module are SSR-presentational unless a separate
   static island registration path exists. A host island with session-scoped
   props (for example, a badge nested under the persisted header) can opt out
   of the nested-island props refresh with `data-zd-props-preserve` on the
   island or an ancestor inside the persisted root. The live side governs; the
   attribute on the persisted root is a blanket opt-out for every nested
   island, and an opted-out island receives neither a props write nor a forced remount
   flag.

### Owned JSX and project-local aliases

The base owns `jsxImportSource: "@takazudo/zfb/zudo-react"`. Remove React→Preact
compatibility paths and React/Preact type imports. Use `Child`, `Description`,
`Component<P>` and `JSX.IntrinsicElements` from the owned runtime. Preact remains
only for the optional zdtp 0.8.5 peer (`^10.29.1`) and its opaque subtree; zdtp's
internal Tailwind browser dependency does not become a host engine dependency.

A host alias still needs a project-local `baseUrl` because inherited relative
paths resolve against the file that declares them:

```json
{
  "extends": "@takazudo/zudo-doc/tsconfig.base.json",
  "include": ["src", "pages", "zfb.config.ts"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

Do not override the base's top-level `files`: it owns the config and virtual
module declarations. A showcase importing `#doc-history-meta` adds its own path
to `.zfb/doc-history-meta.json`; the minimal floor has no such alias requirement.

### Fixed-target host boundaries and browser imports

`DocHistory` and `DesignTokenPanelBootstrap` overrides are server boundaries
that statically import one named client target, own the Island mount and return
a Fragment. Do not hand a dynamic raw client target to package code for wrapping.
`BodyEndIslandsDeps.ThemePackSwitcher` follows the same rule. Package settings
gates and override precedence remain; panel configuration belongs in
`designTokenPanelConfigModule` unless replacing the actual island implementation.

Use `DocHistoryBoundary` from `./doc-history-area` for the standard history slot.
Its `ssrFallback` is extracted on the server and never becomes client JSON props.
Existing fallback exports at `./image-enlarge` and `./mermaid-enlarge` remain
public through ordinary facades. Island transport accepts finite JSON scalars,
dense arrays and plain records; explicitly omit absent object members and use
the same normalized props for SSR/client. Reject functions, signals, descriptions,
dates/classes, cycles, getters, symbols and undefined array elements. Never use
a JSON round trip or serializer-only omission to hide invalid props.

Browser-safe defaults live internally in `settings-defaults.ts` and are re-exported
by `./config`; the config/preset evaluation graph itself is not a browser-import
recipe. `./settings` is types-only. Use `./route-context-payload` for browser-safe
payload building and `./site-schema` for engine-free site semantics. The root
barrel is type-only. Client entries must not import host virtual modules.

Persisted island props are refreshed before native teardown at `zfb:before-swap`,
writing only the detached incoming document. Unchanged identity/props preserve
native scope state; changed identity/props recreate it. Live `data-zd-props-preserve`
keeps exact old transport only when identities match. Unsafe structure/scheduling
changes remove incoming persistence; do not reintroduce blanket remount flags.

### Doc-history self-seed (`.zfb/doc-history-meta.json`)

`plugins/internal/doc-history`'s `preBuild` hook (`runDocHistoryMetaStep`, in
`src/plugins/internal/doc-history/pre-build.ts`) already unconditionally writes
`.zfb/doc-history-meta.json` — creating the `.zfb/` directory if absent —
before every build, whether populated from git history or short-circuited to
`{}` under `SKIP_DOC_HISTORY=1`. No code change was needed for #2656: this
was already a "self-seed when absent" behavior (confirmed by spike #2652 Q6
and pinned by the existing `pre-build-manifest.test.ts` suite, whose
`beforeEach` always starts from a fresh temp dir with no `.zfb/`). The
scaffold-floor implication is that a project can stop committing
`.zfb/doc-history-meta.json` and its `.gitignore` un-ignore lines outright —
the plugin recreates it on every build. `SKIP_DOC_HISTORY=1` and CI
full-manifest behavior are unaffected (see the repo root `CLAUDE.md` "Doc
History Architecture" decision table — this wave changes none of it).

## Localized generated-resource and asset routes

Claude/Codex resource generators keep detail MDX in the default `docsDir`, but emit their overview and category-index MDX into every configured locale directory. Route enumeration exposes the default-locale detail entries at every configured locale path unless `defaultLocaleOnlyPrefixes` opts a resource prefix out. Those detail routes are intentional body fallbacks: they use localized sidebar, breadcrumb, header, and language-switcher chrome, but suppress the ordinary untranslated-page banner because the configured default locale owns the canonical source dump.

The generated overview and category-index targets are generator-owned. An existing index with `generated: true` may be refreshed, but the generator refuses to overwrite an authored target file. Remove or rename the authored index and express its title, description, and labels through `ZudoDocConfig.translations`.

Do not copy resource detail MDX into locale directories. The body is the canonical source dump owned by the configured default locale; its language follows the source corpus and is not necessarily English. For this repository's measured resource corpus, copies would duplicate roughly 530 KB per additional locale on disk and again as untruncated text in every `dist/{locale}/llms-full.txt`, because `plugins/internal/llms-txt/load.ts` scans physical locale directories. Search and locale `llms.txt` therefore include localized overview pages but omit fallback-only details. This matches other fallback content. Search bodies are capped at `MAX_BODY_LENGTH` characters (default 3000, configurable via `searchMaxBodyLength`) by `search-index/types.ts`, so search-index size is not the reason for the body-ownership decision.

Asset index and leaf routes are likewise enumerated for every configured locale at `/{locale}/${assetViewerRoutePrefix}/...`. Every generated asset href must carry its active locale; a valid fallback to the unprefixed route is still a regression. Both route families use the regular language switcher and remain unversioned.

Resource shell labels resolve from `resource.*`; asset viewer and index labels resolve from `asset.*`. Both namespaces flow through merged `ZudoDocConfig.translations`. Only English and Japanese are complete built-ins; all other supported locale codes resolve requested locale → configured default → package English → literal key. To restore default-locale-only behavior, consumers add `/${assetViewerRoutePrefix}/` and/or the desired resource prefixes to `defaultLocaleOnlyPrefixes`; these prefixes are not package defaults.
