# @takazudo/zudo-doc

Shared layout + content-rendering package consumed by both this repo's showcase
(`workspace:*`) and every project scaffolded by `create-zudo-doc` (published npm).
Components are Preact `.tsx` compiled by tsup (`bundle:false`, 1:1 source→`dist/`
so `"use client"` directives survive — see `tsup.config.ts`). The `exports` map
in `package.json` is the API surface; consumers import from `dist/`.

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
  their `node:fs`/`node:path` graph into the config eval. `copy-public` stays a
  project-relative `./plugins/copy-public-plugin.mjs` descriptor (not relocated).
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

## Shipped CSS artifacts (three)

tsup only compiles `.ts/.tsx`. CSS is produced by the tsup `onSuccess` hook
(runs after every build/`--watch`, because `clean:true` wipes `dist/` first):

```
onSuccess: "node scripts/copy-content-css.mjs && node scripts/copy-page-loading-css.mjs && node scripts/gen-safelist.mjs"
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

`prepack` guards all three (`check-safelist.mjs && check-content-css.mjs && check-page-loading-css.mjs`)
so a build that skipped the `onSuccess` step fails loudly instead of publishing a package
whose `./content.css` / `./safelist.css` / `./page-loading.css` export 404s for consumers.
