# zfb v3.0.0 contract cheat-sheet (for the zudo-doc v3 migration)

Label: v3-contract. Written 2026-09-30. Sources are the zfb repo at tag `v3.0.0` (== origin/main == 8219310917c4e697a5c9eb292bd68b4ae7a7cefc), the published npm tarballs, and the published linux-x64 `zfb` 3.0.0 binary. Everything was run in scratch only. Nothing in $HOME/repos/** was modified.

Scratch layout (all paths are under `<planning-scratch>/explore/v3-contract/`):
- `docs/`: `git show v3.0.0:<file>` dumps of every zudo-wind, zudo-react, concepts and migrating-to-v3 page (98 files, 15,182 lines)
- `pkgs/`: `npm pack` tarballs and extracted `@takazudo/zfb@3.0.0`, `zfb-runtime@3.0.0`, `zfb-md-wasm@3.0.0`, `zfb-linux-x64-gnu@3.0.0`
- `pkgs/probe1.mjs`, `probe3.mjs`, `probe4.mjs`: renderer probes (renderToString against the packed dist)
- `pkgs/probe-md2.mjs`: md-wasm compile, then render through zudo-react
- `pkgs/proj1..3/`: scratch wind projects used for `zfb wind explain`, `zfb wind audit` and `zfb css`

Labels used below: **MEASURED** means a command produced the fact, and the command is shown. **SPEC** means the frozen spec text says so. **DOC** means the v3 docs say so. **INFERRED** means I read code but did not execute it.

Authority order used by upstream: owner ledger, then the spec/contract, then the docs. The docs were reconciled to the implementation by #3309. Where a doc and the binary disagree, this sheet records what the binary does.

---

## 0. Package / export surface (MEASURED)

Commands: `npm view @takazudo/zfb@3.0.0 exports --json`, and so on. Key order in `npm view` output is **not** trustworthy. Read the tarball `package.json` instead: `npm pack @takazudo/zfb-md-wasm@3.0.0` followed by `python3 -c 'json.load(...)["exports"]["./highlight"]'`. The tarball keeps `workerd` ahead of `browser` and `default`. npm view prints `default` first.

| Package | Exports | Deps / peers |
|---|---|---|
| `@takazudo/zfb@3.0.0` | `.`, `./config`, `./content`, `./plugins`, `./runtime`, `./slugify`, `./paginate`, `./frontmatter`, `./package.json`, **`./zudo-react`, `./zudo-react/jsx-runtime`, `./zudo-react/jsx-dev-runtime`, `./zudo-react/server`, `./zudo-react/client`** | No deps or peers. optionalDependencies are the platform binaries `@takazudo/zfb-{darwin-arm64,darwin-x64,linux-arm64-gnu,linux-x64-gnu,win32-x64-msvc}@3.0.0`. bin `zfb` → `./bin/zfb.mjs` |
| `@takazudo/zfb-runtime@3.0.0` | `.`, `./server`, `./snapshot`, `./client-router` (unchanged set) | peer `@takazudo/zfb: "3.0.0"` (exact). **The `react` peer is gone** (2.22.1 had `react ^19.2.3`). dep `hono ^4.12.25` |
| `@takazudo/zfb-md-wasm@3.0.0` | `.`, `./parse` (workerd/browser/default), `./render`, `./highlight` (workerd/browser/default) | deps: mdast types only |
| `@takazudo/zfb-adapter-cloudflare@3.0.0` | `.`, `./build`, with no changes | |

Removed from the `@takazudo/zfb` root: `ANONYMOUS_COMPONENT_NAME`. Removed from island.ts: `PROPS_DATA_ATTR`, `captureComponentName`, `captureSerializableProps`. The deprecated `ReactNode` type alias is removed. `VNode`, `VNodeArray` and `VNodeObject` remain as broad input types (`git diff v2.22.1 v3.0.0 -- packages/zfb/src/index.ts packages/zfb/src/jsx-types.ts packages/zfb/src/island.ts`).

Removed from zfb-runtime: the `FrameworkAdapter` type, and `createPageRouter({ framework })`. The router now imports `renderToString` from `@takazudo/zfb/zudo-react/server` directly (`git diff v2.22.1 v3.0.0 -- packages/zfb-runtime/src/router.ts`).

New on every plugin hook context: `ctx.scratchDir`. It is an absolute path, `<scratch root>/plugins`, which defaults to `<projectRoot>/.zfb-build/plugins`. zfb does not create it. It must not be used for importable modules or injected routes. The `--scratch-dir` CLI flag isolates concurrent commands, but only if a plugin writes its intermediates there (`git diff v2.22.1 v3.0.0 -- packages/zfb/src/plugins.ts`; docs `concepts/plugins.mdx` lines 58-82). This matters for zudo-doc plugins that write to `.zudo-doc/` or similar project-root dirs.

`zfb --version` (MEASURED, `pkgs/bin-linux/package/zfb --version`) prints `zfb 3.0.0` followed by `embedded esbuild: 0.25.12`. There is no Tailwind line.

Config keys removed (config.rs `REMOVED_TOP_LEVEL_KEYS`) are `tailwind` and `framework`. Either key is a hard error, and the check runs on the merged preset+user config, so **presets must be upgraded first**. Exact messages:
- `the tailwind key was removed in zfb 3; utilities are compiled by the built-in zudo-wind engine. Replace tailwind: { enabled: false } with wind: false, or delete the key. See the v3 migration guide`
- `the framework key was removed in zfb 3; delete the key. zfb now uses zudo-react.`

Env vars removed: `ZFB_TAILWIND_BIN` and `ZFB_TAILWIND_OXIDE_WARMUP`.

md-wasm: the `jsxRuntime` option is removed from `compile()`/`renderHtml()`. It is a typed error, and JSON calls get an unknown-field error. Compiled MDX now imports `jsx`, `jsxs` and `Fragment` from `@takazudo/zfb/zudo-react/jsx-runtime` (MEASURED: `node pkgs/probe-md.mjs` prints `import { jsx as _jsx, jsxs as _jsxs } from "@takazudo/zfb/zudo-react/jsx-runtime"`). All four `.wasm` SHA-256 digests changed. zudo-doc's recorded digests and pins must be refreshed.

---

## 1. zudo-wind (spec v1 rev 2)

### 1.1 Config shape (SPEC W27; TS `packages/zfb/src/config.ts` `WindConfig`)

```ts
wind?: false | {
  spec?: 1;                                   // only 1
  reset?: "none" | "minimal-v1" | "owned-v1"; // default "none"
  tokens?: {                                  // every map defaults to {}
    spacingUnit?: string;   // single nonnegative dimension or 0; NOT %, calc(), var()
    colors?: Record<string,string>;        // -> --zw-color-*
    spacing?: Record<string,string>;       // -> --zw-spacing-*
    sizes?: Record<string,string>;         // -> --zw-size-*
    fontSizes?: Record<string,{ size: string; lineHeight?: string }>; // -> --zw-font-size-*, paired --zw-font-size-N-leading
    fontFamilies?: Record<string,string>;  // -> --zw-font-family-*
    fontWeights?: Record<string,string>;   // -> --zw-font-weight-*
    lineHeights?: Record<string,string>;   // -> --zw-leading-*
    letterSpacings?: Record<string,string>;// -> --zw-tracking-*
    radii?: Record<string,string>;         // -> --zw-radius-*
    shadows?: Record<string,string>;       // -> --zw-shadow-*
    zIndices?: Record<string,string>;      // -> --zw-z-*   (integers only, or var())
    easings?: Record<string,string>;       // -> --zw-ease-*
  };
  breakpoints?: Record<string,{ minWidthPx: number }>; // positive integer px, unique widths
  dark?: false | { attribute: string; value: string }; // default false; attribute [a-z][a-z0-9-]*
  safelist?: Record<string,string[]>;     // owner id -> full candidates (strict)
  authoredClasses?: Record<string,true>;  // exact full tokens exempt from utility parsing
  manifests?: Record<string,{ path: string }>; // producer id -> manifest file
}
```

- An **absent `wind` key behaves exactly like `wind: {}`**: generation is enabled, reset is `none`, and there are no tokens. Unknown keys, `null`, `true`, wrong types, `spec: 2`, and duplicate breakpoint widths are all ZW007.
- `wind: false` disables generation, token validation, manifests and candidate scanning in build, dev and `zfb css`. Authored CSS, CSS Modules and highlight still run. **The ZW009 leftover-directive check still runs.**
- Merge rules (config.rs `deep_merge` / `merge_object`, which is presence-aware and user-wins): objects merge recursively. For the same safelist owner, the **user array replaces** the preset array; arrays are never concatenated. Distinct safelist owners and manifest producers coexist. `authoredClasses` unions by key. There is no per-entry delete sentinel. `wind: false` (user) replaces the whole preset object. Only the top-level `plugins`, `collections`, `extraWatchPaths` and `allowedHosts` arrays are additive.
- Preset-declared manifests: `definePreset(sourcePackage, config)` stamps each `wind.manifests[x]` with an internal `__zfb_source_package`. The manifest path therefore resolves relative to **the preset package**, via `zfb_config_loader::resolve_package_dir` (`packages/zfb/src/config.ts` lines 1405-1455; `crates/zfb/src/commands/css_source_plan.rs` `resolve_manifest_path`). Bare specifiers resolve through the package exports map. `./` and `../` paths are relative to the declaring package or project. This is how zudo-doc's preset should ship its candidate manifest.

### 1.2 Tokens (SPEC; DOC tokens.mdx)

- **Nothing is implicit.** There is no palette, spacing unit, named scale, font, radius, shadow, easing or breakpoint. Language constants are `0`, `px`, `full`, `auto`, `screen`, the fraction forms, and each family's static keywords.
- Token names (G13): lowercase `[a-z0-9]` segments joined by single hyphens, starting and ending alphanumeric (`neutral-50`, `2xl` and `hsp-md` are OK). **Uppercase `DEFAULT` is rejected**. Use `default`, which is allowed only in `radii` and `shadows`, where it backs bare `rounded` and `shadow`. The explicit `rounded-default` also works.
- Shared namespaces must be **disjoint**: `spacing`∩`sizes` (sizing roots check sizes first, then spacing), `colors`∩`fontSizes` (both use the `text-` root), and `fontFamilies`∩`fontWeights` (both use the `font-` root). Numeric-looking keys and reserved static suffixes (`colors.center`, `radii.full`, `spacing.auto`) are rejected. A fontSizes key may not end in `-leading`.
- Values are validated with Lightning CSS against the consuming property. A value containing `var()` is accepted as **category-unverified** and flagged by explain. Values may not reference `--zw-*`. `inherit`/`initial`/`unset`/`revert`/`revert-layer`, `!important`, `;`, braces and `url()` are rejected.
- Emission: all configured tokens (used or not) go into `@layer zw-tokens { :root { ... } }`, sorted by category and then name. `spacingUnit` becomes `--zw-spacing-unit`. Numeric spacing is computed exactly (decimal, not float): `p-1.5` with a 0.25rem unit gives `0.375rem`. Named spacing emits `var(--zw-spacing-NAME)`.
- Theming pattern (SPEC): point the token at a project property (`colors.accent = "var(--color-accent)"`) and switch `--color-accent` under `[data-theme=dark]`. Nested theme scopes must also override `--zw-color-*` on the scoped element, because the inherited custom-property reference resolves on the defining element.

### 1.3 Candidate grammar (SPEC G01-G18; MEASURED with `zfb wind explain`)

`candidate = {variant ":"} ["-"] utility ["/" N]`. Brackets, parens and quotes are balanced before any `:` or `/` split.

- **Canonical variant order** is `responsive → dark → relation(group-/peer-) → state → pseudo-element → utility`, with at most **one of each category**. So "stacked variants" are allowed; a repeated category is not. A wrong order gives ZW003 plus a suggestion (MEASURED: `hover:sm:block` gives ZW003). A duplicate gives ZW003 with no suggestion (MEASURED: `hover:focus:block` gives ZW003).
- **Responsive**: only configured names, as min-width `@media (min-width: Npx)`, and `max-NAME` as `@media (width < Npx)`. The width is in px and ignores the root font size. An unconfigured name gives ZW002 (MEASURED: `md:block` with only sm and lg configured gives ZW002). **`print:`, `motion-reduce:`, `motion-safe:`, `contrast-*`, `portrait:` and the like do not exist** (MEASURED: `print:hidden` and `motion-reduce:transition-none` give ZW002).
- **dark**: exists only when `wind.dark` is configured. The selector is `:where([ATTR="VAL"], [ATTR="VAL"] *)`, which adds zero specificity and matches on self or any ancestor. When dark is not configured, `dark:x` gives **ZW002** (MEASURED in `pkgs/proj2` with no `dark`: `ZW002 error ... unknown or unconfigured variant`).
- **States** (rank order): `first`, `last`, `open` (`:is([open], :popover-open)`), `focus-within`, `hover`, `focus`, `focus-visible`, `active`, `disabled`. Every hover, including group-hover and peer-hover, is wrapped in `@media (hover: hover)`. **These do not exist**: `checked`, `visited`, `target`, `empty`, `odd`, `even`, `only`, `first-of-type`, `required`, `invalid`, `placeholder-shown`, `enabled`, `read-only`, `has-*`, `not-*`, `in-*`, `*:` (MEASURED: `peer-checked:block` gives ZW002).
- **Relations**: only unnamed `group-STATE` (the ancestor has class `group`) and `peer-STATE` (a preceding sibling has class `peer`), with the same state set. The selectors are `:where(.group:S) C` and `:where(.peer:S) ~ C`. **Named `group/x` and `group-hover/x` give ZW004** (MEASURED). The `group` and `peer` markers are standalone classes that emit no CSS, and a variant on a marker gives ZW004.
- **Pseudo-elements**: `before`, `after`, `marker`, `placeholder`, `backdrop`. There is **no implicit `content`**, and no `content-[...]` utility exists (MEASURED: `before:content-['']` resolves to an *ordinary class*, which is silently no CSS). `selection:`, `file:` and `first-line:` do not exist.
- **Rejected** (ZW004): `aria-*:`/`data-*:`/`data-[..]:` variants; arbitrary-selector variants `[&_a]:`; arbitrary properties `[prop:val]`; `!x`/`x!` important forms; and the recognized-unsupported families `ring-*`, `animate-*`, `scale-*` and `transform*` (MEASURED: all of these give ZW004).
- **Opacity modifier**: `/0`-`/100` integers on colour utilities (and bracket colours) only. It emits `color-mix(in oklab, V N%, transparent)`. `/N` on other families gives ZW005.
- **Fractions**: only on sizing and translate roots, as `calc(100% * N / D)`. `size-1/2` sets both dimensions.
- **Arbitrary values `[...]`**: allowed on a supported root when Lightning CSS validates the value for that family. `_` becomes a space (inside strings too). `\_` is a literal underscore. `url()` is always rejected. **Ambiguous shared-root values fail ZW005**: `text-[var(--x)]` could be colour or size (MEASURED: `text-[var(--x)]` gives ZW005). `bg-[var(--x)]` is OK, and `text-[1.5rem]` and `text-[red]` are OK. The fix is to name a token.
- **Negatives** are allowed only on inset (not `auto`), margin (not `auto`), space-x/y, z (not `auto`), tracking, outline-offset, translate, rotate and scroll-margin. `-p-2` gives ZW005.
- **CLI gotcha (MEASURED)**: `zfb wind explain -mt-2` fails with a clap error, `unexpected argument '-m'`. Use `zfb wind explain -- -mt-2`.

### 1.4 Utility catalog, closed (SPEC table ranks 1-44; DOC utilities/index.mdx)

Numbers are conflict-group ranks. **A in the right column means batch A** (layout/spacing). **B means batch B**.

| # | Family | Accepted spellings (summary) |
|---|---|---|
|1|display|`block inline inline-block flex inline-flex grid inline-grid hidden` (**only these 8**)|
|2|position|`static relative absolute fixed sticky`|
|3|inset|`inset inset-x inset-y top right bottom left` × S / `auto` / `full`; negative OK|
|4|flex-container|`flex-row flex-row-reverse flex-col flex-col-reverse flex-wrap flex-wrap-reverse flex-nowrap`|
|5|flex-item|`flex-1 flex-auto flex-initial flex-none grow grow-0 grow-[n] shrink shrink-0 shrink-[n]`|
|6|grid|`grid-cols-/grid-rows-` 1-12, `none`, `subgrid`, `[tracks]`; `col-span-/row-span-` 1-12, `full`; `col-start/end-`, `row-start/end-` 1-13, `auto`|
|7|alignment|`items-*`, `self-*` (start end center baseline stretch), `justify-*` (start end center between around evenly), `place-items-*`|
|8|sizing|`size w h min-w max-w min-h max-h` × S, size tokens, `full min max fit`, fractions, `auto` (size/w/h), `none` (max-*), `screen` (vw/vh), `dvw`/`dvh`|
|9-11|padding / margin / gap|`p px py pt pr pb pl`, `m mx my mt mr mb ml` (+`auto`, negative), `gap gap-x gap-y`. **There are no logical `ps/pe/ms/me` forms**|
|12|child-space|`space-x-*`, `space-y-*`. Selector is `C > :not([hidden]) ~ :not([hidden])`. There is no `space-*-reverse`|
|13|overflow|`overflow(-x/-y)-{auto,hidden,clip,visible,scroll}`, `overscroll(-x/-y)-{auto,contain,none}`|
|14|z-index|`z-<int 0..2147483647>`, `z-auto`, `z-TOKEN`, `z-[int or var]`|
|15-19|font family / weight / size / leading / tracking|`font-TOKEN` (family or weight token, disjoint), `font-[weight]`, `text-TOKEN` (fontSizes, with paired line-height), `text-[size]`, `leading-TOKEN/[v]`, `tracking-TOKEN` (negative OK)|
|20|text-layout|`text-left/center/right/justify/start/end`, `whitespace-{normal,nowrap,pre,pre-line,pre-wrap,break-spaces}`, `break-normal break-words break-all`, `truncate`|
|21|text-style|`underline overline line-through no-underline uppercase lowercase capitalize normal-case italic not-italic tabular-nums antialiased`|
|22-23|color / background|`text-C`, `bg-C` (**colour only**: no gradients or images). C is a token, `transparent`, `current`, or `[colour]`, plus an optional `/N`|
|24-26|border|`border(-x/-y/-t/-r/-b/-l)` bare = 1px or `-N` px (sets solid style too); `border-*-C`; `border-solid/dashed/dotted/double/none`, `border-collapse/separate`|
|27|radius|`rounded(-t/-r/-b/-l/-tl/-tr/-br/-bl)` bare = `radii.default`, `-TOKEN`, `-none`, `-full`|
|28-29|divide|`divide-x/-y` (1px or N px), `divide-C`. There is no `divide-*-reverse`|
|30-32|outline|`outline-N` (px, which also sets solid style), `outline-offset-N` (negative OK), `outline-C`, `outline-solid/dashed/dotted/double/none`|
|33|shadow|`shadow` = `shadows.default`, `shadow-TOKEN`, `shadow-none`|
|34|opacity|`opacity-0..100`, `opacity-[0-1 or %]`|
|35-37|transition / duration / ease|`transition` (= all), `transition-{all,none,colors,opacity,transform}`, `transition-[list]`. Each one except `none` also sets 150ms and `ease`. `duration-0..60000` (ms) or `[time]`. `ease-TOKEN` or `ease-[fn]`: **`ease-in-out` needs `easings.in-out`**|
|38-39|translate / rotate|`translate-x/-y-` S / `full` / fraction (uses `--zw-translate-*` `@property` plus the `translate` property), `rotate-0..360`, `rotate-[angle]`|
|40|interaction|`cursor-{auto,default,pointer,not-allowed,text,move,grab,grabbing,wait}`, `pointer-events-{auto,none}`, `select-{none,text,all,auto}`, `resize(-x/-y/-none)`, `accent-C`|
|41|list|`list-none list-disc list-decimal list-inside list-outside`|
|42|aspect|`aspect-auto aspect-square aspect-video aspect-[w/h]`|
|43|scroll-margin|`scroll-m(-x/-y/-t/-r/-b/-l)` × S, negative OK|
|44|misc|`align-{top,middle,bottom,baseline}`, `box-border box-content`, `object-{contain,cover,fill,none,scale-down}`, `sr-only`|

**These are NOT in the catalog and silently become "ordinary class" with no CSS and no build error** (MEASURED via `zfb wind explain` in `pkgs/proj1`): `invisible`, `visible`, `table`, `contents`, `flow-root`, `line-clamp-2`, `order-1`, `basis-1/2`, `fill-current`, `stroke-current`, `decoration-2`, `backdrop-blur`, `container`, `not-prose`. Others are also absent: `not-sr-only`, `columns-*`, `float`, `clear`, `isolate`, `mix-blend`, `filter`, `blur`, `drop-shadow`, `will-change`, `appearance-none`, `origin-*`, `skew`, `place-content/self`, `content-*`, `justify-items/self`, `font-mono`-style implicit tokens (they need tokens), `text-wrap`/`text-balance`, `hyphens`, `indent`, `snap-*`, `touch-*`, `scroll-p*`, `bg-gradient`, `from-/via-/to-`, `inset-shadow`, `outline-hidden`, `underline-offset`, `decoration-*`, `size-screen`, `max-w-screen-*` and `max-w-prose`. These are INFERRED from the catalog table (not in SPEC) and not individually executed.

**These are recognized roots with a missing token or suffix, so they fail as ZW006 errors at strict origins** (MEASURED): `rounded-lg`, `shadow`, `font-bold`, `leading-tight`, `tracking-wide`, `ease-in-out`, `text-small` and `py-vsp-2xs` (without the token), `bg-gradient-to-r`, `text-balance`, `underline-offset-4`.

Beware the misleading case (MEASURED): `underline-offset-4` parses as `underline` + `offset-4` and reports `ZW006 unknown value or token offset-4`. It really is an unsupported family, but the error message does not say so.

### 1.5 Cascade, layers, output (SPEC W18; DOC cascade-and-reset.mdx; MEASURED `zfb css` in pkgs/proj3)

- Prelude: `@layer zw-reset, zw-tokens, zfb-hi, base, components;` It is emitted whenever wind emits anything. An authored `@layer base, components;` is appended after it and cannot reorder these five layers.
- Integrated order: prelude, then hoisted external imports, then `@layer zfb-hi` highlight, then `zw-reset`, then `zw-tokens`, then `@property` registrations, then authored bundled CSS, then **unlayered generated utilities**, then CSS Modules output.
- Utilities are **unlayered**, so they beat every named-layer declaration. Unlayered authored rules win by specificity or when they appear later. This is a big change if zudo-doc CSS relied on Tailwind v4's `@layer utilities`: authored `@layer components` rules now always lose to utilities.
- Deterministic rule sort: `(responsive, dark, relation, state, pseudo, conflict_group, scope, catalog, raw_bytes)`. HTML class order is irrelevant. Same-scope ties go by raw bytes (`p-2` after `p-10`). Every permutation of `p-4 px-2 pl-1` gives 1rem/0.5rem/1rem/0.25rem (top/right/bottom/left).
- Output is **not minified** in dev or prod (LF, 2-space indent, no banner). Generated source is `zudo-wind://spec/1` with no source map.

### 1.6 Resets (SPEC exact bytes)

- `none` (default) is zero bytes.
- `minimal-v1`: `*,::before,::after{box-sizing:border-box}`, `body{margin:0}`, and form controls `font: inherit`.
- `owned-v1` (what the scaffold uses): zero margin, padding and border-width on everything; solid currentColor border; html line-height 1.5 and ui-sans-serif; headings get `font-size: inherit; font-weight: inherit`; links `color: inherit; text-decoration: inherit`; `ol, ul, menu { list-style: none }`; controls `font/letter-spacing/color: inherit`; button background transparent; `img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle }`; `img, video { max-width: 100%; height: auto }`; table `border-collapse`; `summary { display: list-item }`; `hr` 1px top border. Both resets leave outlines and `appearance` alone. **No reset forces `[hidden]{display:none}`**, so authored CSS must supply it where display utilities could override `hidden`.

### 1.7 Diagnostics (SPEC W22; MEASURED)

| Code | Meaning | Severity |
|---|---|---|
|ZW001|candidate syntax (empty segment, unbalanced, whitespace, `w-(10px)`)|error at class/safelist/manifest origins; audit-info elsewhere|
|ZW002|unknown/unconfigured variant (incl. `dark:` when dark not configured, `md:` unconfigured, `print:`)|same|
|ZW003|variant duplicate / order (sorted suggestion when unique)|same|
|ZW004|deliberately unsupported (named group/peer, aria/data variants, `[&..]:`, `[prop:v]`, `!`, ring/animate/scale/transform, variant on marker)|same|
|ZW005|invalid value/modifier/negative (`-p-2`, `w-1/0`, `bg-x/101`, ambiguous `text-[var()]`, url())|same|
|ZW006|missing token / spacingUnit / default (`rounded` w/o radii.default, `p-4` w/o spacingUnit)|same|
|ZW007|config/token schema error|error, pass fails|
|ZW008|unknown explicit utility in safelist/manifest|error|
|ZW009|leftover Tailwind import/directive/function (`@import "tailwindcss"` + subpaths, `@tailwind`, `@theme*`, `@source`, `@custom-variant`, `@apply`, `@utility`, `@variant`, `@plugin`, `@config`, `@reference`, `theme()`, `--spacing()`, `--alpha()`, `--value()`) — scanned in entry + every imported sheet, even with `wind:false`|error|
|ZW010|required source/manifest missing/unreadable/invalid|error|
|ZW011|non-UTF-8 source|warning, skip file|
|ZW012|dynamic class construction (`bg-${x}`)|audit info|
|ZW013|property conflict inside one class literal|audit info|

"Strict origin" means a class/className attribute position, a safelist entry, or a manifest entry. Lower-confidence script string literals are audit-only: valid ones still emit, and invalid ones never break the build.

Observed build failure text (MEASURED `zfb css` in proj3): `wind CSS failed: ZW006: unknown value or token lg (rounded-lg); ZW002: unknown or unconfigured variant (md:block)`. **It names no file or line.** Use `zfb wind audit` to find the location.

ZW009 output (MEASURED) is `ZW009: forbidden @import at <abs path>:1:1; migrate this stylesheet to zudo-wind: /docs/zudo-wind/coming-from-tailwind/`. **It reports only the first leftover per run**: removing one reveals the next (MEASURED with bad.css and bad2.css).

### 1.8 Sources, safelist, manifests (SPEC; code `css_source_plan.rs`, `css_support.rs`)

- Build/dev scans `.tsx .ts .jsx .js .mdx .md` only (case-sensitive). `.html` and `.mjs` are scanned only via `zfb css --source`.
- Build/dev source plan roots: the default content roots; **package-route entrypoints** (the parent dir of each materialized injected route; required); **sibling mirror roots** (workspace siblings reached via tsconfig path alias); the root package; **plugin virtual module sources** (candidates extracted from each virtual module's source text); `codeHighlight.roleClasses`; manifests; and safelist.
- Always excluded: `node_modules` (unless it is a declared package root), `dist`, `build`, `target`, `.git`, `.cache`, `.zfb-build`, `.zfb`, and configured out/cache dirs. **So a published `@takazudo/zudo-doc/dist/**` is not scanned** unless it is reached as a package-route entrypoint dir or declared through a manifest. That makes the manifest the robust channel for package-owned classes.
- **`zfb css` and `zfb wind audit` use only the standalone plan**, which means `pages components layouts content src` under `--project-root` plus explicit `--source`. They **do not see package-route, mirror or plugin roots** (css_support.rs comment at lines 91-94). Audit on zudo-doc will not see package-owned candidates unless a manifest carries them. Audit does add manifest and roleClass candidates.
- Extraction: complete tokens in class/className attrs and every script string/template literal. Interpolation fragments are never joined. `last:border-b-0${x}` keeps `last:border-b-0` and flags it as adjacent. `bg-${c}` gives ZW012 and nothing is emitted. Use finite literal maps.
- Manifest schema, exact with unknown keys rejected: `{ "schemaVersion": 1, "specVersion": 1, "producer": "<must equal map key>", "candidates": ["..."] }`. Entries are **strict**: every entry must resolve against the *consumer's* tokens or be allowlisted in `authoredClasses`, otherwise the build fails with ZW001-ZW008 and the entry index. Duplicates are deduped. Two origins claiming the same producer is an error. There is no auto-discovery.
- `authoredClasses` matches exact full tokens. It suppresses parsing, emission and utility diagnostics at every origin. Use it for `.prose` and zudo-doc's own `zd-*` or component classes that collide with utility roots, such as any class starting with `text-`, `bg-`, `border-`, `p-` or `m-` that is really authored CSS.

### 1.9 CLI (MEASURED `--help`)

- `zfb css --input <css> --output <css> [--project-root DIR] [--source ROOT_OR_GLOB]... [--no-auto-source] [--code-highlight-mode class|inline] [--no-default-highlight-styles]`. Auto sources are `pages components layouts content src`.
- `zfb wind explain <candidate> [--project-root DIR]`. Use `--` for a leading `-`. Output is `key: value` lines: `candidate, outcome (resolved utility | recognized invalid or malformed | ordinary class), spec, variants, utility, negative, slash modifier, entry (v1.<root>), value status (verified|categoryUnverified), token: name (category) -> --zw-var = value, selector, conditions, declaration: ... (repeated), sort: responsive=.., dark=.., relation=.., state=.., pseudo=.., conflict-group=.., scope=.., catalog=.., candidate=..`, or `diagnostic: ZWnnn error at zudo-wind://explain/candidate:0: <msg>`.
- `zfb wind audit [--project-root DIR]`. Sections are `outcome`, `spec`, `unrecognized classes`, `conflicts`, `dead classes`, `dynamic constructions`, `tokens adjacent to interpolation`, `diagnostics`, and `extraction notes`. Locations print as `default/src:a.tsx:<UTF-8 byte offset>`, **not line:col** (MEASURED).

---

## 2. zudo-react (contract v1 rev 1.0.1)

### 2.1 Entry points and API (MEASURED from `pkgs/takazudo-zfb-3.0.0/package/dist/zudo-react/*.d.ts`)

| Entry | Values | Types |
|---|---|---|
|`@takazudo/zfb/zudo-react`|`Fragment, h, isDescription, flattenChildren, signal, computed, batch, flush, getScope, Show, For`|`Key, Scalar, Child, Component, ElementType, Description, ReadonlySignal, Signal, Cleanup, Scope, Ref, Style, Listener, IslandIdentity, Diagnostic, Reporter, ShowProps, ForProps`|
|`/jsx-runtime`|`Fragment, jsx, jsxs`|`JSX`|
|`/jsx-dev-runtime`|`Fragment, jsxDEV`|`JSX`|
|`/server`|`renderToString(node, {island?})`, `islandRoot(child, {identity, when?, media?, skipSsr?, fallback?})`, `serializeProps`|`RenderOptions, IslandOptions`|
|`/client`|`hydrate(node, el, {identity, signal?, report?})`, `mount(...)`, `parseProps(json)`|`RootOptions, RootHandle{protocol, identity, disposed, dispose(), unmount()}`|

- tsconfig: `"jsx": "react-jsx"` and `"jsxImportSource": "@takazudo/zfb/zudo-react"`. There is no `react`/`preact` alias and no `paths` shim.
- `islandRootType` is **not** in the published server.d.ts. #3327 is closed, so the completion report's drift note is stale.
- `Signal<T>` carries the writable brand `$$zudoWritable`. `computed()` returns `ReadonlySignal<T>`, which is a type error and a runtime `ZR_MODEL_READONLY` error when used as a model (MEASURED: probe3 `modelComputed`).
- `Scope` has `abortSignal`, `onActivate(fn → cleanup?)`, `onCleanup(fn)` and `effect(fn → cleanup?)`. `getScope()` works only during synchronous setup or inside a Show/For factory; otherwise it throws `ZR_NO_SCOPE`. No owner survives `await`.
- Scheduler: `Object.is` equality. Mutating an object in place does not notify. Computeds are lazy. Batches are synchronous. There is a microtask drain capped at **100 passes** (`ZR_FLUSH_LIMIT`). `flush()` resolves when the DOM and effect queues are quiet.
- Effects and `onActivate` run **only in the browser after commit**. Order is children before parents and siblings in order. Effects start after all activations. The server never runs them. Disposal aborts the signal and runs cleanups in reverse order. DOM stays until `unmount()`.

### 2.2 JSX dialect (MEASURED with probe1/3/4; code `render-html.js` allow-table)

- HTML spellings only: `class`, `for`, `charset`, `datetime`, `tabindex`, `readonly`, `autofocus`, `maxlength`, `http-equiv`, `accept-charset`. **`className`, `htmlFor`, `charSet`, `dateTime`, `tabIndex`, `readOnly`, `strokeWidth` and `dangerouslySetInnerHTML` give ZR_PROP_DIALECT**, and so does any `on[A-Z]...` prop (MEASURED).
- **Closed attribute allow-table, applied to ALL rendering, not just islands.** An unknown attribute gives `ZR_ATTRIBUTE: <tag>.<attr>` and the page render fails. The exact table from `dist/zudo-react/render-html.js`:
  - common: `id class title lang dir slot role style hidden inert contenteditable draggable spellcheck tabindex accesskey translate onclick onload onerror`, plus `data-*`, `aria-*`, and lowercase `on<word>` string handlers
  - html: `href target rel download src alt width height type name value placeholder for charset datetime readonly autofocus required disabled checked selected multiple open controls muted loop autoplay novalidate formnovalidate maxlength minlength min max step pattern autocomplete accept accept-charset http-equiv content media method action enctype rows cols colspan rowspan scope cite poster loading decoding sizes srcset crossorigin referrerpolicy sandbox allow allowfullscreen`
  - svg: `width height viewBox preserveAspectRatio gradientUnits gradientTransform markerWidth markerHeight refX refY xlink:href xml:lang stroke-width fill-rule clip-rule stroke-linecap stroke-linejoin stop-color stop-opacity fill stroke d x y x1 x2 y1 y2 cx cy r rx ry points transform opacity offset`
  - html tags: html head body title base link meta style script div span p a br hr main header footer nav section article aside h1-h6 ul ol li dl dt dd blockquote pre code strong em b i small mark time figure figcaption img picture source video audio track canvas form label input button textarea select option optgroup fieldset legend output progress meter datalist table caption thead tbody tfoot tr th td col colgroup details summary dialog template slot iframe noscript address abbr bdi bdo cite data del dfn ins kbd map area object param q rp rt ruby s samp sub sup u var wbr embed (+xmp noembed noframes plaintext)
  - svg tags: svg g path circle ellipse rect line polyline polygon text tspan defs symbol use clipPath mask linearGradient radialGradient stop title desc foreignObject
  - **Rejected in MEASURED probes**: `link hreflang`, `meta property` (OpenGraph), `script defer`, `script async`, `script integrity`, `script nonce`, `link as`, `link color`, `img fetchpriority`, `svg xmlns`, `use href` (only `xlink:href`), `fill-opacity`, `stroke-dasharray`, `text-anchor`, `clip-path` (attr), `popover`, `popovertarget`, `ol start`, `input list`, `option label`, `itemprop`, `inputmode`, `enterkeyhint`, `iframe frameborder`, `video playsinline`, `button form`, `hidden="until-found"`; tags `search`, `menu`, `hgroup`, `pattern`, `filter`, `marker`, `image`.
  - Custom elements (lowercase-hyphen tags) accept **string** attributes only. Numbers are rejected (`ZR_ATTRIBUTE ... requires a string`).
- Booleans: presence or absence. `hidden` takes a boolean only. `aria-*` false serializes as `"false"`. `data-*` true serializes as `"true"`.
- `style`: a string (trusted) or a flat object with **CSS-spelled keys** (`"background-color"`, `--x`). Numbers are emitted verbatim with no `px` added. camelCase gives ZR_STYLE (MEASURED). A reactive whole object is allowed; reactive per-entry values are not.
- Events: `on:click`, `on:keydown:capture`. These are native listeners with no delegation or synthetic event, and they receive the native event. Lowercase string `onload="..."` is static, trusted, and never evaluated. Giving both forms for the same event gives ZR_LISTENER_CONFLICT.
- Refs are `{ current: null }` objects only. There are no callback refs and no forwardRef. Refs are assigned before activation.
- `rawHtml`: a string or reactive string on an element. It is exclusive with `children` and **rejected on SVG**. For `script` and `style`, **content must be static `rawHtml`**: `<script>{code}</script>` with children gives `ZR_RAW_HTML: script requires rawHtml` (MEASURED), and a `</script` substring is rejected. `<title>` must be static text, and a reactive title gives ZR_PARSER_CONTEXT (MEASURED). Void tags reject children.
- Parser contexts: tables need an explicit `tbody` (`table > tr` gives ZR_PARSER_CONTEXT even in static render, MEASURED). An island wrapper `div` may not sit inside `<p>` (ZR_PARSER_CONTEXT, MEASURED), `table` structure, `select` or SVG. `template` is rejected inside islands. Inside islands, `noscript`, `iframe` and similar reject hydrated content.
- Children: a Scalar, a Description, a ReadonlySignal<Scalar>, or arrays of those. A function, object, promise or bigint child is an error. **Nested async components or promise children give ZR_ASYNC_COMPONENT** (MEASURED). Only a top-level page function may be async; zfb awaits it.
- A component runs **once per instance** (setup). Reading `sig.value` in JSX takes a snapshot. Passing `sig` creates a live binding.
- `h(type, props, ...children)`: variadic children replace `props.children`. Descriptions are immutable by contract. Copying one with `{...d, props:{...d.props, x}}` is legal. Unbranded hand-built `{type, props}` literals must move to `h`.

### 2.3 Show / For (SPEC ZR16)

- `<Show when={ReadonlySignal<boolean>} fallback={() => Child}>{() => Child}</Show>`: children and fallback are **factories**. Each branch gets its own scope. Switching away disposes the branch.
- `<For each={ReadonlySignal<T[]>} by={item => key}>{(item: ReadonlySignal<T>, index: ReadonlySignal<number>) => Child}</For>`: keyed. A retained key keeps its DOM and scope, and the factory is not re-run when the object changes but the key stays the same. Wrap derived fields in `computed(() => item.value.x)`. Duplicate or invalid keys (`ZR_DUPLICATE_KEY`/`ZR_KEY_TYPE`) leave the previous list intact.
- A reactive child may only resolve to a Scalar. Tree changes must go through Show or For. A reactive `hidden` just hides the element.

### 2.4 Forms (SPEC ZR15)

| Control | Model | Default |
|---|---|---|
|input text/search/email/url/tel/password|`modelValue: Signal<string>` (event `input`)|`defaultValue`|
|textarea|`modelValue: Signal<string>`|`defaultValue`|
|checkbox|`modelChecked: Signal<boolean>` (event `change`)|`defaultChecked`|
|single select|`modelValue: Signal<string>`|`defaultValue` (static options only)|
|radio group|shared `modelValue: Signal<string\|null>` + static `value` + same `name`|native `checked`|

A reactive `value` or `checked` gives ZR_MODEL_UNSUPPORTED (MEASURED). Supplying both a model and a default is an error. **Multiple select is unsupported in islands** (`ZR_MODEL_UNSUPPORTED: select[multiple]`, MEASURED). File, contenteditable, number, date and range models are unsupported, as are reactive option text and dynamic option sets. **The DOM value wins on hydration.** There is IME composition tracking; a real-IME pass is still deferred (#3330).

### 2.5 NOT supported

Hooks (all of them), context, portals, forwardRef, class components, error boundaries, Suspense/lazy, streaming, synthetic events, callback refs, cloneElement, general reconciliation (tree changes only via Show/For), react/preact aliases, `dangerouslySetInnerHTML`, async nested components, multi-select models, `displayName` aliases for islands, and nested islands.

### 2.6 Hooks conversion table (DOC coming-from-preact-hooks.mdx)

| Preact | zudo-react |
|---|---|
|`useState`|`const s = signal(init)` in setup; pass `s` for live binding; assign `s.value` in handlers|
|`useEffect(fn, [])`|`getScope().onActivate(() => {...; return cleanup})` (browser only)|
|`useEffect(fn, [deps])`|`getScope().effect(() => { read x.value ...; return cleanup })`, which tracks reads, runs cleanup before each rerun, and starts after activation|
|`useRef` (DOM)|`const r: Ref<HTMLElement> = { current: null }`, `<el ref={r}>`|
|`useMemo`|`computed(() => ...)` (or a plain setup-time const if it has no signal deps)|
|`useCallback`|not needed, because setup runs once|
|`{cond && <X/>}`|`<Show when={sig}>{() => <X/>}</Show>`|
|`items.map(... key)`|`<For each={sig} by={i=>i.id}>{(item)=> ...}</For>`|
|controlled input|`<input modelValue={sig}/>`|
|`className={memo}`|`class={computed(...)}`|
|`onClick`|`on:click`|
|`dangerouslySetInnerHTML`|`rawHtml`|
|custom hook|a plain function `(scope: Scope, sig) => ...` called during setup|
|fetch in a handler|use `scope.abortSignal` and check `aborted` before writing|
|browser reads (localStorage, matchMedia) during render|move them into `onActivate`, so SSR and hydration setup stay deterministic|

---

## 3. Islands and client router in v3

### 3.1 Island boundary (SPEC ZR17/ZR12; DOC api/island.mdx; MEASURED probe3)

- `<Island when? media? ssrFallback?>{exactly one registered component}</Island>` from `@takazudo/zfb`. Its IslandProps are only `when | media | ssrFallback | children`. There is **no persist prop**.
- The child must be exactly one synchronous function component description. Host elements, strings, multiple children, and nested islands (`ZR_NESTED_ISLAND`, MEASURED) are rejected. **The child cannot receive non-empty `props.children`** (MEASURED error path).
- **Identity**: the server `type.displayName ?? type.name` must equal the scanner's static marker name. A `displayName` that differs from the function name gives `ZR_ISLAND_IDENTITY: expected Real, got Alias` (MEASURED). Anonymous or unregistered components are rejected. The build keeps names with esbuild `keep-names`. The build identity is injected as `globalThis.__zfb.zudoReactBuild`. Outside a zfb build, `<Island>` fails with `ZR_ISLAND_IDENTITY: Demo has no build identity` (MEASURED). **Unit tests that SSR an `<Island>` without zfb must stub the build identity or test the child directly.**
- Props are strict JSON: plain or null-prototype records, dense arrays, strings, finite numbers, booleans and null. **`undefined` values give `ZR_PROPS_UNDEFINED`** (MEASURED: `{d: undefined}`), so strip optional-undefined keys before passing. Date, Map, Set and class instances give ZR_PROPS_OBJECT_KIND (MEASURED). Functions, signals, descriptions, accessors, `toJSON`, `__proto__`/`constructor`/`prototype` keys, NaN/Infinity and cycles are also rejected. A bad server payload fails the page render.
- Wrapper, with attributes in exact order: `<div data-zfb-island="Name"|data-zfb-island-skip-ssr="Name" data-when="load|idle|visible|media" [data-media] data-zfb-transport="json/1" data-zfb-protocol="zudo-react/1" data-zfb-build="…" data-props="{…}">`. Inner comment markers are `<!--zr:1:N:K-->…<!--/zr:1:N-->`.
- Hydration: preflight (no DOM writes) and then commit. A mismatch (`ZR_HYDRATION_MISMATCH`, `ZR_IDENTITY`, `ZR_PROPS`, `ZR_UNSUPPORTED_POSITION`, `ZR_DUPLICATE_ROOT`, `ZR_CANCELLED`) leaves **that island inert** while the others continue. There is **no fallback to client render**. Text comparison is whitespace-tolerant (ASCII), and `pre` is exact. Ordinary attributes are not compared, but form-control shape attributes are.
- Skip-SSR (`ssrFallback`): the fallback renders without markers. At the `data-when` trigger, `mount` builds off-DOM and swaps atomically. If the mount fails, the fallback stays.
- Root handle: `el[Symbol.for("@takazudo/zfb/zudo-react/root-v1")]`. `data-zfb-island-mounted` is only an observation. The mount fn signature is `(props, el, "hydrate"|"render") => RootHandle|null`.
- A single shared islands bundle `islands-<hash>.js` holds every island. Pages without islands get no script. `"use client"` as the first statement registers a file's default export as an island entry.
- Runtime identity: there must be one reactive-core copy (witness `@takazudo/zfb/zudo-react/runtime-definition-v1`). A package such as zudo-doc that imports `@takazudo/zfb/zudo-react` must resolve to the **same** zfb copy as the consumer; otherwise signals shared across islands break. The published-preset regression fixture for this is not restored yet (#3331).

### 3.2 Client router (DOC concepts/client-side-routing.mdx; code runtime.js and swap-functions.js)

- `<ClientRouter fallback? prefetchAll? preserveHtmlAttrs? traverseRefetch?/>` from `@takazudo/zfb-runtime`, placed in `<head>`. The import triggers the client router bundle. Events: `zfb:before-preparation`, `zfb:after-preparation`, `zfb:before-swap`, `zfb:after-swap`, `zfb:page-load`, and so on. `navigate()`, `syncHistoryEntry()` and `swapFunctions` are unchanged in shape.
- Persistence: `data-zfb-transition-persist="<id>"` on an element present in both bodies lifts it across the swap. On an **island wrapper itself**, the live root survives if component, root kind, transport, protocol, build and the exact `data-props` JSON string are unchanged. Otherwise the old root is disposed and **`render`** runs (never `hydrate`) with the new props. `data-zfb-transition-persist-props` (any value except `"false"`) keeps the old props.
- **Ancestor persistence**. The contract claims "Persisted ancestors preserve descendant islands by matching each descendant's boundary identity". But `unmountIslands()` in `dist/runtime.js` (lines ~526-537) skips disposal **only when the island element itself** carries `data-zfb-transition-persist`. An island inside a persisted `<header data-zfb-transition-persist>` is therefore disposed before the swap, and `mountNewIslands()` then re-`hydrate`s its lifted DOM. INFERRED from code; not browser-verified. zudo-doc persists `<header data-zfb-transition-persist="header-${lang}">` containing islands (packages/zudo-doc/src/header/header.tsx:386) and has a workaround, `transitions/nested-island-props-refresh.ts`. Verify this in the browser early.
- Hand-authored persisted wrappers must carry the **complete** metadata. Their inner HTML must come from `renderToString(child, { island: identity })`, which needs the build token. The docs example in client-side-routing.mdx with only `data-zfb-island` + `data-props={props}` is stale (see upstream candidates).
- `preserveHtmlAttrs` (e.g. `["data-theme","data-sidebar-hidden"]`) is needed for runtime `<html>` attrs to survive swaps.

---

## 4. MDX / content pipeline interactions (MEASURED probe-md2)

- MDX output uses `_components.<tag>` with the owned dialect (`class`, CSS style strings). `defaultComponents`/`ContentOl` pass props through.
- **A markdown ordered list that starts at a number other than 1 emits `ol start="3"`, which the owned renderer rejects with `ZR_ATTRIBUTE: ol.start`.** Commands: `node pkgs/probe-md2.mjs` prints `FAIL olStart ZR_ATTRIBUTE: ol.start`. Any zudo-doc page whose list is interrupted by a block and resumes at "2." is a candidate. 88 content files contain a line matching `^([2-9]|[1-9][0-9])\. ` (`grep -rEln "^([2-9]|[1-9][0-9])\. " src/content/docs src/content/docs-ja | wc -l`). How many of them actually emit `start` is unverified.
- Inline raw `<svg xmlns=...>` in MD/MDX gives ZR_ATTRIBUTE. MDX authored `className=` gives ZR_PROP_DIALECT. MDX `style={{backgroundColor}}` gives ZR_STYLE. `style={{"background-color":..}}` works.
- GFM table alignment emits `style="text-align: center"` and works.

---

## 5. Upstream issue state (MEASURED `gh issue list -R Takazudo/zudo-front-builder --state open --limit 100 --search "wind OR zudo-react OR v3 OR island"` and `gh issue view N`)

| # | State | Title / relevance |
|---|---|---|
|3328|OPEN|Publish a zudo-doc major migrated to zfb v3. **This task.**|
|3329|OPEN|Re-pin and port the zfb docs host after release. It is blocked on the zudo-doc v3 major. Its gates are `pnpm --filter docs check`, `check:html` and `check:islands`, with no preact in the graph.|
|3331|OPEN|Restore a published-preset runtime identity regression fixture. It needs a published migrated zudo-doc preset and should assert one runtime identity plus a nested island across the preset boundary. zudo-doc's release unblocks it.|
|3330|OPEN|Real Japanese IME check for R-A06 (deferred). zudo-doc search/AI-chat inputs with `modelValue` inherit this risk.|
|3127|OPEN|Plugin-host init 120s timeout (unexplained). Plugin-heavy presets like zudo-doc could hit it.|
|3357|OPEN|Evaluate the Cloudflare `cf` CLI (not v3-specific).|
|3321, 3325, 3326, 3327|CLOSED 2026-09-29|Agent-found follow-ups, all fixed. islandRootType is absent from the published d.ts.|

---

## 6. Upstream candidates found here (evidence)

1. **bug (high impact)**: the closed attribute/tag allow-table rejects standard HTML/SVG in *static* SSR. `node pkgs/probe1.mjs` shows FAIL for hreflang, `meta property`, `script defer/async/integrity/nonce`, `link as`, `svg xmlns`, `use href`, SVG presentation attrs, popover/popovertarget, `ol start`, `option label`, `input list`, itemprop, `video playsinline`, `button form`, and the tags search/menu/hgroup/pattern/filter/marker/image. zudo-doc impact (`grep -rEn PATTERN packages/zudo-doc/src pages src --include='*.tsx' | grep -v __tests__ | wc -l`): `xmlns=` 43, `property=` 9 (OG tags in head/og-tags.tsx and head-with-defaults), `popover` in theme-toggle/index.tsx:233, and `<script defer|async>` 0 (`grep -rEn "<script[^>]*\b(defer|async)\b" ... | wc -l` returns 0). There is no escape hatch other than `rawHtml` on a parent, which cannot mix with children.
2. **bug**: the MD/MDX emitter produces `ol start` for ordered lists that don't start at 1, and the owned renderer rejects it, so a plain markdown list breaks the page render (probe-md2).
3. **docs**: `concepts/islands.mdx` recommends `<script src="/scripts/analytics.js" defer />`, which throws ZR_ATTRIBUTE in v3.
4. **docs**: `concepts/client-side-routing.mdx` shows a persisted island as a hand-authored `<div data-zfb-island="SidebarTree" data-zfb-transition-persist=... data-props={props}>`. That is the v2 shape. v3 requires the full transport/protocol/build metadata plus island-mode inner render, and a `data-props` object is not a JSON string. The docs don't explain how an author obtains the build identity, and `<Island>` has no persist prop.
5. **bug (plausible, needs browser check)**: ancestor-persisted islands. The contract says persisted ancestors preserve descendant islands, but `unmountIslands` only exempts elements that carry the persist attribute themselves (`dist/runtime.js` around line 526).
6. **docs**: `zudo-wind/variants.mdx` says dark-when-disabled gives ZW004. The binary and `utility-grammar.mdx` G04 say ZW002 (MEASURED in pkgs/proj2).
7. **dx**: build/`zfb css` wind errors list `ZWnnn (candidate)` without any file or line. Only `zfb wind audit` locates them, and audit prints a byte offset rather than the line:col the spec promises.
8. **dx**: `zfb wind audit` and `zfb css` use the standalone source plan, which ignores package-route, mirror and plugin roots. For preset-heavy projects like zudo-doc, audit cannot see most candidates, so it is not a full migration inventory tool.
9. **dx**: ZW009 reports one leftover directive per run, which makes migrating a large stylesheet iterative.
10. **dx**: `zfb wind explain -mt-2` is parsed as a flag. `--` is needed, and the docs don't mention it.
11. **dx**: missing catalog families silently become "ordinary class" with no diagnostic: `invisible`, `visible`, display `table`/`contents`/`flow-root`, `order-*`, `basis-*`, `line-clamp-*`, `fill-current`, `stroke-current`. Only audit's "unrecognized classes" list reveals them. `underline-offset-4` gives a misleading `ZW006 unknown value or token offset-4`.
12. **docs**: `api/define-preset.mdx` does not mention that `definePreset` stamps `wind.manifests` so that paths resolve from the preset package. `git show v3.0.0:docs/src/content/docs/api/define-preset.mdx | grep -i -c "wind\|manifest"` returns 0.
13. **contract deviation (low)**: the contract says a leading LF in `pre` is emitted doubled. `renderToString(h("pre",null,"\nabc"))` gives `<pre>\nabc</pre>` with a single LF (probe4 `preText`), so the parser drops the authored newline.
14. **docs nit**: the zfb-runtime `index.ts` header comment contains a stray `////   });` left over from removing the `framework` line (`git diff v2.22.1 v3.0.0 -- packages/zfb-runtime/src/index.ts`).
15. **docs nit**: the `packages/zfb/src/config.ts` presets JSDoc still says preset scalars "fill in only when the main config leaves the field at its default". The implementation is presence-aware deep merge (config.rs `deep_merge`, #1199).

---

## 7. Open questions

- Does zfb build resolve `@takazudo/zfb/zudo-react` from the project's node_modules or from the binary's embedded vendor tree when both exist? This decides the duplicate-runtime risk for a preset package. Unverified.
- How should a package author publish persisted islands in v3 without hand-authoring wrappers? Should `<Island>` gain a persist attribute passthrough?
- Is the strict allow-table (item 1) intended to be permanent for v1, or will `hreflang`/`property`/`defer`/`xmlns`/`popover` be added in a patch? The zudo-doc plan depends on the answer: rawHtml workarounds versus waiting for an upstream fix.
