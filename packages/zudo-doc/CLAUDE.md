# @takazudo/zudo-doc

Shared layout + content-rendering package consumed by both this repo's showcase
(`workspace:*`) and every project scaffolded by `create-zudo-doc` (published npm).
Components are Preact `.tsx` compiled by tsup (`bundle:false`, 1:1 source→`dist/`
so `"use client"` directives survive — see `tsup.config.ts`). The `exports` map
in `package.json` is the API surface; consumers import from `dist/`.

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

The host originals `src/utils/{render-markdown,slug,smart-break}` are now thin
re-export shims pointing at these subpaths (kept so the many `@/utils/*` call
sites — and their byte-identical create-zudo-doc template copies — stay
unchanged). `buildNavTree(entries, lang, categoryMeta, { buildHref })` in
`src/utils/docs.ts` gained an optional `buildHref` injection point
(backward-compatible — existing 3-arg call sites are unchanged).

## `./preset` — `zudoDocPreset()`

`src/preset.ts` (exported as `@takazudo/zudo-doc/preset`) returns the zfb config
fragment every project used to hand-write in `zfb.config.ts` — collections loop,
`markdown.features`, dual-theme `codeHighlight`, `resolveMarkdownLinks`,
`stripMdExt`, `trailingSlash`, and the integration `plugins` array. The host
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
- **Package-owned route injection** (dormant, `settings.packageOwnedRoutes`,
  default off) is pinned in `docs/adr/route-injection-seam.md` — the authoritative
  seam spec for the `@takazudo/zudo-doc/plugins/routes` plugin + `routes/*`
  entrypoints (virtual module carries serializable `settings`/`translations`/
  `tagVocabulary`; everything callable is an importable package subpath; package
  routes use `@takazudo/zfb/content`, not the host `zfb/content` tsconfig alias).

## Shipped CSS artifacts (four)

tsup only compiles `.ts/.tsx`. CSS is produced by the tsup `onSuccess` hook
(runs after every build/`--watch`, because `clean:true` wipes `dist/` first):

```
onSuccess: "node scripts/copy-content-css.mjs && node scripts/copy-page-loading-css.mjs && node scripts/copy-features-css.mjs && node scripts/gen-safelist.mjs"
```

1. **`dist/content.css`** ← copied verbatim from `src/content.css` by
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
     NOT live here — they are emitted by the `htmlOverrides` components in
     `src/content/` (Tailwind classes + inline styles). `content.css` owns only
     what those components don't emit.
   - **Editing**: change `src/content.css`, then rebuild the package so
     `dist/content.css` updates. `tsup --watch` does NOT re-copy on a bare
     `.css` change (it only watches `.ts/.tsx`), so re-run `pnpm build` after
     editing the stylesheet.

2. **`dist/safelist.css`** ← generated by `scripts/gen-safelist.mjs`, which
   scans the compiled `dist/**/*.js` for Tailwind class candidates and emits a
   single `@source inline(...)`. Exported as `@takazudo/zudo-doc/safelist.css`.
   Consumers import it so the utilities the components emit (which the consumer's
   own Tailwind scanner can't see inside `node_modules`) are generated.

3. **`dist/page-loading.css`** ← copied verbatim from `src/page-loading.css` by
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

4. **`dist/features.css`** ← copied verbatim from `src/features.css` by
   `scripts/copy-features-css.mjs`. Exported as `@takazudo/zudo-doc/features.css`.
   Contains all **non-island** feature CSS that every project using the package
   needs: code block buttons, syntect/shiki dual-theme token color rule,
   `.zd-html-preview-code`, KaTeX, desktop sidebar toggle geometry, and
   view-transition chrome. Island-coupled CSS (enlarge / ai-chat / diff) stays
   in the project's `global.css` until a later epic moves it. See zudolab/zudo-doc#2331.
   - **Consumer contract**: must @import AFTER `@takazudo/zudo-doc/content.css`
     and `@takazudo/zudo-doc/page-loading.css` (the `@import` order in
     `global.css` is: `@takazudo/zdtp/styles.css`, `content.css`,
     `page-loading.css`, `features.css`). Cascade order matters: features.css
     rules are unlayered and rely on the token definitions from `@theme` which
     must precede this file in the compiled output.
   - **Editing**: change `src/features.css`, then rebuild the package. `tsup
     --watch` does NOT re-copy on a bare `.css` change — re-run `pnpm build`.

`prepack` guards all four (`check-safelist.mjs && check-content-css.mjs && check-page-loading-css.mjs && check-features-css.mjs`)
so a build that skipped the `onSuccess` step fails loudly instead of publishing a package
whose `./content.css` / `./safelist.css` / `./page-loading.css` / `./features.css` export 404s for consumers.
