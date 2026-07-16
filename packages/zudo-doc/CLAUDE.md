# @takazudo/zudo-doc

Shared layout + content-rendering package consumed by both this repo's showcase
(`workspace:*`) and every project scaffolded by `create-zudo-doc` (published npm).
Components are Preact `.tsx` compiled by tsup (`bundle:false`, 1:1 source→`dist/`
so `"use client"` directives survive — see `tsup.config.ts`). The `exports` map
in `package.json` is the API surface; consumers import from `dist/`.

The frozen 1.0 public API contract is documented in `API.md` (this directory):
subpath exports, `zudoDocPreset` options (`Settings`), `@theme` design tokens,
`doclayout` slot anchors, and the ejectable component list.

## Build: tsup (JS) + tsc (DTS) — two passes, not one

`build`/`prepare` run **tsup THEN `tsc -p tsconfig.build.json`** (`--emitDeclarationOnly`).
tsup emits only the JS (`dts:false`); `tsc` emits the `.d.ts`. The split exists
because tsup's `dts:true` rollup-based declaration bundler is **combinatorial in
memory across entries** — with `bundle:false` + ~200 source entries it OOMs even
at an 8GB Node heap (the JS pass alone finishes in ~150ms). `tsc
--emitDeclarationOnly` emits per-file 1:1 (same flat layout as the `bundle:false`
JS), is **linear in file count**, and completes under the default ~2GB heap, so
CI no longer needs (and the scripts no longer set) a raised `NODE_OPTIONS` heap.
`tsconfig.build.json` extends `tsconfig.json` with `emitDeclarationOnly`/`outDir:dist`/
`rootDir:src` and excludes test globs so test files don't emit. `dev` stays
`tsup --watch` (JS only — types lag during package dev; `pnpm check` is the type
gate). See zudolab/zudo-doc epic #2344.

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
- **`./use-modal-dialog`** — `useModalDialog(...)`: the shared `<dialog>` modal
  hook (open/close sync, native-close callback, backdrop click, SPA-navigation
  close, opt-in focus management). Carries `"use client"`. The S3/S4 enlarge /
  ai-chat / doc-history islands import it.
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
(`framework`, `port`, `tailwind`, `bundle`, `base`, `adapter`).

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
- **Package-owned route injection** (`settings.packageOwnedRoutes`, default
  `true` since #2404) is pinned in `docs/adr/route-injection-seam.md` — the authoritative
  seam spec for the `@takazudo/zudo-doc/plugins/routes` plugin + `routes/*`
  entrypoints (virtual module carries serializable `settings`/`translations`/
  `tagVocabulary`; everything callable is an importable package subpath; package
  routes use `@takazudo/zfb/content`, not the host `zfb/content` tsconfig alias).

## Shipped CSS artifacts (five)

tsup only compiles `.ts/.tsx`. CSS is produced by the tsup `onSuccess` hook
(runs after every build/`--watch`, because `clean:true` wipes `dist/` first):

```
onSuccess: "node scripts/copy-theme-css.mjs && node scripts/copy-content-css.mjs && node scripts/copy-page-loading-css.mjs && node scripts/copy-features-css.mjs && node scripts/gen-safelist.mjs"
```

1. **`dist/theme.css`** ← copied verbatim from `src/theme.css` by
   `scripts/copy-theme-css.mjs`. Exported as `@takazudo/zudo-doc/theme.css`.
   Ships the project's **default `@theme` token block** (colors including the
   `--color-*: initial` tight-token guardrail, spacing, icon sizes, elevation,
   typography, radius, breakpoints, and the 13 default `--z-index-*` tiers)
   plus a handful of project-agnostic base rules (scroll-margin, selection
   color, focus ring, search/find-in-page highlight, version-switcher
   visibility). Introduced by zudolab/zudo-doc#2655 (epic #2651, Wave 3) so a
   project's own `global.css` no longer has to hand-carry ~250 lines of
   boilerplate token declarations.
   - **Consumer contract**: must `@import` AFTER `@layer zd-preflight,
     zd-flow;` + the two Tailwind imports (which stay project-side — see
     `packages/create-zudo-doc/templates/base/src/styles/global.css`), and
     BEFORE `safelist.css`/`content.css`/`page-loading.css`/`features.css`
     (all four consume the `@theme` tokens declared here) and before the
     project's own token-override `@theme { … }` block (later
     declarations win). The `--color-page-loading-overlay` scrim token is
     deliberately NOT included — it stays feature-injected by a project's
     `dynamicPageTransition` wiring.
   - **Z-index defaults**: the 13 `--z-index-*` tiers baked into `theme.css`
     mirror `defaultZIndexTiers` (`@takazudo/zudo-doc/z-index-defaults`,
     #2654). A project's own `src/config/z-index-tokens.ts` +
     `gen:z-index`/`check:z-index` codegen is now opt-in — only needed when a
     project overrides a tier (its own `@theme` block, declared after this
     import, simply redefines the specific token it wants to change).
   - **Editing**: change `src/theme.css`, then rebuild the package so
     `dist/theme.css` updates. `tsup --watch` does NOT re-copy on a bare
     `.css` change (it only watches `.ts/.tsx`), so re-run `pnpm build` after
     editing the stylesheet.

2. **`dist/content.css`** ← copied verbatim from `src/content.css` by
   `scripts/copy-content-css.mjs`. Exported as `@takazudo/zudo-doc/content.css`.
   This is the **single source of truth for `.zd-content` content typography**
   (flow-space rhythm, headings' `--flow-space`, minor elements, admonitions,
   mermaid layout). Both the showcase `src/styles/global.css` and the
   `create-zudo-doc` template `@import` it instead of inlining the rules — this
   is what killed the old showcase↔template copy-drift (zudolab/zudo-doc#2188).
   - **Consumer contract** (documented in full at the top of `src/content.css`):
     the consumer must declare `@layer zd-preflight, zd-flow;`, define the
     `@theme` design tokens the rules consume (`--color-*`, `--spacing-*`,
     `--text-*`, `--font-*`, `--leading-*`, `--radius-DEFAULT`), and also import
     `safelist.css` so the component-emitted utility classes are generated.
   - Major-element visuals (h2–h4, p, a, strong, blockquote, ul, ol, table) do
     NOT live here — they are emitted by the `defaultComponents` map in
     `src/content/` (Tailwind classes + inline styles). `content.css` owns only
     what those components don't emit.
   - **Editing**: change `src/content.css`, then rebuild the package so
     `dist/content.css` updates. `tsup --watch` does NOT re-copy on a bare
     `.css` change (it only watches `.ts/.tsx`), so re-run `pnpm build` after
     editing the stylesheet.

3. **`dist/safelist.css`** ← generated by `scripts/gen-safelist.mjs`, which
   scans the compiled `dist/**/*.js` for Tailwind class candidates and emits a
   single `@source inline(...)`. Exported as `@takazudo/zudo-doc/safelist.css`.
   Consumers import it so the utilities the components emit (which the consumer's
   own Tailwind scanner can't see inside `node_modules`) are generated.

4. **`dist/page-loading.css`** ← copied verbatim from `src/page-loading.css` by
   `scripts/copy-page-loading-css.mjs`. Exported as `@takazudo/zudo-doc/page-loading.css`.
   Provides the full visual contract for the page-loading overlay, spinner, and
   pending-navigation link indicator. Consumers `@import` it alongside the
   `<PageLoadingOverlay>` component rather than inlining these rules per-project.
   - **Consumer contract**: the stylesheet consumes host tokens
     `--color-page-loading-overlay` (falling back to
     `color-mix(in oklch, var(--color-overlay, #000) 60%, transparent)`),
     `--color-fg` (spinner border; falls back to `#fff`), `--color-accent`
     (pending-nav link colour), and `--z-index-modal` (overlay stack level;
     falls back to `100`). All tokens are optional — bare consumers get sensible
     defaults.
   - **Editing**: change `src/page-loading.css`, then rebuild the package so
     `dist/page-loading.css` updates. `tsup --watch` does NOT re-copy on a bare
     `.css` change (it only watches `.ts/.tsx`), so re-run `pnpm build` after
     editing the stylesheet.

5. **`dist/features.css`** ← copied verbatim from `src/features.css` by
   `scripts/copy-features-css.mjs`. Exported as `@takazudo/zudo-doc/features.css`.
   Contains **all** feature CSS every project using the package needs,
   island-coupled or not: code block buttons, Shiki dual-theme token
   color rule, `.zd-html-preview-code`, KaTeX, desktop sidebar toggle
   geometry, view-transition chrome (epic #2331), and — since S4 of epic
   #2344 — the `.ai-chat-md`/`.zd-enlargeable`/`.zd-mermaid-enlargeable`
   island CSS and the docHistory diff-viewer (`.diff-row`/`.diff-line-*`)
   rules. All of it ships unconditionally (dead-weight cost accepted per the
   Minimal Scaffold plan, zudolab/zudo-doc#2655) so a project's `global.css`
   needs no per-feature `@slot` anchor for CSS — only the `@takazudo/zdtp`
   stylesheet `@import` stays conditional (gated on `designTokenPanel`,
   since it pulls in zdtp's own bytes and can't be made unconditional).
   - **Consumer contract**: must @import AFTER `@takazudo/zudo-doc/theme.css`,
     `content.css`, and `page-loading.css` (the `@import` order in
     `global.css` is: `theme.css`, `safelist.css`, `content.css`,
     `page-loading.css`, `features.css`). Cascade order matters: features.css
     rules are unlayered and rely on the token definitions from `@theme` which
     must precede this file in the compiled output.
   - **Editing**: change `src/features.css`, then rebuild the package. `tsup
     --watch` does NOT re-copy on a bare `.css` change — re-run `pnpm build`.

`prepack` guards all five (`check-theme-css.mjs && check-safelist.mjs && check-content-css.mjs && check-page-loading-css.mjs && check-features-css.mjs`)
so a build that skipped the `onSuccess` step fails loudly instead of publishing a package
whose `./theme.css` / `./content.css` / `./safelist.css` / `./page-loading.css` / `./features.css` export 404s for consumers.

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
   and keeps only `include` (+ a tiny `paths` block — see the GOTCHA below).
   Carries every `compilerOptions` flag the pre-package-first project template
   (`packages/create-zudo-doc/templates/base/tsconfig.json`) hand-rolled
   (strict + `noImplicit*` set, `target`/`module`/`moduleResolution`, `jsx:
   "preserve"`, …), **plus** a top-level `files: ["./zfb-config-shim.d.ts",
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
   copy-paste as a local `zfb-shim.d.ts` (183 lines). **Hand-sync duty**: this
   is the type source of truth `zfb check` binds `zfb.config.ts` against, and
   it must be kept in sync BY HAND with the published `@takazudo/zfb/config`
   (`dist/config.d.ts`) — a lagging shim fails valid config fields with TS2353
   (see Takazudo/zudo-front-builder#678 / zudolab/zudo-doc#1834, where
   `bundle` was missing here and blocked next.22's `bundle.exclude`). When
   bumping the pinned `@takazudo/zfb` version, diff its `dist/config.d.ts`
   against this file. The pre-#2656 per-project copy (root `zfb-shim.d.ts`,
   `packages/create-zudo-doc/templates/base/zfb-shim.d.ts`) is untouched by
   this wave — those cut over to the package-shipped copy in a later wave
   (showcase migrates in Wave 6 of epic #2651); until then, edits to the
   `declare module "zfb/config"` body must land in BOTH the old per-project
   copies and this file, or `zfb check` drifts between consumers on the old
   vs. new path.

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
   static island registration path exists.

### GOTCHA — preact/compat `paths` stay in the PROJECT tsconfig, not the base

The pre-package-first template mapped `react` / `react-dom` /
`react/jsx-runtime` to `./node_modules/preact/compat/…` — a path relative to
the **consumer project's** `node_modules`. TS resolves a relative `baseUrl`/
`paths` value relative to the tsconfig FILE IT ORIGINATED IN, not the file
that (transitively) extends it. So if that `paths` block lived in
`tsconfig.base.json`, `./node_modules/preact/compat/` would resolve inside
`node_modules/@takazudo/zudo-doc/node_modules/…` — wrong, and generally
absent (preact is hoisted to the consumer's own top-level `node_modules`).
This matters because the project template's `jsx: "preserve"` mode still
needs JSX-namespace types resolved through the `"react"` specifier for every
`.tsx` file — without a correct mapping, `zfb check` fails to resolve
`"react"` on ANY JSX file (there's no real `react` package installed; this is
a preact-only project).

**Resolution (locked, verified empirically against the base tsconfig in a
scratch fixture): keep the `react*`/`@/*` `paths` block in the PROJECT's own
tsconfig, alongside its OWN `baseUrl: "."`.** A project extending the base
must declare both:

```jsonc
{
  "extends": "@takazudo/zudo-doc/tsconfig.base.json",
  "include": ["src", "pages", "zfb.config.ts"],
  "compilerOptions": {
    // Re-declaring baseUrl here is REQUIRED, not cosmetic: the inherited
    // baseUrl from the base ("." resolved against the base file's own
    // directory, i.e. inside node_modules) would otherwise anchor these
    // paths in the wrong place. A project-local baseUrl makes "." resolve
    // against THIS file's directory (the project root) instead.
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "react": ["./node_modules/preact/compat/"],
      "react/jsx-runtime": ["./node_modules/preact/jsx-runtime"],
      "react-dom": ["./node_modules/preact/compat/"]
    }
  }
}
```

The `#doc-history-meta` path alias is intentionally NOT part of this block —
per spike Q6, nothing in the minimal floor imports `#doc-history-meta`
(package-owned routes get `docHistoryMeta` via the optional
`chromeBindingsModule` channel, defaulting to `{}`); a project that keeps a
host `pages/lib/_chrome.ts` stub importing the alias adds its own `paths`
entry pointing at `.zfb/doc-history-meta.json`, same as before.

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
