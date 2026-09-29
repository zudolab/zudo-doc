# css-wind: zudo-doc CSS + Tailwind v4 -> zudo-wind v1 (zfb 3.0.0) map

Tree measured: zudo-doc `main` @ 337b9f110 (5.28.2). Upstream: zfb tag v3.0.0 (read with `git show`).
Scratch root: `<planning-scratch>/explore/css-wind/` (abbrev `$S`).
Nothing inside `$HOME/repos/**` was modified. zfb 3.0.0 was installed ONLY in `$S/zfb3/` (`npm install @takazudo/zfb@3.0.0`, `npx zfb --version` -> `zfb 3.0.0`).

Legend: **M** = measured (command shown), **I** = inference, **U** = unverified.

---

## 0. Tools written (all under $S)

| File | Purpose |
| --- | --- |
| `scan-classes.mjs` | TypeScript-AST scanner over git-tracked `pages/** src/** packages/zudo-doc/src/** packages/create-zudo-doc/templates/**` (`.ts/.tsx/.js/.jsx/.md/.mdx`, `__tests__` excluded). Records every class-shaped token with a confidence (`high` = JSX class/className attr, cn/clsx/cx call, classList/setAttribute("class"), identifiers matching /class/i, class attrs embedded inside string literals; `low` = any other literal) + dynamic construction sites. Output `raw.json`. |
| `css-classes.mjs` | Extracts unescaped class selectors from CSS (built vs authored). Outputs `built.json`, `authored.json`. |
| `explain-one.sh` | Runs real `zfb wind explain` (v3.0.0) against the draft config in `zfb3/probe/zfb.config.json`. |
| `draft-wind-config.json` | Draft `wind` config for zudo-doc (section 5). |
| `explain.tsv`, `explain-all.tsv`, `explain-authored.tsv`, `explain-probes.tsv` | Authoritative per-token zudo-wind outcomes. |
| `joined.json` | token x outcome x per-file occurrence counts. |
| `probe2/` | `git archive HEAD pages src packages/zudo-doc/src packages/create-zudo-doc/templates` copy + draft config; used for a real `zfb css` compile and `zfb wind audit`. |
| `zfbcss-errors.txt` | The build-breaking diagnostics from that real compile. |
| `audit-probe2.txt` | `zfb wind audit` output. |
| `spec010.mjs` / `spec010.json` | Crude count of authored unlayered selectors with specificity exactly (0,1,0). |
| `count-class-attrs.mjs` | Counts JSX class/className attribute sites. |
| `gap-files.tsv` | Every gap token -> file(s). |

Re-run everything: `node scan-classes.mjs <repo> raw.json && tr '\n' '\0' < tokens.txt | xargs -0 -n1 -P12 ./explain-one.sh > explain.tsv && node join.mjs`.

---

## 1. CSS files with Tailwind constructs (M)

Command (non-comment directive census):
`node -e '...strip /*...*/ ... match @(theme|source|apply|utility|variant|custom-variant|plugin|config|reference|tailwind) | @import "tailwindcss..." | @import ".../safelist.css"'` per file.

| File | Tailwind constructs (non-comment) | Notes |
| --- | --- | --- |
| `src/styles/global.css` (106 lines) | `@import "tailwindcss/preflight" layer(zd-preflight)` x1, `@import "tailwindcss/utilities"` x1, `@import "@takazudo/zudo-doc/safelist.css"` x1, `@source` x6, `@theme` x1 (1 token: `--color-page-loading-overlay`) | also `@layer zd-preflight, zd-flow;`; 5 authored `.zd-fm-pill--*` rules |
| `packages/zudo-doc/src/theme.css` (379 lines) | `@theme` x1, `@theme static` x1, `@theme inline` x1 | `@layer base { a / button / :focus-visible }`; `:root` Tier-1 scale; version-switcher `.hidden:has(...)` pin |
| `packages/zudo-doc/src/compiled.entry.css` (17 lines) | preflight + utilities imports, safelist import, `@source not` x2 (`./dist/catalog.js`, `./src/**/__tests__/**`) | entry for committed `dist/compiled.css` |
| `packages/create-zudo-doc/templates/base/src/styles/global.css` (28 lines) | preflight + utilities + safelist imports, `@source` x3, `@theme` x1 (empty) | scaffold template |
| `packages/zudo-doc/src/__tests__/fixtures/target-manifest/src/styles/global.css` (25 lines) | same shape as template (+ zdtp import) | snapshot fixture |
| `packages/zudo-doc/dist/safelist.css` (generated, not tracked) | `@source inline("...")` x1 (2,693 tokens) | imported by all four entry sheets -> ZW009 |

**Correction to the task premise (M):** `packages/zudo-doc/src/page-loading.css`, `content.css`, `features.css` contain ZERO Tailwind directives/functions outside comments (`content.css: 0, features.css: 0, page-loading.css: 0`). They mention `@theme` only in comments; zudo-wind's ZW009 scanner ignores comments. Only `theme.css` among package sources has real directives. No file uses `@apply`, `@utility`, `@variant`, `@custom-variant`, `@plugin`, `@config`, `theme()`, `--spacing()`, `--alpha()`, `--value()` (M, same command).

Other relevant CSS: 30 `theme-packs/*/pack.css` (plain CSS; set `--zd-*`, `--font-sans/mono/display` on `html[data-theme-pack=...]` = the `:root` element), `@takazudo/zdtp/styles.css` -> `dist/zdtp.css` (plain, 0 directives: `grep -cE '@theme|@apply|@source|tailwind|@layer|theme\(' dist/zdtp.css` -> 0).

### 1a. `@theme` token namespaces in theme.css (M)
Command: `awk '/@theme/{inb=1;next} inb&&/^}/{inb=0} inb' theme.css | grep -oE '^\s*--[a-zA-Z0-9*-]+' | sed ... | sort | uniq -c`

| Namespace | Count | Block |
| --- | --- | --- |
| `--color-*: initial` (tight reset) | 1 | @theme |
| `--color-*` bare semantic aliases (bg, fg, sel-bg/fg, surface, muted, accent, accent-hover, code-bg/fg, success/danger/warning/info, overlay, image-overlay-bg/fg, chat-*, matched-keyword-bg/fg) | 23 | @theme |
| `--color-zd-*` embedder namespace | 23 | @theme static |
| `--spacing-0`, `--spacing-px`, `--spacing-image-overlay-inset` | 3 | @theme |
| `--spacing-hsp-*` | 7 | @theme |
| `--spacing-vsp-*` | 8 | @theme |
| `--spacing-icon-*` | 4 | @theme |
| `--shadow-lg` | 1 | @theme |
| `--text-*` (micro..display, var(--text-scale-*)) | 7 | @theme |
| `--font-sans/mono` | 2 | @theme |
| `--font-weight-*` | 4 | @theme |
| `--leading-*` | 4 | @theme |
| `--tracking-*` | 4 | @theme |
| `--radius-DEFAULT/lg/full` | 3 | @theme |
| `--breakpoint-sm/lg/xl` | 3 | @theme |
| `--z-index-*` | 13 | @theme inline |
| **Total declarations** | **110** in 3 blocks | |

No animation/keyframe tokens in @theme; `@keyframes` live in features.css (contentFadeIn/Out) and page-loading.css (page-loading-spin) as authored CSS. Tier-1 `--text-scale-*` + `--default-transition-duration`, `--zd-transition-*`, `--zd-header-h`, `--zd-sidebar-w` live in plain `:root` already.

---

## 2. How tokens flow today and what assumes Tailwind

Flow (from `src/CLAUDE.md`, `packages/zudo-doc/CLAUDE.md` "Shipped CSS artifacts", `.claude/skills/zudo-doc-design-system/SKILL.md`):

1. **Tier 1 ramps** `--zd-*`, `--palette-*` injected on `:root` by `ColorSchemeProvider` (sets `data-theme` + `style.colorScheme` on `<html>`; `color-scheme-provider.tsx:92-94`). Theme packs override `--zd-*`/`--font-*` on `html[data-theme-pack=...]`.
2. **Tier 2 semantic** `@theme { --color-bg: var(--zd-bg) ... }` -> Tailwind emits them to `:root, :host` (M: `dist/compiled.css:2246-2247`) AND generates utilities `bg-bg`, `text-fg`, `p-hsp-sm`, `text-body`, `z-toolbar`...
3. **Tier 3** component tokens `--zdc-*` generated by `bin/gen-component-tokens.mjs` from `src/config/component-tokens.ts` into BEGIN/END blocks of content.css/features.css. Pure CSS custom properties; **no Tailwind dependency** (I).
4. Font sizes: Tier1 `--text-scale-*` in `:root` (deliberately NOT @theme to avoid `text-scale-*` utilities) -> Tier2 `--text-*` in @theme -> `text-body` utilities.
5. Z-index: 13 `@theme inline` tiers (+ `gen-z-index` bin that emits an `@theme {}` block for overriding projects -> must change output format).
6. `design-token-lint` (`@takazudo/zudo-design-token-lint` 2.1.0, `.design-token-lint.json`) prohibits numeric spacing `p-{n}`..., `z-{n}`, palette colors `bg-{color}-{shade}` in `src/**/*.tsx`, `packages/**/*.tsx`.
7. zdtp panel edits CSS vars on `documentElement` (`--spacing-*`, `--text-scale-*`, colors via `--zd-*`) (I from src/CLAUDE.md).

Tailwind assumptions baked in:
- `--color-*: initial` guardrail + `theme-no-reset.css` variant (#4051/#4055) exist only because Tailwind merges every `@theme` and may leak its default palette. zudo-wind has **no implicit palette** and no `@theme` -> both become meaningless (I).
- `@theme static` exists only because Tailwind emits non-static theme vars lazily. Plain `:root` always emits (I).
- Numeric spacing is "inert" because no bare `--spacing` exists (M: `grep -c 'calc(var(--spacing)' dist/compiled.css` -> 0; guarded by `no-inert-spacing-utilities.test.ts`). Under wind, omitting `spacingUnit` makes numeric spacing a **hard ZW006** at class positions (M: `zfb wind explain mt-1` -> `ZW006 ... nonzero numeric spacing requires spacingUnit`). => compiler-enforced tight-token policy.
- Palette colors `bg-gray-500` would be ZW006 at class positions under wind (no colors configured) (I from spec R17 + explain behaviour).
- Utilities are imported **unlayered** and placed **before** authored CSS (M: `.flex` at `dist/compiled.css:537`, first authored `[id] {` at 2360, `.zd-content {` at 2412; showcase `dist/assets/styles-*.css`: `.flex` at 667, `[id]` at 4359). Layers today: `@layer properties; @layer zd-preflight, zd-flow;` then `zfb-hi`, `base` (M: `grep -nE '^@layer' dist/compiled.css`).
- Utilities are verified unlayered and there is **no `dark:` usage** (M: `node -e ... filter(/(^|:)dark:/)` -> `[]`). Dark mode is `data-theme` + `light-dark()`/scheme vars; no variant needed.

---

## 3. Package CSS build today and what the v3 manifest replaces

tsup `onSuccess` (`packages/zudo-doc/tsup.config.ts:101-112`): copy-theme-css (+ theme-no-reset via `theme-css-variants.mjs`), copy-content-css, copy-page-loading-css, copy-features-css, **gen-safelist.mjs**, **gen-compiled-css.mjs** (one-shot only), ...
- `gen-safelist.mjs`: lexes `dist/**/*.js` string literals, keeps Tailwind-shaped tokens -> `dist/safelist.css` = one `@source inline("...")`. M: 2,693 tokens (`sed -n 's/.*@source inline("\(.*\)");.*/\1/p' dist/safelist.css | tr ' ' '\n' | grep -v '^$' | wc -l`).
- `gen-compiled-css.mjs`: `zfb css --input src/compiled.entry.css --output dist/compiled.css --project-root packages/zudo-doc --source 'src/**/*.{tsx,ts,jsx,js}' --source 'dist/**/*.{tsx,ts,jsx,js}' --no-auto-source --code-highlight-mode class`; asserts banner `tailwindcss v4.2.0`, size >= 75,000 B, `.bg-surface{background-color:var(--color-surface)}` etc. `dist/compiled.css` is **git-tracked** (M: `git ls-files packages/zudo-doc/dist` -> `packages/zudo-doc/dist/compiled.css`), 92,343 B, 611 class selectors / 517 non-authored utilities.
- Guards: `prepack` -> `check-theme-css`, `check-safelist`, `check-compiled-css` (byte compare) ...; root `scripts/check-package-safelist.mjs` (b4push "safelist check" + pr-checks) demands every responsive/arbitrary utility in `src/**/*.tsx` be in dist/safelist.css (`// safelist-ok:` escape).

What v3 replaces (M = upstream source):
- `@source inline` -> **ZW009**. Replacement: `wind.manifests.<producer> = { path }` + a `WindCandidateManifestV1` JSON `{schemaVersion:1, specVersion:1, producer, candidates[]}` (`crates/zfb/src/commands/css_source_plan.rs:153-185`, deny_unknown_fields). Path resolution: `./`/`../` relative to the declaring package when stamped by `definePreset(sourcePackage, …)` (`crates/zfb-config-loader/js/zfb-config-stub.mjs:26-43`), else project root; bare specifiers resolve through package `exports` (`resolve_manifest_path`, css_source_plan.rs:187-205). zudo-doc's `zudoDoc()` does NOT use `definePreset` (M: `grep -rln definePreset packages/zudo-doc/src` -> none) -> use a package-specifier path such as `@takazudo/zudo-doc/wind-manifest.json` + an `exports` entry.
- Manifest entries are **strict**: every entry must resolve (ZW001-ZW008 fail the pass). M: of the current 2,693 safelist tokens under the draft config: 469 resolved + 2 markers, 2,018 ordinary (junk words), 204 recognized-invalid (`awk ... explain-all.tsv | sort | uniq -c`). So the generator must filter to ~471 (17.5%).
- No JS/wasm validator API is exposed for the filter (U: searched release notes/docs; only CLI `explain`/`audit`). Measured workaround: compile the dist JS with `zfb css` and read back the emitted selectors (valid-only) — but see the dist-exclusion trap below.
- `@source not` -> no replacement: CLI `--source` rejects `!` globs (M: `zfb css ... --source '!src/**/__tests__/**'` -> `matched zero files (resolved as .../!src/**/__tests__/**)`), and `__tests__` is NOT excluded by default (M: probe3 `src/__tests__/t.tsx` class `grid` was emitted).
- **Dist trap (M):** with `--project-root X --source 'dist/**/*.{tsx,js}'`, the glob "matches" (no error) but produces NO candidates (`o1.css` had only `.grid .inline-flex` from src). `pkgdist/dist/*.js` under a different root DID emit `.block`. => `gen-compiled-css.mjs`'s second `--source dist/**` silently becomes a no-op in v3.
- Build/dev source plan (M: `crates/zfb-css/src/engine.rs:12` `DEFAULT_CONTENT_ROOTS = ["pages","components","layouts","content","src"]`; `css_source_plan.rs:78-133`): default roots + package-route entrypoint parents + tsconfig-alias sibling "mirror roots" + claimed root package + plugin virtual modules + manifests + safelist. There is no config key for arbitrary extra roots. The showcase's `@source packages/zudo-doc/src/**` and `packages/create-zudo-doc/templates/**` have no direct equivalent -> manifest (package) + nothing (templates are not rendered by the showcase; I).

---

## 4. Measured utility inventory

### 4a. Volume (M)
- Files scanned: 1,088 (`node scan-classes.mjs <repo> raw.json` -> `files=1088 occurrences=15597 dynamicSites=57`).
- JSX `class`/`className` attribute sites (`node count-class-attrs.mjs <repo>`): **786** total = packages/zudo-doc/src 700, src 82, pages 4, templates 0. Initializers: string 645, template-with-interp 49, Identifier 37, Binary 20, Call 18, Conditional 16, template-static 1. `git grep -o 'className=' -- 'packages/zudo-doc/src/**/*.tsx' ':!**/__tests__/**' | wc -l` -> **279** (#3328 claimed ~272: corroborated); `class=` 439 more.
- Distinct tokens at >=1 high-confidence position: 900 (4,860 high occurrences) — includes ordinary authored classes.
- zudo-wind outcome of all 3,046 distinct scanned tokens (`cut -f2 explain.tsv | sort | uniq -c`): resolved 482, ordinary 2,309, recognized-invalid 253, marker 2.
- **Resolved utilities: 482 distinct / 3,930 occurrences** (#3328 claimed 480 / 3,279; distinct corroborated, occurrence count differs by scanner scope).
- Utility-shaped at class positions (resolved+invalid+marker, >=1 high): 549 distinct / 4,188 occurrences.
- Top families (occurrences): text-muted 190, flex 181, text-accent 178, text-fg 154, py-* 153, bg-* 152, underline 151, px-* 131, border-muted 131, items-center 130, text-small 128, w-* 115, text-caption 94, h-* 83, border 82, mb-* 68, block 67, gap-hsp 64, hidden 56 ...
- Variants among resolved (occurrence-weighted): hover 205, focus-visible 127, group-hover 46, lg 42, sm 37, focus 34, group-focus-visible 32, disabled 14, backdrop 11, xl 4, group-focus-within 3, placeholder 3, first/last/focus-within/group-open/peer-hover/peer-focus-visible 2 each. **No stacked variants** (0 resolved tokens with >1 variant), no `max-*`, no `dark:`.
- Markers: `group` (25 occ), `peer` (5 occ) — unnamed; valid in v1. No named `group/x`.
- Colour opacity modifiers (all valid): 19 distinct (e.g. `bg-overlay/60`, `hover:bg-danger/10`, `text-fg/60`). Negatives (valid): `-mb-px -mt-px -left-[calc(var(--spacing-icon-lg)/2)] -mx-hsp-lg -ml-hsp-sm -translate-x-full`. Arbitrary values resolved: 95.
- Zero at any position: `aria-*`/`data-*` variants, arbitrary properties `[prop:val]`, `!important` utilities, named group/peer, `motion-*`/`print:`/`supports-`/`has-`/`not-` variants (M: `node -e ... pick(...)` block).
- Dynamic class construction: 57 interpolation/concat sites flagged, only **1** in a class position and it builds authored classes (`content-admonition/index.tsx:44` `` `admonition admonition-${variant}` ``). No dynamic *utility* construction (M, list in raw.json `dynamic`).

### 4b. Build-breaking under v3 (authoritative real compile, M)
Command: in `$S/probe2`: `zfb css --input entry.css --output out.css --no-auto-source --source 'pages/**/*.{tsx,ts}' --source 'src/**/*.{tsx,ts,mdx,md}' --source 'packages/zudo-doc/src/**/*.{tsx,ts}' --source 'packages/create-zudo-doc/templates/**/*.{tsx,ts,mdx,md}'` -> exit 1, **30 diagnostics / 24 unique** (`zfbcss-errors.txt`):

| Candidate | Code | File(s) | Fix class |
| --- | --- | --- | --- |
| `ease-in-out` x3 | ZW006 | asset-page/components.tsx:197, desktop-sidebar-toggle-island:98, desktop-toc-toggle-island:103 | token `easings.in-out` or rename `ease-[ease-in-out]` (NB: dead today — no `--ease-in-out`, `grep -c` 0 in compiled.css) |
| `rounded-l-DEFAULT` x2, `rounded-r-DEFAULT` x1 | ZW006 | same 3 files | rename `rounded-l`/`rounded-r` (uppercase DEFAULT invalid; `radii.default`) |
| `[&_li]:mb-0` x2, `[&::-webkit-details-marker]:hidden` x2, `[&_nav]:mb-0`, `[&_a]:pointer-events-auto` | ZW004 | note-tray index-list/timeline, docs-sitemap, site-tree-nav-demo, breadcrumb, card-list | authored CSS |
| `animate-spin`, `animate-pulse` | ZW004 | doc-history/index.tsx, theme-pack-dialog/index.tsx | authored keyframe classes |
| `2xl:w-[24px]` x2 | ZW002 | site-tree-nav-island | dead today (no 2xl bp); delete or add breakpoint |
| `max-w-sm`, `shadow-md`, `rounded-md`, `py-hsp-3xs` | ZW006 | theme-pack-dialog/index.tsx, find-bar.tsx, theme-pack-card.tsx x2 | **dead today** (M: `grep -c` 0 in compiled.css) -> pre-existing bugs; tokenize or remove |
| `leading-none` | ZW006 | note-tray index-list/timeline | add `lineHeights.none: "1"` |
| `h-[calc(100vh-3.5rem)]`, `min-h-[calc(100vh-3.5rem)]`, `h-[calc(100%-3rem)]`, `w-/max-w-[calc(100vw-2rem)]`, `max-w-[calc(100vw-var(--spacing-hsp-xl))]`, `ml-/mr-[calc(var(--spacing-hsp-xl)+1px)]` | ZW005 | doc-layout, doc-history, theme-pack-dialog, theme-pack-switcher, language-switcher, card-list | spell calc operators with underscores (M: `h-[calc(100vh_-_3.5rem)]` and `ml-[calc(var(--spacing-hsp-xl)_+_1px)]` resolve) |
| `shadow-[0_1px_3px_color-mix(in_srgb,var(--color-fg)_8%,transparent)]` | ZW005 | html-preview-wrapper/preview-base.tsx | authored CSS or a `shadows` token (arbitrary box-shadow with var() rejected — upstream candidate) |

### 4c. Silently dropped under v3 (no error, no CSS) (M)
Low-confidence positions (ternaries/variables/interpolations) keep invalid candidates as audit info only:
- `py-[calc(var(--spacing-vsp-xs)+0.15rem)]` (sidebar-tree-island, site-tree-nav-island) — calc spelling.
- `[&_a]:underline`, `[&_a:hover]:text-accent`, `[&_a:focus-visible]:text-accent` (footer/footer.tsx:84-85, in a ternary variable).
- `ring-2 ring-accent` (theme-pack-dialog/theme-pack-card.tsx:53, ternary inside className template) — **live today** (`.ring-2` count 1 in compiled.css).
- extra `h-[calc(100vh-3.5rem)]` (sidebar-toggle-island, toc/toc.tsx), extra `leading-none`.
Unknown roots become ordinary classes (no CSS, no error) though Tailwind generates them today (intersection of wind-"ordinary" with compiled/showcase built selectors, false positives removed by hand):
- `wrap-anywhere` (home-page/index.tsx:333, h1) — overflow-wrap:anywhere; not in v1 catalog.
- `decoration-muted` (search-widget-script/generated-script.ts — frozen literal with CSP hash).
Also not in v1 catalog (ordinary if ever used; M via explain): `invisible visible contents flow-root table isolate origin-* will-change-* backdrop-blur-* delay-* line-clamp-* order-* basis-* content-* not-sr-only appearance-none fill-*`; recognized-invalid: `transform`, `underline-offset-4`, `text-balance`, `cursor-col-resize`, `font-display` (until token), `peer-checked:`, `motion-reduce:`, `print:`, `hover:not-disabled:`, `lg:max-xl:` (range = ZW003).

### 4d. Classification summary (distinct tokens that are real utilities, hand-deduped)
| Class | Count | Notes |
| --- | --- | --- |
| supported-as-is (resolves with draft config) | 482 distinct / 3,930 occ | after the token categories in section 5 are configured |
| supported-but-needs-a-token | `leading-none` (lineHeights.none), `ease-in-out` (easings.in-out), `shadow-md` / `rounded-md` / `max-w-sm` / `py-hsp-3xs` (only if kept) | 6 |
| rename (different v1 spelling) | 11 calc tokens (underscores around `+`/`-`), `rounded-l-DEFAULT`/`rounded-r-DEFAULT` -> `rounded-l`/`rounded-r` | 13 |
| unsupported-in-v1 -> authored CSS | 7 arbitrary-selector variants, `animate-spin`, `animate-pulse`, `ring-2`, `ring-accent`, `wrap-anywhere`, `decoration-muted`, arbitrary shadow w/ var | 14 |
| dead today, error tomorrow | `2xl:w-[24px]`, `ease-in-out`, `max-w-sm`, `shadow-md`, `rounded-md`, `py-hsp-3xs` | 6 (overlaps above) |

Authored-class collisions: of 529 authored class selectors, 10 are also utilities (`block hidden rounded underline text-accent text-body text-heading text-title font-bold font-semibold`) used in compound authored selectors (e.g. `a.text-accent.underline`) — fine; `group` marker; 2 zdtp BEM names ZW001 (not scanned by consumers). `authoredClasses` needed: none measured for zudo-doc sources (I).

---

## 5. Wind config zudo-doc needs (draft in `$S/draft-wind-config.json`, validated by zfb 3.0.0)

```jsonc
{ "wind": {
  "spec": 1,
  "reset": "owned-v1",            // see 5b
  "tokens": {
    // NO spacingUnit: keeps numeric spacing a ZW006 build error (replaces the inert-spacing test)
    "colors": { "<23 bare>": "var(--color-<name>)", "zd-<23>": "var(--color-zd-<name>)" },   // 46
    "spacing": { "hsp-2xs..2xl"(7), "vsp-3xs..2xl"(8), "icon-xs..lg"(4), "image-overlay-inset" }, // 20; drop --spacing-0/px (language constants; "0" key rejected)
    "fontSizes": { "micro|caption|small|body|title|heading|display": { "size": "var(--text-<n>)" } }, // 7
    "fontFamilies": { "sans": "var(--font-sans)", "mono": "var(--font-mono)" },
    "fontWeights": { "normal|medium|semibold|bold": "var(--font-weight-<n>)" },
    "lineHeights": { "tight|snug|normal|relaxed": "var(--leading-<n>)", "none": "1" },
    "letterSpacings": { "tight|normal|wide|wider": "var(--tracking-<n>)" },
    "radii": { "default": "var(--radius-DEFAULT)", "lg": "var(--radius-lg)" },   // full = language constant
    "shadows": { "lg": "var(--shadow-lg)" },
    "zIndices": { "<13 tiers>": "var(--z-index-<tier>)" },
    "easings": { "in-out": "cubic-bezier(0.4, 0, 0.2, 1)" }   // only if ease-in-out kept
  },
  "breakpoints": { "sm": {"minWidthPx": 640}, "lg": {"minWidthPx": 1024}, "xl": {"minWidthPx": 1280} },
  // dark: omitted (false). zudo-doc uses no dark: variant; data-theme="light|dark" is set on <html>.
  "manifests": { "zudo-doc": { "path": "@takazudo/zudo-doc/wind-manifest.json" } }
}}
```
M: explain results for representative tokens — `p-hsp-sm` -> `padding-*: var(--zw-spacing-hsp-sm)`; `text-body` -> `font-size: var(--zw-font-size-body)`; `rounded` -> `var(--zw-radius-default)`; `z-toolbar`; `w-icon-sm` (spacing lookup on sizing root); `bg-overlay/50` -> `color-mix(in oklab, var(--zw-color-overlay) 50%, transparent)`; `lg:hidden`; `group-hover:text-accent` all resolve. Colors/fontSizes and fontFamilies/fontWeights sets are disjoint (required).
Token variables resolve at `:root` (`@layer zw-tokens{:root{--zw-color-bg: var(--color-bg)}}`). Everything that overrides the source vars (ColorSchemeProvider, theme packs on `html[...]`, zdtp inline styles on documentElement) sits on the same element, so the spec's "nested theme scope" caveat does not bite today (I; U for any future nested scopes).
Where it lives: `zudoDoc()` currently returns `tailwind: { enabled: true }` (`packages/zudo-doc/src/config.ts:913`, also `preset.ts:375` doc comment, 3 test fixtures `__tests__/fixtures/{doc-history-dates-only,route-injection,route-injection-i18n}/zfb.config.ts`) — a leftover `tailwind` key is a hard config error in v3 (upstream docs `zudo-wind/configuration.mdx`). Replace with a package-owned `wind` fragment; user overrides merge user-wins.

### 5b. Reset choice (read `cascade-and-reset.mdx`, spec lines 208-345)
Today: full Tailwind v4 preflight in `@layer zd-preflight` (lowest). Closest v3 option: **`owned-v1`** (border-box + margin/padding/border reset, heading size/weight inherit, `a` inherit, list-style none, img/svg block, controls inherit font/color, table collapse, summary list-item, hr). Gaps vs Tailwind preflight (I, by diffing `packages/zudo-doc/src/html-preview-wrapper/preflight.ts` copy of TW preflight against owned-v1):
- **`[hidden]:where(:not([hidden=until-found])){display:none!important}` missing** — spec: "No generated reset forces [hidden]". 5 package files toggle `hidden` programmatically (M: `git grep -lE '\.hidden\s*=|toggleAttribute\("hidden"|setAttribute\("hidden"|removeAttribute\("hidden"|\bhidden=\{' ... | wc -l` -> 5). Must be authored.
- input/select/textarea `background-color: transparent`, `border-radius: 0`, `opacity: 1` missing (owned-v1 only clears button bg) -> search input / selects / preset-generator form likely regress.
- `::placeholder` opacity/color, `::backdrop`/`::file-selector-button` box reset, hr `color: inherit`, abbr[title], small, sub/sup, html emoji font fallbacks, `-webkit-tap-highlight-color`, `font-feature-settings`, webkit date/search fixes, `:-moz-focusring`.
Recommendation: `reset: "owned-v1"` + a small authored "preflight delta" block in `@layer base` (lowest authored-reachable layer after zw-reset) — keep it package-owned in theme.css. Do NOT keep a vendored preflight in an authored `zd-preflight` layer: authored layers are appended after `zw-reset, zw-tokens, zfb-hi, base, components`, so it would outrank `@layer base` (e.g. preflight `:-moz-focusring{outline:auto}` would beat theme.css `:focus-visible` outline in Firefox) (I). `minimal-v1`/`none` diverge far more (no margin/list/heading resets that content.css rhythm assumes).

### 5c. Cascade changes to manage
- Layer order becomes `zw-reset < zw-tokens < zfb-hi < base < components < zd-preflight? < zd-flow < (unlayered authored) < (unlayered utilities)`. zd-flow still loses to utilities (good); now also beats `base` (no property overlap measured by reading theme.css base rules: text-underline-offset, cursor, outline) (I).
- **Tie-break flip:** wind emits utilities AFTER authored unlayered CSS; Tailwind currently emits them BEFORE (M, section 2). Any authored unlayered selector of specificity exactly (0,1,0) that sets the same property as a utility on the same element flips winner. Crude count (M: `node spec010.mjs theme.css content.css features.css page-loading.css src/styles/global.css`): theme 4, content 56, features 71 (includes ~20 view-transition false positives), page-loading 2, showcase global 5 -> ~138 candidates to review.
- group/peer specificity drops: wind `:where(.group:hover) .x` = (0,1,0) vs Tailwind v4 `.x:is(:where(.group):hover *)` = (0,2,0) (spec lines 117-125; I for TW side). 80+ group-* occurrences.
- Hover is `@media (hover:hover)`-guarded in both (I). `transition*` gets fixed `150ms ease` (TW used `--default-transition-duration`, defined as 150ms in theme.css; timing var undefined -> `ease`) => equivalent today, but `--default-transition-duration` overrides no longer affect utilities.

---

## 6. Upstream (zfb v3) candidates found while dogfooding

1. **BEM class names are build errors.** `<div class="card__title flex">` -> `ZW001: invalid named utility characters (card__title)`, exit 1 (probe3/src2/bem.tsx). Spec says unknown roots are ordinary; `_` fails lexing first. Also flags zdtp's `tokenpanel-color-picker__convert` (explain-authored.tsv).
2. **Explicit `--source` into the project's `dist/` silently yields nothing** (glob matches, no ZW010, no candidates). probe3 o1.css. Breaks `gen-compiled-css.mjs`'s dist source without any signal.
3. **No source exclusion after `@source not` removal**: `!` globs rejected; `__tests__` scanned by default; audit output 1,392 lines referencing `__tests__`.
4. **`zfb css` failure lists candidates without file/line** (single semicolon-joined line; spec requires origins).
5. **`zfb wind audit` prints byte offsets that look like line numbers** (`pages:[locale]/docs/[[...slug]].tsx:2084` for an 84-line file); diagnostics section omits the candidate text; 135 `dynamicConstruction` notes all from non-class template literals (route signatures, KV keys, error strings).
6. **ZW005 message names the wrong property**: `h-[foo]`, `min-h-[foo]`, `h-[calc(...)]` -> "value is not valid for width".
7. **Arbitrary `box-shadow` containing `var()` rejected** (`shadow-[0_1px_3px_var(--x)]`, `...color-mix(...var(--color-fg)...)` ZW005) while `ml-[calc(var(--x)_+_1px)]` is accepted — inconsistent var handling vs spec's category-unverified rule.
8. **Tailwind-compat calc spelling**: `calc(100vh-3.5rem)` (Tailwind auto-spaces operators) is ZW005 with no suggestion; 12 zudo-doc tokens. A suggestion (`_-_`) or normalization would ease migration.
9. **No way to produce a strict manifest** from package sources: package authors must re-implement extraction + validation (zudo-doc: 2,693 -> 471 valid). Wanted: `zfb wind manifest --source ... --producer ...` or a batch `explain`/validate mode (explain is 1 process per candidate, ~75 ms).
10. **Nested literals inside className interpolation are low-confidence**, so unsupported utilities there (`ring-2` inside `` className={`... ${cond ? "ring-2 ring-accent" : ...}`} ``) vanish without any build signal.
11. **Gap proposals (catalog):** `overflow-wrap:anywhere` (`wrap-anywhere`/`break-anywhere`), `text-decoration-color` (`decoration-*`), `visibility` (`invisible`/`visible`), `cursor-col-resize`/`ew-resize`, `leading-none` as a constant, a `[hidden]` rule option in resets, utilities placement control (before authored CSS) for Tailwind migrations.
12. **Docs:** `DEFAULT_CONTENT_ROOTS` includes `src/` but docs don't say `__tests__` under it is scanned; manifest path resolution for non-`definePreset` configs (package specifier vs relative) not documented in sources-and-candidates.mdx.

---

## 7. Proposed sub-tasks (<= ~20 agent tool calls each)

| ID | Title | Size | Depends | Files |
| --- | --- | --- | --- | --- |
| W1 | Package-owned `wind` fragment in `zudoDoc()`/`zudoDocPreset()`; drop `tailwind` key; test fixtures' zfb.config.ts | M | zfb 3 bump | packages/zudo-doc/src/config.ts, preset.ts, __tests__/fixtures/*/zfb.config.ts, config tests |
| W2 | theme.css: `@theme` blocks -> authored `:root` custom properties; drop `--color-*: initial`; decide theme-no-reset.css fate (identical file or removed export = major); update check-theme-css/theme-css-variants; gen-z-index output (`--no-theme-wrapper` default) | M | W1 | theme.css, scripts/theme-css-variants.mjs, check-theme-css.mjs, bin/gen-z-index.mjs + test |
| W3 | Reset: `owned-v1` + authored preflight-delta in `@layer base` ([hidden], controls bg/radius/opacity, placeholder, backdrop, hr/abbr/small/sub/sup, html font stack); remove zd-preflight layer | S | W2 | theme.css (or new base.css), CLAUDE.md layer docs |
| W4 | Safelist -> `dist/wind-manifest.json` generator + `exports` entry + prepack guard; replace root `check-package-safelist.mjs` with manifest parity; tsup onSuccess | L | W1 | scripts/gen-safelist.mjs(->gen-wind-manifest), check-safelist.mjs, tsup.config.ts, package.json exports, scripts/check-package-safelist.mjs, run-b4push step |
| W5 | compiled.entry.css + gen-compiled-css.mjs for v3 (no TW imports/@source; wind config for standalone css; dist source replaced by manifest; test-dir exclusion strategy); update assertions (no banner, `--zw-*`); regenerate committed dist/compiled.css | M | W2-W4 | src/compiled.entry.css, scripts/gen-compiled-css.mjs, check-compiled-css.mjs, __tests__/compiled-css.test.ts |
| W6 | Fix the 24 build-breaking candidates (calc underscores, rounded-*-DEFAULT, ease-in-out, leading-none, dead classes) | S | W1 | files in section 4b |
| W7 | Move unsupported constructs to authored CSS: 7 arbitrary-selector variants, animate-spin/pulse, ring-2/ring-accent, wrap-anywhere, decoration-muted (frozen search-widget literal + CSP hash regen), arbitrary shadow | M | W1 | footer.tsx, breadcrumb.tsx, nav-indexing/*, doc-history, theme-pack-*, home-page, search-widget-script (+gen), preview-base.tsx, features.css |
| W8 | Showcase/template/fixture stylesheets: src/styles/global.css, template global.css, target-manifest fixture, template-drift allowlist/guard, create-zudo-doc docs text ("Tailwind CSS v4") | M | W2-W4 | src/styles/global.css, packages/create-zudo-doc/templates/base/src/styles/global.css, fixtures, scripts/check-template-drift.sh, scaffold.ts, claude-md-gen.ts |
| W9 | Cascade audit: ~138 (0,1,0) authored selectors vs co-applied utilities; group-* specificity; visual regression (e2e + theme-a11y audit) | L | W2-W8 | content.css, features.css, page-loading.css, theme packs |
| W10 | CI/guards: css-shape-smoke-gate (MIN bytes, leaked TW color check), no-inert-spacing test, design-token-lint scope, b4push step names, e2e specs mentioning Tailwind (5) | M | W5, W8 | .github/actions/css-shape-smoke-gate/*, __tests__/no-inert-spacing-utilities.test.ts, .design-token-lint.json, scripts/run-b4push.sh, e2e/*.spec.ts |
| W11 | Docs + agent guidance: 38 MDX (19 EN/19 JA) mention Tailwind; CLAUDE.md (root, src/, packages/zudo-doc "Shipped CSS artifacts"), design-system skill, embedder namespace contract (`--color-zd-*`, `bg-zd-*` needs consumer wind tokens) | L | all | src/content/docs{,-ja}/reference/{design-system,color,component-first,component-tokens,theme-packs}.mdx, guides/browser-embedding.mdx, components/html-preview.mdx, ... |
| W12 | /dev-upstream-report for section 6 | S | - | zfb repo issues |

Full list of non-doc files mentioning Tailwind (63): `$S/tailwind-mentions-code.txt` (`git grep -l -i tailwind -- ':!**/*.mdx' ':!**/*.md' ':!**/CHANGELOG*' ':!packages/zudo-doc/dist/**'`).
