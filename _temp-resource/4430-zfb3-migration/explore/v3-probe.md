# v3-probe — zfb 3.0.0 measured against zudo-doc 5.28.2 inputs (HEAD 337b9f110)

All paths below are under `SCR=<planning-scratch>/explore/v3-probe`.
Nothing inside $HOME/repos was modified. MEASURED = produced by a command shown; INFERENCE = labelled.

## 1. Install (MEASURED)

| item | value | command |
|---|---|---|
| install time | 9.3 s (pnpm "Done in 9.3s"; wall 9.5 s) | `cd $SCR/proj && pnpm add @takazudo/zfb@3.0.0 @takazudo/zfb-runtime@3.0.0 @takazudo/zfb-md-wasm@3.0.0 typescript` (log `$SCR/install.log`) |
| node_modules | 155 MB, 69 packages | `du -sh node_modules` |
| platform binary | `@takazudo/zfb-linux-x64-gnu@3.0.0` (optionalDependency of @takazudo/zfb; also darwin-x64/arm64, linux-arm64-gnu, win32-x64-msvc); pkg dir 106 MB, `zfb` executable 110,553,368 bytes | `npm view @takazudo/zfb@3.0.0 optionalDependencies`; `ls -la .../zfb-linux-x64-gnu/` |
| package sizes | zfb 1.2 MB, zfb-md-wasm 8.0 MB, zfb-runtime 540 KB | `du -shL node_modules/@takazudo/*` |
| version | `zfb 3.0.0` / `embedded esbuild: 0.25.12` | `npx zfb --version` |
| note | unpinned `typescript` resolved to 7.0.2 (native tsgo, 27 MB); zudo-doc pins ^5.9.3. Also installed 5.9.3 in `$SCR/ts59` | |
| subcommands | new, dev, build, css, wind (explain, audit), preview, check | `npx zfb --help` |

`zfb wind audit` / `explain` accept only `--project-root`; no JSON output, no severity filter, no source override (`npx zfb wind audit --help`). `zfb css` keeps `--source`, `--no-auto-source`; auto sources = pages, components, layouts, content, src.

## 2. Wind audit over zudo-doc sources (MEASURED)

Scratch project `$SCR/audit`: `rsync -a --exclude __tests__` of `packages/zudo-doc/src -> src/zudo-doc`, `pages -> pages`, `src/components -> components`. 407 .ts/.tsx files (`find src pages components \( -name '*.ts' -o -name '*.tsx' \) | wc -l`). Config must import `defineConfig` from bare `zfb/config` (importing from `@takazudo/zfb` fails: "No matching export ... for import defineConfig").

Run: `cd $SCR/audit && npx zfb wind audit > $SCR/audit-<cfg>.out`; parsed with `$SCR/tools/parse_audit.py` (maps byte offsets back to candidate text + line) -> `$SCR/audit-<cfg>.out.json`.
Timing: 0.74 s wall, 94.6 MB max RSS (`/usr/bin/time -v`). Exit code 0 in every case (see upstream).

### 2a. Section sizes

| section | reset none, no tokens (`config-reset-none.ts`) | best-effort tokens (`config-tokens.ts`) |
|---|---|---|
| unrecognized classes | 72 | 72 |
| conflicts (ZW013) | 19 | 23 |
| dead classes | 1726 | 13 |
| dynamic constructions (ZW012) | 1085 | 1085 |
| tokens adjacent to interpolation | 164 | 164 |
| diagnostics total | 6631 | 4485 |
| extraction notes | 1093 | 1093 |

### 2b. Diagnostics by code x severity

| code | no tokens: error | no tokens: auditInfo | tokens: error | tokens: auditInfo |
|---|---|---|---|---|
| ZW001 syntax | 0 | 1025 | 0 | 1025 |
| ZW002 variant | 62 | 243 | 2 | 221 |
| ZW004 unsupported | 8 | 65 | 8 | 65 |
| ZW005 value | 14 | 1950 | 9 | 1949 |
| ZW006 missing token | 1664 | 496 | 11 | 87 |
| ZW012 dynamic | 0 | 1085 | 0 | 1085 |
| ZW013 conflict | 0 | 19 | 0 | 23 |

No-token ZW006 errors top candidates: text-muted 136, border-muted 105, text-small 93, text-fg 90, text-caption 79, bg-surface 46, hover:text-accent 45, px-hsp-lg 40, rounded 39, py-vsp-2xs 31, font-bold 27 (font weights are NOT built in). No-token ZW002 errors: all `sm:`/`lg:`/`xl:`/`2xl:` (breakpoints must be configured).

Noise: of 4455 auditInfo diagnostics (tokens run), 1993 are import specifiers / paths / URLs (`./types.js`, `preact/hooks`, `node:path`, `http://www.w3.org/2000/svg`, `virtual:zudo-doc-*`): ZW005 "invalid slash modifier" 1675, ZW002 167, ZW012 144 (python filter over the JSON, regex `^(\.{1,2}/|@[a-z]|node:|preact|virtual:|https?:|/)`).

### 2c. Token set used (translated from packages/zudo-doc/src/theme.css `@theme`, `@theme static`, `@theme inline`, and src/styles/global.css `@theme`)
colors: 23 semantic (`bg`..`matched-keyword-fg`) + 23 `zd-*` + `page-loading-overlay`, each `var(--color-<name>)`; spacing: 20 (`hsp-2xs..2xl`, `vsp-3xs..2xl`, `icon-xs..lg`, `image-overlay-inset`); fontSizes: micro/caption/small/body/title/heading/display -> `{size: var(--text-scale-*)}`; fontFamilies sans/mono; fontWeights normal/medium/semibold/bold; lineHeights tight/snug/normal/relaxed; letterSpacings tight/normal/wide/wider; radii default/lg; shadows lg; zIndices 13; breakpoints sm 640 / lg 1024 / xl 1280. No spacingUnit (zudo-doc's @theme has none; zero "requires spacingUnit" diagnostics in the tokens run: `grep -c spacingUnit audit-tokens.out` = 0). No dark (zudo-doc does not use `dark:`; the 10 grep hits are object keys).
Iterations needed: `zIndices` values must be strings (`"0"`) — number fails serde ("invalid type: integer `0`, expected a string"); `radii.full` rejected ZW007 "collides with a reserved static utility suffix" (`rounded-full` is built in as 9999px).

### 2d. The 30 class-position errors that would fail `zfb build`/`zfb css` with the token set

| code | candidate | file (under packages/zudo-doc/src) | line |
|---|---|---|---|
| ZW006 | rounded-l-DEFAULT | asset-page/components.tsx | 197 |
| ZW006 | ease-in-out | asset-page/components.tsx | 197 |
| ZW004 | [&_nav]:mb-0 | breadcrumb/breadcrumb.tsx | 194 |
| ZW006 | rounded-r-DEFAULT | desktop-sidebar-toggle-island/index.tsx | 98 |
| ZW006 | ease-in-out | desktop-sidebar-toggle-island/index.tsx | 98 |
| ZW006 | rounded-l-DEFAULT | desktop-toc-toggle-island/index.tsx | 103 |
| ZW006 | ease-in-out | desktop-toc-toggle-island/index.tsx | 103 |
| ZW004 | animate-spin | doc-history/index.tsx | 60 |
| ZW005 | h-[calc(100%-3rem)] | doc-history/index.tsx | 631 |
| ZW005 | min-h-[calc(100vh-3.5rem)] | doclayout/doc-layout.tsx | 440 |
| ZW006 | shadow-md | find-in-page/find-bar.tsx | 84 |
| ZW005 | shadow-[0_1px_3px_color-mix(in_srgb,var(--color-fg)_8%,transparent)] | html-preview-wrapper/preview-base.tsx | 210 |
| ZW005 | max-w-[calc(100vw-var(--spacing-hsp-xl))] | i18n-version/language-switcher.tsx | 282 |
| ZW004 | [&::-webkit-details-marker]:hidden | nav-indexing/docs-sitemap.tsx | 58 |
| ZW004 | [&_a]:pointer-events-auto | nav-indexing/note-tray-index-parts/card-list.tsx | 154 |
| ZW005 | ml-[calc(var(--spacing-hsp-xl)+1px)] | nav-indexing/note-tray-index-parts/card-list.tsx | 154 |
| ZW005 | mr-[calc(var(--spacing-hsp-xl)+1px)] | nav-indexing/note-tray-index-parts/card-list.tsx | 154 |
| ZW004 | [&_li]:mb-0 | nav-indexing/note-tray-index-parts/index-list.tsx | 12 |
| ZW004 | [&_li]:mb-0 | nav-indexing/note-tray-index-parts/timeline.tsx | 23 |
| ZW006 | leading-none | nav-indexing/note-tray-index-parts/timeline.tsx | 38 |
| ZW004 | [&::-webkit-details-marker]:hidden | nav-indexing/site-tree-nav-demo.tsx | 80 |
| ZW005 | h-[calc(100vh-3.5rem)] | sidebar-toggle-island/index.tsx | 255 |
| ZW002 | 2xl:w-[24px] | site-tree-nav-island/index.tsx | 204 |
| ZW002 | 2xl:w-[24px] | site-tree-nav-island/index.tsx | 397 |
| ZW005 | w-[calc(100vw-2rem)] | theme-pack-dialog/index.tsx | 171 |
| ZW006 | max-w-sm | theme-pack-dialog/index.tsx | 198 |
| ZW004 | animate-pulse | theme-pack-dialog/index.tsx | 222 |
| ZW006 | rounded-md | theme-pack-dialog/theme-pack-card.tsx | 58 |
| ZW006 | py-hsp-3xs | theme-pack-dialog/theme-pack-card.tsx | 74 |
| ZW005 | max-w-[calc(100vw-2rem)] | theme-pack-switcher/index.tsx | 234 |

Families: arbitrary-selector variants 8 (6 distinct), unspaced calc operators 8, missing tokens (DEFAULT spelling 3, ease-in-out 3, md 2, sm 1, leading-none 1, hsp-3xs 1), animate-* 2, 2xl breakpoint 2, box-shadow with var() 1.
INFERENCE: `shadow-md`, `rounded-md`, `max-w-sm`, `leading-none`, `py-hsp-3xs`, `2xl:` have no matching @theme token in zudo-doc 2.x either, so they are probably already dead classes today (not verified against the 2.x compiled CSS).

### 2e. Raw construct grep (sources in $SCR/audit, `grep -rEoh --include='*.tsx' --include='*.ts' <pat> src pages components | wc -l`)

| construct | occ | files | v1 disposition (explain) |
|---|---|---|---|
| `group-<state>:` | 84 (hover 47, focus-visible 32, focus-within 3, open 2) | 14 | supported (unnamed) |
| `group/<name>` | 1 (`group/index`) | 1 | ZW004 named marker (grep hit is not a class position; audit shows no error) |
| `peer-<state>:` | 4 (hover 2, focus-visible 2) | 1 | supported |
| `aria-*:` / `data-[..]:` variants | 0 (the 1 grep hit is a comment) | - | ZW004 |
| `[&...]:` | 15 | 7 | ZW004 |
| `animate-*` | 2 | 2 | ZW004 |
| `ring-*` | 2 (string literals, auditInfo) | 1 | ZW004 |
| `rotate-*` | 6 | 6 | supported |
| `translate-x-*` | 3 | 1 | supported (`--zw-translate-x`) |
| `dark:` variant | 0 real uses | - | would need wind.dark |
| motion-*/print:/max-*: | 0 | - | print/motion unsupported (ZW002) |
| `sr-only` | 30 | 12 | supported |
| `truncate` | 11 | 7 | supported |
| `!important` spellings | 0 at class position (15 auditInfo string hits) | | ZW004 |

### 2f. Per-token census (explain as oracle)

`$SCR/tools/census.py` extracts every string/template literal whose tokens all look class-shaped, runs `zfb wind explain` on each distinct token (4076 distinct / 15,481 occurrences in all such literals; 4m30s). `$SCR/tools/census2.py` keeps only literals containing >=1 resolved utility ("utility-bearing"): 922 literals in 84 files; 547 distinct tokens / 3,769 occurrences:
- resolved utility: 472 distinct / 3,663 occ (issue #3328 claimed 480 distinct / 3,279 occ — heuristic difference)
- recognized invalid: 31 distinct / 44 occ (same families as 2d plus `py-[calc(var(--spacing-vsp-xs)+0.15rem)]`)
- ordinary class: 42 distinct / 44 occ (zd-* names, prose words; Tailwind-lookalike silent drops: `wrap-anywhere`)
- marker: `group` 16, `peer` 2
Resolved variant usage (occ): hover 172, focus-visible 112, group-hover 43, lg 41, sm 37, group-focus-visible 30, focus 23, disabled 14, backdrop 12, xl 12, placeholder 3, group-open 2, last 2, peer-hover 2, peer-focus-visible 2, first 2, focus-within 2, group-focus-within 2.
Output: `$SCR/census-tokens.json` (all), `$SCR/census-tokens-classlits.json` (filtered).

### 2g. Stylesheets through `zfb css` (ZW009 check)

`cd $SCR/audit && npx zfb css --input css-in/<f>.css --output $SCR/css-out-<f>.css` (copies of packages/zudo-doc/src/{theme,content,features,page-loading}.css, src/styles/global.css, packages/zudo-doc/dist/safelist.css). Output `$SCR/css-directive-probe.txt`.

| file | result | directive lines (`grep -cE '^\s*@(theme|source|import "tailwindcss|...)'`) |
|---|---|---|
| theme.css | ZW009 forbidden @theme at 60:1 (only the first reported) | 3 |
| global.css | ZW009 forbidden @import at 12:1 (only first) | 9 |
| safelist.css | ZW009 forbidden @source at 2:1 | 1 |
| content.css / features.css / page-loading.css | pass directive scan (0 ZW009); then fail on the source candidates of 2d | 0 |

### 2h. safelist.css as a v3 manifest (MEASURED)
`safelist.css` = one `@source inline("...")` with 2693 tokens. `xargs -P8 zfb wind explain` over each (`$SCR/safelist-explain.tsv`, 32.8 s): resolved 469, marker 2, recognized invalid 204 (ZW005 slash 65, ZW002 51, ZW005 requires value 23, ZW004 arbitrary property 10, ZW004 arbitrary selector 7, ZW005 width 6, ZW004 family 5, ZW006 ...), ordinary class 2018. Because manifest entries are strict (ZW008 for unknown, ZW00x for invalid), gen-safelist must emit only the resolved subset (~469 + markers) or the manifest fails.

## 3. Explain probes (MEASURED; `$SCR/explain.out`, `$SCR/explain-summary.txt`, `$SCR/explain-var-probe.txt`)

Resolved: group-hover:text-accent (`:where(.group:hover) ...` inside `@media (hover:hover)`), group-focus-visible:underline, group-open:rotate-90, peer-hover:text-fg, after:absolute, hover:bg-accent/10 (`color-mix(in oklab, var(--zw-color-accent) 10%, transparent)`), text-[0.8em], w-[calc(100vw_-_2rem)], h-[calc(100%_-_3rem)], ml-[calc(..._+_1px)], -left-[calc(var(--spacing-icon-lg)/2)] (`calc(calc(...) * -1)`), shadow-[0_1px_3px_rgb(0_0_0/0.1)], shadow-[0_1px_3px_color-mix(in_srgb,red_8%,transparent)], -translate-x-full (`--zw-translate-x: -100%`), translate-x-0, rotate-180, transition-transform (`transform,translate,rotate,scale`), transition-[left,color], duration-200, sr-only, truncate, max-lg:hidden, lg:flex, first:mt-0, last:border-b-0, space-y-vsp-xs, divide-y, divide-muted, rounded, rounded-full, font-bold, text-small, size-icon-sm, w-full, min-w-0, grid-cols-[minmax(0,1fr)_auto], grid-cols-subgrid, z-modal, bg-bg/80, backdrop:bg-bg/80, placeholder:text-muted, focus-visible:outline-accent, outline-2, text-fg/60, border-warning/30, whitespace-nowrap, break-words, select-none, pointer-events-none, cursor-pointer, accent-accent, object-cover, aspect-video, list-disc, hidden, overflow-x-auto, overscroll-contain, inset-0, opacity-0, tabular-nums, shrink-0, col-span-2, items-baseline, bg-[var(--x)], p-[var(--x)], w-[var(--zd-sidebar-w)], w-[calc(var(--x)*2)], grid-cols-[var(--x)_1fr], bg-[color-mix(in_srgb,var(--x)_50%,transparent)], border-[var(--x)] (-> border-top-width!), transition-[max-width].
Rejected: group/index + group-hover/index:block (ZW004 named), peer-checked:* (ZW002 — `checked` is not an admitted state), data-[state=open]:*, aria-current:* (ZW004 attribute), [&_a]:*, [&>svg]:* (ZW004), text-[length:var(..)] and text-[color:var(..)] (ZW005 "not valid for font-size" — type hints unsupported), text-[var(--x)] (ZW005 ambiguous), w-/h-/min-h-/max-w-[calc(a-b)] (ZW005), ml-[calc(a+b)] (ZW005), shadow-[var(--x)], shadow-[0_1px_3px_var(--x)], shadow-[0_1px_3px_rgb(var(--x))], shadow-[..color-mix(..var(..)..)] (ZW005 "not valid for box-shadow"), m-[var(--a)_var(--b)] (ZW005), ease-in-out (ZW006 needs easings.in-out), animate-spin, ring-2, scale-95 (ZW004), 2xl:/print:/motion-reduce: (ZW002), rounded-l-DEFAULT (ZW006), leading-none (ZW006), p-4 / scroll-mt-4 (ZW006 needs spacingUnit), underline-offset-4 (ZW006 "unknown value or token offset-4"), underline-offset-[4px] (ZW005 arbitrary unsupported), !hidden (ZW004).
Silently ordinary (no diagnostic, no CSS): before:content-none, content-[""], not-sr-only, line-clamp-2, backdrop-blur-sm, appearance-none, invisible, will-change-transform, fill-current, stroke-current, basis-1/2, order-first, decoration-2, decoration-muted, wrap-anywhere.

## 4. zudo-react type/runtime probes (MEASURED)

`$SCR/tsprobe` (tsconfig jsx react-jsx, jsxImportSource @takazudo/zfb/zudo-react, strict, noUncheckedIndexedAccess):
- `src/desktop-toc-toggle.tsx` — port of packages/zudo-doc/src/desktop-toc-toggle-island/index.tsx using signal/computed/getScope().onActivate/scope.effect/on:click/Show/aria-pressed={signal}: 0 errors.
- `src/server-card.tsx` — class/for/readonly/tabindex/style object with CSS keys/rawHtml/Show/For/h()/renderToString: 0 errors.
- `src/react-habits.tsx` negative probe: className, htmlFor, dangerouslySetInnerHTML, style camelCase, tabIndex/readOnly all rejected (5 errors; "Did you mean 'tabindex'?" hint). Same results under TS 7.0.2 (1.5 s) and TS 5.9.3 (0.9 s): `$SCR/tsc-ts7.out`, `$SCR/tsc-ts59.out`.
- `src/attr-gaps.tsx`: rejected `meta property`, `link as`, `svg xmlns`/`focusable`, `iframe srcdoc`, `video preload`, `popover`, `popovertarget`, `<search>` element, `spellcheck={false}` (typed as string). `$SCR/tsc-attr-gaps.out`.
- Runtime (`node $SCR/proj/rt-probe.mjs` -> `$SCR/runtime-attr-probe.out`): renderToString throws `TypeError ZR_ATTRIBUTE: meta.property`, `link.as`, `svg.xmlns`, `iframe.srcdoc`, `div.popover`; `ZR_TAG: search`; `ZR_PROP_DIALECT: div.className`. Source of truth: allowlists in zfb `packages/zfb/src/zudo-react/render-html.ts:17-25` and `hydrate.ts:62-70` (`git -C $HOME/repos/myoss/zfb show v3.0.0:packages/zfb/src/zudo-react/render-html.ts`).

Whole-package port scale (`$SCR/tsport`, copy of packages/zudo-doc/src minus __tests__, 379 files, 141 `@jsxImportSource preact` pragmas rewritten to zudo-react; preact/react mapped to a missing path; other deps resolved from the repo node_modules read-only): `tsc 5.9.3 --noEmit` -> 858 output lines, errors: TS2322 313, TS2307 157 (preact 128, preact/hooks 16, preact/compat 9, 4 workspace subpaths), TS7006 43, TS2353 15, TS7016 5 (fs-extra types), TS2833 5 (`React` namespace), TS7031 3, TS7053 2, TS2578 2; 150 files with errors. Excess-property kinds (one per element, lower bound): className 168, xmlns 41, onClick 37, dangerouslySetInnerHTML 34, property 9, strokeWidth 3, strokeLinecap 3, focusable 2, as 2, tabIndex/srcSet/srcDoc/preload/dateTime/charSet/onInput/onChange 1 each. Top files: sidebar-tree-island 45, doc-history 45, site-tree-nav-island 21, ai-chat-modal 21, icons 16. Output `$SCR/tsport-ts59.out`.
Raw spelling counts in `$SCR/audit` (`grep -rEo ... | wc -l`): className= 360, class= 465, onClick= 57, dangerouslySetInnerHTML 57, xmlns= 45, property= 9, strokeWidth= 9, onChange= 27, onKeyDown= 5, style={{ 35, htmlFor= 2, tabIndex= 2. Repo-wide (non-test) hook calls: useState 33, useEffect 56, useRef 9, useMemo 13, useCallback 24, memo 4, createPortal 1, cloneElement 1; "use client" files 23; `<Island` 37; preact import lines: preact 140, preact/hooks 17, preact/compat 9.

## 5. End-to-end build (MEASURED)

`npx --prefix $SCR/proj zfb new e2e` (basic-blog; runs pnpm install itself, 1.6 s; zudo-react + zudo-wind owned-v1, 42 colour tokens). `zfb build`: 6 pages in 0.35 s, wall 0.69 s, 98.8 MB RSS (`$SCR/e2e-build1.log`). Added `components/toc-toggle.tsx` (setup-once island with Show+For, onActivate, effect, on:click, aria-pressed signal) wrapped in `<Island when="idle">` in pages/index.tsx: build 0.37 s / wall 0.74 s (`$SCR/e2e-build2.log`); wrapper `<div data-zfb-island="TocToggle" data-when="idle" data-zfb-transport="json/1" data-zfb-protocol="zudo-react/1" data-zfb-build="29fbe65641162bd2" data-props="{...}">`; islands bundle 50,052 B, styles 22,070 B; CSS contains space-y-1, group-hover, first, rounded-md, hover:text-accent.
Headless Chromium (`node $SCR/tools/hydrate-check.cjs` against `zfb preview --port 48721`, `$SCR/e2e-hydrate.out`): activation observed at 1055 ms (idle scheduling), SSR list 3 items, click -> aria-pressed false, list removed, Show fallback "hidden", localStorage "false"; second click restores 3 items; no console errors.

## 6. zfb-md-wasm 3.0.0 (MEASURED)
Exports `. ./highlight ./render ./parse`. `compile("# Hi <Foo/>")` emits `import { jsx as _jsx, jsxs as _jsxs } from "@takazudo/zfb/zudo-react/jsx-runtime"` and `Fragment` from the same path. Passing `jsxRuntime` returns `{code: null, diagnostics:[{severity:"error", source:"options", message:"invalid options JSON: unknown field `jsxRuntime`, expected one of `filename`, `dialect`, `development`, `pipeline`"}]}` (does not throw) — `$SCR/proj/md-probe2.mjs`. zudo-doc source has no `jsxRuntime` option usage outside `@jsxRuntime automatic` pragmas (grep).

## 7. Source-plan note (MEASURED from zfb source; INFERENCE for consumers)
`crates/zfb/src/commands/css_source_plan.rs` builds the wind plan from: DEFAULT_CONTENT_ROOTS, package-route entrypoint parent dirs (required), tsconfig sibling-mirror roots, the root package if a workspace claims it, plugin virtual modules, role classes, manifests, safelist. There is no user config key for "declared package roots"; the docs mention them (`zudo-wind/sources-and-candidates.mdx:9,55`, `concepts/styling.mdx:42`) without saying how to declare one. INFERENCE: a scaffolded consumer will not scan `node_modules/@takazudo/zudo-doc/dist/**` chrome classes except the directories of package-injected route entrypoints, so zudo-doc must ship a `wind.manifests` JSON (and inject it via zudoDoc()).

### Census: distinct tokens in utility-bearing literals (explain verdict per token)

| token | outcome | code | msg | occ | first file |
|---|---|---|---|---|---|
| `group` | marker |  |  | 16 | src/zudo-doc/doc-pager/index.tsx |
| `peer` | marker |  |  | 2 | src/zudo-doc/nav-indexing/note-tray-index-parts/timeline.tsx |
| `zd-asset-stage` | ordinary class |  |  | 2 | src/zudo-doc/asset-page/components.tsx |
| `zd-content` | ordinary class |  |  | 2 | src/zudo-doc/details/details.tsx |
| `zd-desktop-toc-toggle` | ordinary class |  |  | 1 | src/zudo-doc/desktop-toc-toggle-island/index.tsx |
| `doc-history-trigger` | ordinary class |  |  | 1 | src/zudo-doc/doc-history/index.tsx |
| `doc-history-panel` | ordinary class |  |  | 1 | src/zudo-doc/doc-history/index.tsx |
| `zd-asset-filebar` | ordinary class |  |  | 1 | src/zudo-doc/asset-page/components.tsx |
| `zd-enlargeable` | ordinary class |  |  | 1 | src/zudo-doc/asset-page/components.tsx |
| `is-checker` | ordinary class |  |  | 1 | src/zudo-doc/asset-page/components.tsx |
| `zd-asset-pdf` | ordinary class |  |  | 1 | src/zudo-doc/asset-page/components.tsx |
| `zd-asset-details-toggle` | ordinary class |  |  | 1 | src/zudo-doc/asset-page/components.tsx |
| `zd-home-hero` | ordinary class |  |  | 1 | src/zudo-doc/home-page/index.tsx |
| `zd-home-inner` | ordinary class |  |  | 1 | src/zudo-doc/home-page/index.tsx |
| `zd-home-copy` | ordinary class |  |  | 1 | src/zudo-doc/home-page/index.tsx |
| `wrap-anywhere` | ordinary class |  |  | 1 | src/zudo-doc/home-page/index.tsx |
| `zd-home-links` | ordinary class |  |  | 1 | src/zudo-doc/home-page/index.tsx |
| `zd-home-heading` | ordinary class |  |  | 1 | src/zudo-doc/home-intro/index.tsx |
| `use` | ordinary class |  |  | 1 | src/zudo-doc/eject/index.ts |
| `that` | ordinary class |  |  | 1 | src/zudo-doc/eject/index.ts |
| `wrapper` | ordinary class |  |  | 1 | src/zudo-doc/eject/index.ts |
| `if` | ordinary class |  |  | 1 | src/zudo-doc/eject/index.ts |
| `its` | ordinary class |  |  | 1 | src/zudo-doc/eject/index.ts |
| `home` | ordinary class |  |  | 1 | src/zudo-doc/eject/index.ts |
| `should` | ordinary class |  |  | 1 | src/zudo-doc/eject/index.ts |
| `change.` | ordinary class |  |  | 1 | src/zudo-doc/eject/index.ts |
| `zd-desktop-sidebar-toggle` | ordinary class |  |  | 1 | src/zudo-doc/desktop-sidebar-toggle-island/index.tsx |
| `assetViewer.` | ordinary class |  |  | 1 | src/zudo-doc/asset-path/index.ts |
| `must` | ordinary class |  |  | 1 | src/zudo-doc/asset-path/index.ts |
| `be` | ordinary class |  |  | 1 | src/zudo-doc/asset-path/index.ts |
| `with` | ordinary class |  |  | 1 | src/zudo-doc/asset-path/index.ts |
| `no` | ordinary class |  |  | 1 | src/zudo-doc/asset-path/index.ts |
| `or` | ordinary class |  |  | 1 | src/zudo-doc/asset-path/index.ts |
| `trailing` | ordinary class |  |  | 1 | src/zudo-doc/asset-path/index.ts |
| `slash` | ordinary class |  |  | 1 | src/zudo-doc/asset-path/index.ts |
| `version-switcher` | ordinary class |  |  | 1 | src/zudo-doc/i18n-version/version-switcher.tsx |
| `zd-enlarge-dialog` | ordinary class |  |  | 1 | src/zudo-doc/island-types/index.ts |
| `zd-mermaid-dialog` | ordinary class |  |  | 1 | src/zudo-doc/island-types/index.ts |
| `zd-toc-col` | ordinary class |  |  | 1 | src/zudo-doc/doc-page-shell/index.tsx |
| `zd-doc-content-band` | ordinary class |  |  | 1 | src/zudo-doc/doclayout/doc-layout.tsx |
| `ai-chat-md` | ordinary class |  |  | 1 | src/zudo-doc/ai-chat-modal/index.tsx |
| `tabs-container` | ordinary class |  |  | 1 | src/zudo-doc/code-syntax/tabs.tsx |
| `tabs-nav` | ordinary class |  |  | 1 | src/zudo-doc/code-syntax/tabs.tsx |
| `zd-preset-gen` | ordinary class |  |  | 1 | components/preset-generator.tsx |
| `ease-in-out` | recognized invalid or malformed | ZW006 | unknown value or token in-out | 3 | src/zudo-doc/asset-page/components.tsx |
| `leading-none` | recognized invalid or malformed | ZW006 | unknown value or token none | 3 | src/zudo-doc/nav-indexing/note-tray-index-parts/index-list.tsx |
| `rounded-l-DEFAULT` | recognized invalid or malformed | ZW006 | unknown value or token DEFAULT | 2 | src/zudo-doc/asset-page/components.tsx |
| `py-[calc(var(--spacing-vsp-xs)+0.15rem)]` | recognized invalid or malformed | ZW005 | value is not valid for padding-top | 2 | src/zudo-doc/sidebar-tree-island/index.tsx |
| `[&_a]:underline` | recognized invalid or malformed | ZW004 | arbitrary-selector variants are unsupported | 2 | src/zudo-doc/footer/footer.tsx |
| `[&_a:hover]:text-accent` | recognized invalid or malformed | ZW004 | arbitrary-selector variants are unsupported | 2 | src/zudo-doc/footer/footer.tsx |
| `[&_a:focus-visible]:text-accent` | recognized invalid or malformed | ZW004 | arbitrary-selector variants are unsupported | 2 | src/zudo-doc/footer/footer.tsx |
| `position:` | recognized invalid or malformed | ZW001 | empty candidate, variant or utility | 2 | src/zudo-doc/island-types/index.ts |
| `[&::-webkit-details-marker]:hidden` | recognized invalid or malformed | ZW004 | arbitrary-selector variants are unsupported | 2 | src/zudo-doc/nav-indexing/docs-sitemap.tsx |
| `2xl:w-[24px]` | recognized invalid or malformed | ZW002 | unknown or unconfigured variant | 2 | src/zudo-doc/site-tree-nav-island/index.tsx |
| `h-[calc(100vh-3.5rem)]` | recognized invalid or malformed | ZW005 | value is not valid for width | 2 | src/zudo-doc/doclayout/doc-layout.tsx |
| `rounded-md` | recognized invalid or malformed | ZW006 | unknown value or token md | 1 | src/zudo-doc/theme-pack-dialog/theme-pack-card.tsx |
| `py-hsp-3xs` | recognized invalid or malformed | ZW006 | unknown value or token hsp-3xs | 1 | src/zudo-doc/theme-pack-dialog/theme-pack-card.tsx |
| `w-[calc(100vw-2rem)]` | recognized invalid or malformed | ZW005 | value is not valid for width | 1 | src/zudo-doc/theme-pack-dialog/index.tsx |
| `max-w-sm` | recognized invalid or malformed | ZW006 | unknown value or token sm | 1 | src/zudo-doc/theme-pack-dialog/index.tsx |
| `animate-pulse` | recognized invalid or malformed | ZW004 | recognized utility family is unsupported | 1 | src/zudo-doc/theme-pack-dialog/index.tsx |
| `shadow-md` | recognized invalid or malformed | ZW006 | unknown value or token md | 1 | src/zudo-doc/find-in-page/find-bar.tsx |
| `animate-spin` | recognized invalid or malformed | ZW004 | recognized utility family is unsupported | 1 | src/zudo-doc/doc-history/index.tsx |
| `h-[calc(100%-3rem)]` | recognized invalid or malformed | ZW005 | value is not valid for width | 1 | src/zudo-doc/doc-history/index.tsx |
| `max-w-[calc(100vw-2rem)]` | recognized invalid or malformed | ZW005 | value is not valid for width | 1 | src/zudo-doc/theme-pack-switcher/index.tsx |
| `[&_li]:mb-0` | recognized invalid or malformed | ZW004 | arbitrary-selector variants are unsupported | 1 | src/zudo-doc/nav-indexing/note-tray-index-parts/timeline.tsx |
| `[&_a]:pointer-events-auto` | recognized invalid or malformed | ZW004 | arbitrary-selector variants are unsupported | 1 | src/zudo-doc/nav-indexing/note-tray-index-parts/card-list.tsx |
| `ml-[calc(var(--spacing-hsp-xl)+1px)]` | recognized invalid or malformed | ZW005 | value is not valid for margin-left | 1 | src/zudo-doc/nav-indexing/note-tray-index-parts/card-list.tsx |
| `mr-[calc(var(--spacing-hsp-xl)+1px)]` | recognized invalid or malformed | ZW005 | value is not valid for margin-right | 1 | src/zudo-doc/nav-indexing/note-tray-index-parts/card-list.tsx |
| `[&_nav]:mb-0` | recognized invalid or malformed | ZW004 | arbitrary-selector variants are unsupported | 1 | src/zudo-doc/breadcrumb/breadcrumb.tsx |
| `rounded-r-DEFAULT` | recognized invalid or malformed | ZW006 | unknown value or token DEFAULT | 1 | src/zudo-doc/desktop-sidebar-toggle-island/index.tsx |
| `leading` | recognized invalid or malformed | ZW005 | utility requires a value | 1 | src/zudo-doc/asset-path/index.ts |
| `max-w-[calc(100vw-var(--spacing-hsp-xl))]` | recognized invalid or malformed | ZW005 | value is not valid for width | 1 | src/zudo-doc/i18n-version/language-switcher.tsx |
| `shadow-[0_1px_3px_color-mix(in_srgb,var(--color-fg)_8%,transparent)]` | recognized invalid or malformed | ZW005 | value is not valid for box-shadow | 1 | src/zudo-doc/html-preview-wrapper/preview-base.tsx |
| `display:` | recognized invalid or malformed | ZW001 | empty candidate, variant or utility | 1 | src/zudo-doc/sidebar-toggle-island/index.tsx |
| `min-h-[calc(100vh-3.5rem)]` | recognized invalid or malformed | ZW005 | value is not valid for width | 1 | src/zudo-doc/doclayout/doc-layout.tsx |

### Resolved utilities: top 60 by occurrence

`flex`(168), `text-muted`(164), `items-center`(130), `border-muted`(122), `text-small`(118), `text-fg`(106), `text-caption`(92), `border`(80), `hover:text-accent`(53), `shrink-0`(51), `hidden`(51), `bg-surface`(50), `rounded`(49), `hover:underline`(47), `py-vsp-2xs`(46), `px-hsp-lg`(43), `block`(37), `justify-center`(34), `focus-visible:text-accent`(34), `font-bold`(33), `px-hsp-sm`(31), `px-hsp-md`(31), `font-medium`(31), `focus-visible:underline`(30), `flex-col`(28), `py-vsp-xs`(28), `relative`(28), `transition-colors`(27), `min-w-0`(27), `hover:text-fg`(27), `text-title`(26), `border-b`(25), `gap-hsp-xs`(25), `gap-x-hsp-xs`(24), `break-words`(24), `font-mono`(22), `w-full`(22), `mb-vsp-xs`(22), `gap-hsp-sm`(21), `flex-wrap`(21), `w-icon-sm`(20), `flex-1`(20), `font-semibold`(20), `inline-flex`(19), `py-vsp-3xs`(19), `h-icon-sm`(18), `grid`(18), `group-hover:text-accent`(18), `group-focus-visible:text-accent`(18), `bg-bg`(17), `text-heading`(17), `fixed`(17), `mb-vsp-md`(17), `hover:border-accent`(16), `focus:underline`(15), `accent-accent`(15), `focus-visible:outline-2`(14), `focus-visible:outline-accent`(14), `py-vsp-sm`(14), `border-l`(14)

## Scratch outputs
- <planning-scratch>/explore/v3-probe/[0m[01;36m.[0m/
- <planning-scratch>/explore/v3-probe/[01;36m..[0m/
- <planning-scratch>/explore/v3-probe/[01;36maudit[0m/
- <planning-scratch>/explore/v3-probe/audit-reset-none.err
- <planning-scratch>/explore/v3-probe/audit-reset-none.out
- <planning-scratch>/explore/v3-probe/audit-reset-none.out.json
- <planning-scratch>/explore/v3-probe/audit-tokens.err
- <planning-scratch>/explore/v3-probe/audit-tokens.out
- <planning-scratch>/explore/v3-probe/audit-tokens.out.json
- <planning-scratch>/explore/v3-probe/census-tables.md
- <planning-scratch>/explore/v3-probe/census-tokens-classlits.json
- <planning-scratch>/explore/v3-probe/census-tokens.json
- <planning-scratch>/explore/v3-probe/config-reset-none.ts
- <planning-scratch>/explore/v3-probe/config-tokens.ts
- <planning-scratch>/explore/v3-probe/css-directive-probe.txt
- <planning-scratch>/explore/v3-probe/[01;36me2e[0m/
- <planning-scratch>/explore/v3-probe/e2e-build1.log
- <planning-scratch>/explore/v3-probe/e2e-build2.log
- <planning-scratch>/explore/v3-probe/e2e-hydrate.out
- <planning-scratch>/explore/v3-probe/e2e-preview.log
- <planning-scratch>/explore/v3-probe/explain-summary.txt
- <planning-scratch>/explore/v3-probe/explain-var-probe.txt
- <planning-scratch>/explore/v3-probe/explain.out
- <planning-scratch>/explore/v3-probe/install.log
- <planning-scratch>/explore/v3-probe/[01;36mproj[0m/
- <planning-scratch>/explore/v3-probe/runtime-attr-probe.out
- <planning-scratch>/explore/v3-probe/safelist-explain.tsv
- <planning-scratch>/explore/v3-probe/safelist-tokens.txt
- <planning-scratch>/explore/v3-probe/[01;36mtools[0m/
- <planning-scratch>/explore/v3-probe/[01;36mts59[0m/
- <planning-scratch>/explore/v3-probe/tsc-attr-gaps.out
- <planning-scratch>/explore/v3-probe/tsc-ts59.out
- <planning-scratch>/explore/v3-probe/tsc-ts7.out
- <planning-scratch>/explore/v3-probe/[01;36mtsport[0m/
- <planning-scratch>/explore/v3-probe/tsport-ts59.out
- <planning-scratch>/explore/v3-probe/[01;36mtsprobe[0m/
