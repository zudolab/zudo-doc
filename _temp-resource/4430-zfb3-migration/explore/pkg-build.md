# pkg-build explorer map — zudo-doc 5.28.2 → zfb 3.0.0

Scope: package build, config emission, exports, publish contract, generator, fixtures, pins, release.
Repo: $HOME/repos/myoss/zudo-doc @ main 337b9f110 (clean). zfb ref: $HOME/repos/myoss/zfb tag v3.0.0.
All commands run read-only; cwd = repo root unless stated. M = measured, I = inferred, U = unverified.

## 0. Headline facts

| # | Fact | Kind | Command |
|---|---|---|---|
| 1 | `zudoDoc()` hard-codes `framework: "preact"` and `tailwind: { enabled: true }` — the ONLY place either key is emitted (host `zfb.config.ts` and generator emit neither). | M | `grep -n -E 'framework|tailwind' packages/zudo-doc/src/config.ts` → lines 911, 913; `grep -n -E 'framework|tailwind' zfb.config.ts packages/create-zudo-doc/src/zfb-config-gen.ts` → none in code |
| 2 | zfb 3 rejects both keys at config load, including inside `presets[]` (`REMOVED_TOP_LEVEL_KEYS`). | M | `git -C ../zfb show v3.0.0:crates/zfb/src/config.rs \| grep -n REMOVED_TOP_LEVEL_KEYS -A8` (lines 2486-2494) |
| 3 | `zudoDoc()` return is `satisfies ZfbConfig`; `zfb-config-shim.d.ts` re-exports the INSTALLED `@takazudo/zfb/config`, so after the pin bump `tsc` flags `framework`/`tailwind` as excess properties automatically (no hand-sync). | M (code) / I (TS error text) | `sed -n 905,929p packages/zudo-doc/src/config.ts`; `cat packages/zudo-doc/zfb-config-shim.d.ts` |
| 4 | `@jsxImportSource preact` pragma in 274 tracked files (254 in packages/zudo-doc). Per-file pragmas override tsconfig AND zfb's synthetic tsconfig (`write_synthetic_tsconfig` forces owned jsxImportSource only via tsconfig). | M | `git grep -l '@jsxImportSource preact' \| wc -l` → 274; `... \| awk -F/ '{print $1"/"$2}' \| sort \| uniq -c` |
| 5 | 275 tracked files import preact/react specifiers (246 in packages/zudo-doc). | M | `git grep -l -E "from ['\"](preact\|preact/[a-z-]+\|preact-render-to-string\|react\|react-dom\|react/jsx-runtime)['\"]" \| wc -l` |
| 6 | 82 test files import `preact-render-to-string`; 38 import preact; 102 distinct test files touch either (100 in packages/zudo-doc) of 379 total. | M | `git grep -l preact-render-to-string -- '*.test.ts' '*.test.tsx' \| wc -l`; `git ls-files '*.test.ts' '*.test.tsx' \| wc -l` |
| 7 | `packages/zudo-doc` exports map has 176 subpaths incl. `./safelist.css`, `./compiled.css`, `./theme.css`, `./theme-no-reset.css`, `./tsconfig.base.json`. No wind manifest export exists. | M | `node -e 'console.log(Object.keys(require("./packages/zudo-doc/package.json").exports).length)'` |
| 8 | `scripts/check-scaffold-pin-freshness.mjs` is RED on main right now: 3 STALE scaffold pins (zfb/runtime/md-wasm 2.22.1 vs latest 3.0.0) + 3 PEER ranges `^2.22.1` excluding 3.0.0. It has no override env var; it gates `publish-create-zudo-doc.yml:190` and `release-create-zudo-doc.sh:210`. ⇒ any further 5.x release of create-zudo-doc is blocked today. | M | `node scripts/check-scaffold-pin-freshness.mjs` → "Scaffold pin freshness check FAILED."; `grep -n 'process.env' scripts/check-scaffold-pin-freshness.mjs` → none |
| 9 | npm: zfb, zfb-runtime, zfb-md-wasm, zfb-adapter-cloudflare, create-zfb latest=3.0.0; zudo-doc / create-zudo-doc / history-server latest=5.28.2; zdtp latest=0.8.5. zfb-runtime@3.0.0 peers `@takazudo/zfb: 3.0.0` (exact). | M | `npm view <pkg> dist-tags --json`; `npm view @takazudo/zfb-runtime@3.0.0 peerDependencies` |
| 10 | `@takazudo/zdtp@0.8.5` peers `preact ^10.29.1` and depends on `@tailwindcss/browser 4.3.2`, `tailwind-merge`. Its shipped `dist/zdtp.css` (122,564 B) has zero Tailwind directives. | M | `node -e 'require("./node_modules/@takazudo/zdtp/package.json")'`; `grep -o -E '@(theme\|source\|apply\|...)' node_modules/@takazudo/zdtp/dist/zdtp.css` → none |
| 11 | zfb's own v3.0.0 docs host still pins zfb 2.20.2 + zudo-doc 5.27.0 + preact. | M | `git -C ../zfb show v3.0.0:docs/package.json \| grep -n -E 'zudo-doc\|zfb\|preact'` |
| 12 | 70 package.json files under $HOME/repos depend on @takazudo/zudo-doc (63 excluding `__inbox`/fixture/`workspace:*`). | M | find+grep in §6; list kept out of the repo (private repo names) |

## 1. packages/zudo-doc build surface

### 1.1 package.json (M: `node -e` dump)
- version 5.28.2, ESM, 176 exports, `files`: dist, bin, eject, routes-src, tsconfig.base.json, zfb-config-shim.d.ts, virtual-modules.d.ts, README.md, CHANGELOG.md.
- bin: gen-component-tokens, gen-z-index, run-parallel, tags-audit, tags-suggest, zudo-doc.
- peers: `@takazudo/zfb ^2.22.1`, `@takazudo/zfb-md-wasm ^2.22.1` (optional), `@takazudo/zfb-runtime ^2.22.1`, `@takazudo/zdtp ^0.5.2||^0.6.0||^0.7.0||^0.8.0` (optional), `@takazudo/zudo-doc-history-server ^5.17.2` (optional), `preact ^10.29.1` (REQUIRED), diff/katex (optional), zod ^4.3.6.
- devDeps: zfb family 2.22.1 exact, preact ^10.29.1, preact-render-to-string ^6.6.6, happy-dom, tsup ^8, typescript ^5, vitest ^4.
- scripts: `build` = gen-search-widget-script → gen-nav-overflow-script → tsup → `tsc -p tsconfig.build.json`; `prepare` same; `prepack` = `check:prepack-contract` (20 sub-checks: search-widget/nav-overflow drift, gen:changelog, check-theme-css, check-safelist, check-content-css, check-page-loading-css, check-features-css, check-compiled-css, check-theme-packs, check-catalog, check-site-schema, check-theme-packs-registry, check-plugins, check-plugin-resolution, check-eject-sources, check-routes-src, check-shim-artifacts, check-virtual-modules, gen-component-tokens --check, check-route-context-payload, check-asset-viewer-exports).

v3 changes needed:
- peers: drop `preact` (or keep only as zdtp-driven optional peer, see §7 Q1); raise zfb family peers to `^3.0.0` (pin-parity requires `^<root pin>` exactly — `workspaceZfbPeerFloorMatches`).
- devDeps: zfb family 3.0.0; drop preact/preact-render-to-string once tests use `@takazudo/zfb/zudo-react/server`.
- exports: ADD `./wind.json` (or similar) pointing at the generated candidate manifest; DECIDE fate of `./safelist.css` (becomes a Tailwind `@source inline(...)` file that zudo-wind would reject with ZW009 if imported) → removal is a breaking export removal, add a `package-exports-absent` row to the compatibility matrix.
- `keywords` include "preact" (cosmetic).

### 1.2 tsup / tsc (M: `cat packages/zudo-doc/tsup.config.ts`)
- per-file `bundle:false` ESM build of `src/**/*.{ts,tsx}` (keeps `"use client"` directives for zfb's island scanner — still the v3 island marker per `concepts/islands.mdx:14`).
- JSX transform comes from tsconfig (`jsx: react-jsx`, `jsxImportSource: preact` in tsconfig.base.json) and per-file pragmas → dist JS today imports `preact/jsx-runtime`. After the flip it will import `@takazudo/zfb/zudo-react/jsx-runtime` (exports `jsx`, `jsxs`, `Fragment` — M: `git -C ../zfb show v3.0.0:packages/zfb/src/zudo-react/jsx-runtime.ts`). `@takazudo/zfb` must therefore stay a REQUIRED peer (it is).
- `onSuccess` chain: copy theme/content/page-loading/features CSS → `gen-safelist.mjs` → (one-shot only) `gen-compiled-css.mjs` → gen-nav-overflow → copy-eject-sources → copy-routes-src → copy-virtual-modules → copy-theme-packs → gen-catalog → gen-search-widget-script.
- dts via separate `tsc -p tsconfig.build.json --emitDeclarationOnly` (extends package tsconfig.json → root tsconfig.json → package tsconfig.base.json).

### 1.3 tsconfig chain
- `packages/zudo-doc/tsconfig.base.json` (SHIPPED to consumers): `jsx: react-jsx`, `jsxImportSource: preact`, `files: [zfb-config-shim.d.ts, virtual-modules.d.ts]`. → must become `@takazudo/zfb/zudo-react` (consumer-facing breaking change: every consumer's pages switch runtime).
- `packages/zudo-doc/tsconfig.json` extends `../../tsconfig.json` (root) — so package typecheck inherits the root's `react → preact/compat` paths.
- `zfb-config-shim.d.ts`: `declare module "zfb/config" { export * from "@takazudo/zfb/config"; }` — auto-tracks v3 `WindConfig` (M: v3 config.ts lines 67-99 declare `WindConfig`; `wind?: WindConfig | false` line 259). No edit needed.
- `virtual-modules.d.ts`: no preact/JSX refs (M: `grep -n -E 'preact|JSX|VNode' virtual-modules.d.ts` → none).

### 1.4 What zudoDoc()/zudoDocPreset() emit (M: `sed -n 820,929p src/config.ts`, `sed -n 340,460p src/preset.ts`)
Shell fields from zudoDoc(): `framework: "preact"`, `port`, `tailwind: { enabled: true }`, `base`, `adapter?`, `bundle?`, `strictContentBridge?`. Preset fragment: `collections`, `plugins`, `markdown{features,cjkFriendly,gfm}`, `codeHighlight{mode:"class",defaultStylesheet:true}`, `resolveMarkdownLinks`, `stripMdExt`, `trailingSlash`, `minifyHtml`.
Docs/JSDoc examples that still show `framework`/`tailwind`: `src/preset.ts:5-10` header, `:373-375` usage example.

Required v3 emission (I, from v3 migrating-to-v3.mdx + configuration.mdx):
```ts
wind: {
  spec: 1,
  reset: <"owned-v1" | "minimal-v1" | "none">,   // today: tailwindcss/preflight in @layer zd-preflight
  tokens: { spacingUnit?, colors, spacing, sizes?, fontSizes, fontFamilies, fontWeights?, lineHeights, letterSpacings, radii, shadows, zIndices },
  breakpoints: { sm|md|lg...: { minWidthPx } },  // theme.css declares 3 --breakpoint-* tokens
  dark: false,   // M: 0 `dark:<utility>` variant uses in package src (`git grep -n -E '\bdark:[a-z]' -- packages/zudo-doc/src ':!**/__tests__/**' | wc -l` → 0); color schemes are CSS-var driven
  manifests: { "zudo-doc": { path: "@takazudo/zudo-doc/wind.json" } },  // bare specifier resolves via package exports (css_source_plan.rs exported_manifest_subpath)
  authoredClasses?: {...},   // class tokens owned by authored CSS (e.g. .admonition-*, header[data-header] helpers)
}
```
- Token source today: `packages/zudo-doc/src/theme.css` — 3 `@theme` blocks (lines 60 `@theme`, 234 `@theme static`, 274 `@theme inline`), 120 custom-property lines; first block namespaces: color 24, spacing 22, text 7, font 6, tracking 4, leading 4, radius 3, breakpoint 3, shadow 1 (M: awk/grep in §8). Host `src/styles/global.css` adds 1 `@theme` (line 73) + 6 `@source` + 2 tailwind imports.
- Merge semantics for user overrides: zfb merges `presets[]` into user config recursively (objects deep-merge, user wins; distinct manifest producers survive; same safelist owner arrays replace). Option A: zudoDoc() returns `{ presets: [{ wind: pkgWind }], wind: user.wind, ... }` and lets zfb merge. Option B: zudoDoc() merges itself. Option A dogfoods zfb's merge; I.
- New `ZudoDocConfig` passthrough shell field `wind?` (like `adapter`/`bundle`) — NOT a Settings field, so no `settings.ts`/fixture drift, no `DEFAULT_MIRROR` change in the generator.

### 1.5 Plugins (M: `ls src/plugins`; `grep -rn -E 'tailwind|preact|renderToString|@source|safelist|\.css|island'`)
13 top-level plugin modules: changelog, claude-resources, codex-resources, connect-adapter, doc-history, img-src-check, llms-txt, plugin-utils, route-pages-candidates, routes, search-index, theme-packs, zdtp-loader; internal/: asset-viewer, claude-resources, codex-resources, doc-history, img-src-check, llms-txt, resource-docs-shared, search-index, theme-packs.
- None reference Tailwind or Preact directly.
- CSS-adjacent: `theme-packs` (+internal/theme-packs/copy.ts, dev-middleware) copy `pack.css` files into output — pack.css content must be wind-clean (U: check `src/theme-packs/*/pack.css` for directives — CSS explorer).
- Island-adjacent: `routes` (injects routes-src/*.tsx — compiled by the CONSUMER with its tsconfig → consumer must be on zudo-react; `_design-token-panel-bootstrap.tsx` island wrapper); `zdtp-loader` (virtual module loading `@takazudo/zdtp`, stubbed when `bundleZdtp:false`); `route-pages-candidates` is a route-pattern→pages/ file mapper (M: header comment), NOT Tailwind-related; its `ROUTABLE_PAGE_EXTENSIONS` mirror of zfb should be re-checked against v3 `zfb_types`.
- No plugin passes `jsxRuntime` to md-wasm (M: `git grep -n jsxRuntime` → only `/** @jsxRuntime automatic */` pragmas in 7 files).

### 1.6 Package scripts encoding Tailwind/Preact (M: per-file `grep -c`)
| script | refs | v3 action |
|---|---|---|
| scripts/gen-safelist.mjs | 26 | Rewrite as gen-wind-manifest: same dist/**/*.js literal scanner, emit `{schemaVersion:1,specVersion:1,producer:"zudo-doc",candidates:[...]}`; validate with `zfb wind audit`/`explain`. The "abort on malformed token" filter logic may simplify: manifest entries are validated strictly (invalid → diagnostic). |
| scripts/check-safelist.mjs | 11 | Replace with manifest-shape check. |
| scripts/gen-compiled-css.mjs | 3 | Asserts `tailwindcss v4.2.0` banner and absence of `@tailwind/@apply/@source/@import` → rewrite assertions; ALSO `zfb css --project-root packages/zudo-doc` loads config from project-root and the package has NO zfb config ⇒ empty wind tokens ⇒ `.bg-surface` etc. will not resolve (assertRule checks). Needs a package-local `zfb.config.json` (or generated temp project root) carrying the same wind block zudoDoc() emits. |
| src/compiled.entry.css | — | Drop `@import "tailwindcss/*"` + `@source not ...`; keep `@layer` order + package CSS imports. |
| scripts/site-schema-graph.mjs / check-site-schema.mjs | 3/1 | `preact` allowed as a specifier in site-schema graph (`/^preact(\/|$)/`) → swap to `@takazudo/zfb/zudo-react`. |
| check-theme-css / check-content-css / check-features-css / check-page-loading-css / check-theme-packs | 0 direct | but content.css/features.css/theme.css headers document @theme/@import contract — CSS explorer. |

### 1.7 Vitest / test infra (M: grep)
- `packages/zudo-doc/vitest.config.ts`: `esbuild.jsxImportSource: "preact"`, `findPreactRenderToString()` pnpm-store scan, react→preact aliases, `server.deps.inline` for zfb `dist/island.js`.
- root `vitest.config.ts`, `vitest.slow.config.ts`: react→preact aliases (5 keys each). `vitest.worker.config.ts`: none.
- `packages/zudo-doc/vitest.slow.config.ts` comment: "Rust content pipeline + Tailwind + esbuild".
- 82+38 test files (102 distinct) to port to `@takazudo/zfb/zudo-react/server` `renderToString` / `client` `mount`/`hydrate`.

## 2. Root repo wiring

| File | Today | v3 |
|---|---|---|
| zfb.config.ts | `defineConfig(zudoDoc({...settings, tagVocabularyEntries, translations, chromeBindingsModule, port, adapter, bundle.exclude, strictContentBridge}))` | no direct change for framework/tailwind; optional `wind` override if showcase needs host tokens (e.g. `--color-page-loading-overlay`). |
| tsconfig.json | extends package base; paths `react`, `react/jsx-runtime`, `react-dom` → preact | delete 3 react paths. Copied verbatim into every e2e fixture by `e2e/setup-fixtures.sh` (`ROOT_COPIED_FILES`). |
| tsconfig.pages.json | same 3 react paths + zfb/* → `node_modules/@takazudo/zfb/dist/*.d.ts` | delete react paths; zfb/* dist d.ts paths still exist in v3 publishConfig (M: v3 publishConfig.exports lists dist/index.d.ts, content, config, plugins, frontmatter, paginate); `zfb/runtime` → zfb-runtime dist/index.d.ts still exported. |
| tsconfig.worker.json | no JSX settings | none. |
| e2e/tsconfig.json, e2e/tsconfig.fixtures.json | extend root | inherit fix. |
| vitest*.ts | see §1.7 | |
| package.json root | deps zfb family 2.22.1, zdtp 0.8.5, preact ^10.29.1, preact-render-to-string ^6.6.6; `pnpm.overrides.preact: 10.29.2` | zfb family 3.0.0; drop preact + p-r-t-s + override unless zdtp keeps them (Q1). |

## 3. Pins inventory (M: loop over `git ls-files '*package.json'`; saved `.../explore/pkg-build/pins.txt`)

| Location | Package | Value | Guard |
|---|---|---|---|
| package.json deps | @takazudo/zfb, -adapter-cloudflare, -md-wasm, -runtime | 2.22.1 | check-pin-parity (source of truth) |
| package.json deps | @takazudo/zdtp | 0.8.5 | pin-parity PINNED_PACKAGES |
| package.json deps / overrides | preact ^10.29.1 / 10.29.2; preact-render-to-string ^6.6.6 | — | unguarded |
| packages/zudo-doc devDeps | zfb, md-wasm, runtime | 2.22.1 | pin-parity `workspaceZfbDevPinMatches` (exact) |
| packages/zudo-doc peers | zfb, md-wasm, runtime | ^2.22.1 | pin-parity `workspaceZfbPeerFloorMatches` (`^<root>`), freshness PEER rule |
| packages/zudo-doc peers | history-server | ^5.17.2 | pin-parity approvedBaseline (RELEASE.md rule 4/5) |
| packages/zudo-doc peers/dev | preact ^10.29.1, p-r-t-s ^6.6.6 | — | unguarded |
| packages/create-zudo-doc/src/scaffold.ts:985-987 | zfb, runtime, md-wasm | "2.22.1" | pin-parity + freshness |
| scaffold.ts:63 `ZUDO_DOC_PIN` | @takazudo/zudo-doc | ^5.28.2 | INTERNAL_PINNED_PACKAGES, release script rewrites |
| scaffold.ts:1127 | history-server | ^5.28.2 | same |
| scaffold.ts:~1101 | zdtp (designTokenPanel only) | 0.8.5 | pin-parity |
| scaffold.ts:1020,1027 | preact ^10.29.1, preact-render-to-string ^6.6.6 | — | unguarded; comments tie preact floor to zdtp peer |
| packages/zudo-doc/src/__tests__/fixtures/target-manifest/package.json | @takazudo/zudo-doc | ^5.28.2 | pin-parity surface #6, release script |
| pnpm-lock.yaml importers | `.`, packages/create-zudo-doc, packages/doc-history-server, packages/search-worker, packages/zudo-doc | — | frozen-lockfile CI |
| e2e/fixtures/*/package.json | generated at setup (name/private/version only) | — | none |

Not present: ZUDO_DEPS_PINS.md (M: `git ls-files | grep -i ZUDO_DEPS_PINS` → none). DEPENDENCIES.md lines 38-40 justify preact/p-r-t-s/vite deps (browser-embed).

Generator (M: grep `packages/create-zudo-doc`):
- `zfb-config-gen.ts` emits only `defineConfig(zudoDoc({...}))` — no framework/tailwind; `DEFAULT_MIRROR` needs no change unless a Settings field is added.
- `templates/base/tsconfig.json`: react→preact paths (3) — remove.
- `templates/base/src/styles/global.css` (28 lines): `@import "tailwindcss/preflight" layer(zd-preflight)`, `@import "tailwindcss/utilities"`, `@import .../safelist.css`, 3 `@source`, empty `@theme {}` override slot → all ZW009 in v3. Override slot must become a CSS custom-property block (`:root{}`) or config `wind.tokens`.
- `templates/base/pages/docs/[[...slug]].tsx`, `templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx`: `@jsxImportSource preact` pragma.
- `src/features/design-token-panel.ts`: injects `@import "@takazudo/zdtp/styles.css";` (plain compiled CSS — U whether zudo-wind accepts it as authored CSS).
- `src/claude-md-gen.ts:45,55,58` + `scaffold.ts:123-146` README/CLAUDE text say "Tailwind CSS v4", "Preact islands".
- tests: scaffold.test.ts (4 preact/tailwind refs + ROOT_ZFB_PINS assertions), zfb-config-gen.test.ts, claude-skills-scaffold-refs.test.ts, chrome-bindings-build.slow.test.ts (emits `@jsxRuntime` + pragma), slow-build-helpers.ts.
- `templates/features/claudeSkills/files/.claude/skills/zudo-doc-design-system/SKILL.md` mentions Tailwind.
- Template-drift: `.template-drift-allowlist` allowlists global.css, tsconfig.json, pages/index.tsx, two doc-route stubs, check-links.js; `check-template-drift.sh` `check_global_css_legacy_tokens` requires `@takazudo/zudo-doc/theme.css` import marker (line 174) — survives if theme.css stays; "use client" directive parity check survives.

E2E fixtures (M: `git ls-files e2e/fixtures`, 106 tracked files; 6 fixtures hostpanel/i18n/sidebar/smoke/theme/versioning):
- tracked per-fixture sources: `src/config/settings.ts` ×6 (no engine fields), hostpanel `chrome-bindings.fixture.tsx`, `host-panel/bootstrap-island.tsx` (uses `preact/hooks useEffect`), `host-panel/trigger.tsx` — 3 files with preact pragma/imports.
- `e2e/setup-fixtures.sh` copies root `zfb.config.ts` + `tsconfig.json` into each fixture and writes a stub package.json → fixtures inherit root fixes automatically.
- `e2e/browser-embed/main.tsx`: preact `h`/`Fragment` + `preact-render-to-string` + md-wasm `renderHtml` + zudo-doc `createChrome` — a non-zfb (Vite) embedding consumer scenario; must port to zudo-react `h`/`renderToString`.

## 4. Publish / dist contracts

| Gate | Where | Engine assumption | v3 edit |
|---|---|---|---|
| `check:prepack-contract` (20 checks) | prepack, b4push step "publish contract" | check-safelist, check-compiled-css (banner), check-theme-css/content/features/page-loading (CSS shape) | yes (safelist→manifest, compiled css) |
| `scripts/check-package-safelist.mjs` | b4push step 27, CI job "Package Safelist Check" (`.required-checks-manifest`), b4push-ci parity entry (`check-b4push-ci-parity.mjs:105-108`) | reads `dist/safelist.css` `@source inline` | rename/replace all 4 places together (manifest + workflow job name + parity needle + b4push step) |
| `scripts/check-compatibility-contract.ts` + `compatibility-deletion-matrix.ts` (639 lines) | b4push "Current-only compatibility contract" | imports zudoDoc() (throws-on-removed-field test at line 142) | ADD rows: text-absent `@jsxImportSource preact`, `preact/hooks`, `tailwindcss/preflight`, `@theme` in shipped CSS; package-exports-absent `./safelist.css` (if removed) |
| `.github/actions/css-shape-smoke-gate/run.sh` | main-deploy:359, pr-checks:1403, preview-deploy:387 | `MIN_CSS_BYTES=50000` (Tailwind baseline 64-66 KB), `MIN_MEDIA=3`, leaked Tailwind default-palette regex | re-baseline thresholds after first v3 build; the leaked-palette check becomes vacuous (no implicit palette in v3) |
| `.design-token-lint.json` / @takazudo/zudo-design-token-lint 2.1.0 | b4push "Design token lint" | lints Tailwind class names in `className` | U: verify it scans `class=` (zudo-react spelling); `zfb wind audit` may supersede |
| check-pin-parity.mjs (825 lines) | b4push step 4, CI | mechanical; passes once root/dev/peer/scaffold all say 3.0.0 / ^3.0.0 | none beyond pin edits |
| check-scaffold-pin-freshness.mjs | release preflight, publish-create-zudo-doc Safeguard 4/5 | RED now (§0 #8) | clears once pins are 3.0.0; history-server peer raise to ^6.0.0 is red until 6a publishes (documented, RELEASE.md rule 4) |
| check-scaffold-pin-published.mjs | b4push step 20 (skippable `B4PUSH_SKIP_PIN_PUBLISHED=1`), exam.yml | release-window | standard |
| check-no-host-alias-in-package.mjs, check-dist-mutating-tests.mjs, check-required-checks.mjs | b4push | no engine refs (M grep) | only if job names change |
| `scripts/__tests__/zfb-md-wasm-release.test.ts` | unit | reads expected version from root pin; checks `dist/wasm/zfb_md_wasm_bg.wasm` + `wasm-highlight` paths | U: confirm v3 md-wasm keeps those dist paths (4 wasm digests changed; no digest pinned in repo — M: `git grep -i sha256` finds only a scaffold.ts comment) |

## 5. Release (M: RELEASE.md, l-make-release SKILL.md, scripts/release-create-zudo-doc.sh, docs/findings/4268-peer-floor-major-bump.md)
- Three lockstep packages: `@takazudo/zudo-doc-history-server`, `@takazudo/zudo-doc`, `create-zudo-doc` (RELEASE.md:110-126). Publish order: history-server → zudo-doc → create-zudo-doc (tags `zudo-doc-history-server-X.Y.Z`, `zudo-doc-vX.Y.Z`, `vX.Y.Z`).
- `release-create-zudo-doc.sh major` computes `(X+1).0.0` (lines 105-119). Six changelog source entries per release (EN+JA × 3 packages); unchanged package still gets an entry.
- Major-specific gates (RELEASE.md:190-270, SKILL.md:281-285): raise `packages/zudo-doc` peer `@takazudo/zudo-doc-history-server` from `^5.17.2` to `^6.0.0` AND `FIRST_PARTY_PEER_CHECKS[].approvedBaseline` in `scripts/check-pin-parity.mjs` in the release commit, before `pnpm b4push`; b4push with `B4PUSH_SKIP_PIN_PUBLISHED=1`; freshness PEER rule red until 6a publishes (by design). Findings doc proves install/lockfile unaffected (4 arms, exit 0).
- Precedent: majors v1.0.0..v5.0.0 tagged (M: `git tag | grep -E '^v[0-9]+\.0\.0$'`). No per-major migration guide page exists in docs (M: `git ls-files src/content/docs | grep -i migrat` → only blog/migrating-from-astro.mdx).
- So zudo-doc 6.0.0 ⇒ lockstep create-zudo-doc 6.0.0 + history-server 6.0.0 (history-server has no zfb/preact dependency — M: pins grep shows none — so it is a no-change lockstep major).

## 6. Consumers (M)
Command:
```
cd $HOME/repos; find . -name package.json -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/worktrees/*' -not -path '*/.zfb*' -not -path '*/dist/*' -maxdepth 6 | xargs grep -l -E '"@takazudo/zudo-doc"\s*:'
```
70 hits (63 excluding `__inbox`/fixture/`workspace:*`). Highlights (zudo-doc | zfb):
- myoss/zfb/docs: 5.27.0 | 2.20.2 (zfb's own docs; #3328 target to re-pin)
- legacy pins: zudo-doc 0.2.14 (haku ×2, zzmod3 ×2), 3.3.0 (zit), 4.x (zpd, zzmod2 ×2), 5.2–5.21 (several)
Full list kept out of the repo (it names private repositories).
Several consumers ship their own package-level presets on top (zudo-sg styleguide, zudo-doc-cloud builder, circuit-doc) — each is a downstream v3 migration after zudo-doc 6.

## 7. Cross-checks of #3328 claims in my area (component numbers are other explorers' job; here for citation)
Run in packages/zudo-doc/src, excluding `__tests__`:
- `"use client"` files: 21 (`grep -rl --include='*.tsx' --include='*.ts' -E "^['\"]use client['\"]" . | grep -v __tests__ | wc -l`) vs claim 19 islands.
- `className=` occurrences in .tsx: 279 (`grep -r --include='*.tsx' -o 'className=' . | grep -v __tests__ | wc -l`) vs claim ~272.
- `dangerouslySetInnerHTML` occurrences: 57 (.ts+.tsx) vs claim 38 sites (occurrence ≠ site; U).
- files importing `preact/hooks`: 16; `preact/compat|react|react-dom`: 9; type-only `import type … from "preact"` lines: 150.

## 8. Proposed sub-tasks (≤ ~20 agent tool calls each)

### Cutover spine (must land, in order, before ANY v3 build can succeed)
S1. **Pin bump + lockfile** (S): root deps zfb/runtime/md-wasm/adapter → 3.0.0; packages/zudo-doc devDeps 3.0.0, peers ^3.0.0; scaffold.ts:985-987 → "3.0.0"; `pnpm install`; `pnpm check:pin-parity`. Files: package.json, packages/zudo-doc/package.json, packages/create-zudo-doc/src/scaffold.ts, pnpm-lock.yaml.
S2. **Config emission** (M, dep S1 + token table from CSS explorer): delete `framework`; replace `tailwind` with `wind` (spec/reset/tokens/breakpoints/dark/manifests); add `wind` passthrough to ZudoDocConfig (decide presets-merge vs self-merge); fix preset.ts JSDoc; update `config-jsdoc.test.ts`, config tests, check-compatibility-contract. Files: packages/zudo-doc/src/config.ts, src/preset.ts, src/__tests__/config*.test.ts.
S3. **JSX runtime flip** (M, dep S1): tsconfig.base.json jsxImportSource → `@takazudo/zfb/zudo-react`; remove react→preact paths from root tsconfig.json, tsconfig.pages.json, templates/base/tsconfig.json; codemod-delete 274 `@jsxImportSource preact` pragmas; vitest configs (root, slow, package) jsx + aliases. Mechanical; compile errors then drive the component port.
S4. **Package CSS/manifest build** (L, dep S2): gen-safelist → gen-wind-manifest (+ `./wind.json` export), retire safelist.css (export + gen + check-safelist + check-package-safelist + CI job + required-checks manifest + b4push step + parity needle); gen-compiled-css: package-local wind config + new assertions; compiled.entry.css directive removal.
S5. **Shipped CSS + host global.css directive removal** (L, CSS explorer) — theme.css `@theme` → `:root` custom props, content/features/page-loading `@apply`/`@theme` refs, host+template global.css.
S6. **Component/island port** (XL, component explorers) — required before pages render (zfb SSR always uses zudo-react `renderToString`; preact vnodes won't render).
Gate after spine: `zfb check`, `zfb build`, `zfb wind audit` green on the showcase.

### After spine
W7. **Test harness port** (L): 102 test files off preact-render-to-string/preact to `zudo-react/server|client`; drop `findPreactRenderToString`; happy-dom hydration tests.
W8. **Generator** (M): scaffold.ts deps (drop preact/p-r-t-s or gate on designTokenPanel), template global.css/tsconfig/pages pragmas, claude-md-gen + README text, design-token-panel feature injection, scaffold/zfb-config-gen/slow tests, drift allowlist comments; run `/l-update-generator`, `pnpm check:template-drift`, generator whole test.
W9. **Fixtures & embed** (M): hostpanel 3 TSX ports; e2e/browser-embed port; DEPENDENCIES.md; re-run fixture drift checks.
W10. **Guards** (M): compatibility-deletion-matrix rows, site-schema-graph allowance, css-shape-smoke-gate re-baseline (after first deployed v3 CSS), design-token-lint class= check, check-compiled-css.
W11. **Docs** (M): EN+JA migration guide "zudo-doc 5 → 6 (zfb v3)", update CLAUDE.md/README/TESTING references to Tailwind/Preact, package README peer section.
W12. **Release 6.0.0** (M): `release-create-zudo-doc.sh major`; raise history-server peer floor + approvedBaseline to ^6.0.0; ZUDO_DOC_PIN/target-manifest rewritten by script; Breaking Changes in six changelog entries; `B4PUSH_SKIP_PIN_PUBLISHED=1 pnpm b4push`; publish order; record exact version for zfb docs host (#3328 acceptance).
W13. **Consumer rollout tracker** (S): list of 63 consumers, zfb docs host re-pin first.
W14. **Maintenance policy for 5.x** (S): freshness gate is red now; decide whether 5.x gets releases during the migration (needs a documented hold/allowlist in check-scaffold-pin-freshness) or 5.x is frozen.
