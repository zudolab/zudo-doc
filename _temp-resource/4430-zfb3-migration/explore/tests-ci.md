# tests-ci explorer map: zudo-doc (zfb 2.22.1) -> zfb 3.0.0

Scope: unit tests, e2e, CI, b4push, parity tooling, verification strategy.
Tree: $HOME/repos/myoss/zudo-doc @ main 337b9f110 (zudo-doc 5.28.2). All commands run from repo root unless noted.
Scratch lists referenced below live in `<planning-scratch>/explore/tests-ci/` (abbreviated `$S`).

Legend: **M** = measured (command shown), **I** = inference, **U** = unverified.

---

## 0. Headline numbers

| Fact | Value | Command |
|---|---|---|
| tracked test files (all) | 463 | `git ls-files \| grep -E '\.(test\|spec)\.(ts\|tsx\|mjs\|js)$' \| wc -l` |
| by dir | e2e 82, packages/zudo-doc 285, packages/create-zudo-doc 22, packages/doc-history-server 7, packages/search-worker 4, scripts 29, src 33, worker-tests 1 | same list piped to `awk -F/ ...\| sort \| uniq -c` |
| unit (non-e2e) test files | 381 | `grep -v '^e2e' $S/testfiles.txt \| wc -l` |
| static it()/test() count, unit files | 4,591 (zudo-doc pkg: 285 files / 3,005) | `xargs grep -hcE "^\s*(it\|test)(\.(each\(...\)\|skip\|only\|todo\|concurrent))?\(" < $S/unit.txt` summed |
| unit files coupled to the Preact runtime (union: imports preact*/preact-render-to-string/react*, jsxImportSource pragma, or .tsx) | **126** (zudo-doc 123, create-zudo-doc 2, src 1) — 1,241 static test cases | `xargs grep -lE "from ['\"](preact\|preact/[a-z-]+\|preact-render-to-string\|react\|react-dom[^'\"]*\|react/[a-z-]+)['\"]\|jsxImportSource\|\.tsx$" < $S/unit.txt` + `.tsx` files, `sort -u` |
| files importing preact-render-to-string | 82 (zudo-doc 81, create-zudo-doc 1 = string mention) | `xargs grep -lE "preact-render-to-string" < $S/unit.txt` |
| files mounting via preact `render()` + `act()` in happy-dom | 10 | `xargs grep -lE "import \{[^}]*\brender\b[^}]*\} from ['\"]preact['\"]" < $S/runtime-coupled.txt` |
| files with `@vitest-environment happy-dom` | 17 (+1 `new Window(` direct happy-dom = 18 DOM-env files; 27 files reference happy-dom/jsdom/@vitest-environment in any way) | `git grep -c "vitest-environment happy-dom" -- '*.test.*' \| wc -l` |
| files walking Preact VNode shape (`VNode`, `.props`, custom serialize/isVNode) | 30 (24 reference `VNode`, 23 access `.props`) | `git grep -lE "function (isVNode\|serialize\|walk\|findAll\|collect)[A-Za-z]*\(\|\.props\.children\|vnode\.type\|node\.type ===\|VNode" -- 'packages/zudo-doc/src/**/__tests__/*' 'src/**/__tests__/*'` |
| files importing preact/hooks in tests | 3 | `xargs grep -lE "preact/hooks" < $S/unit.txt` |
| `@jsxImportSource preact` pragma, all tracked files | 274 (124 in `__tests__`, 4 in e2e) | `git grep -l '@jsxImportSource preact' \| wc -l` |
| unit files asserting Tailwind-shaped tokens (heuristic regex) | 56 files / 210 occurrences (zudo-doc 49, create-zudo-doc 4, src 2, scripts 1) | regex `P` in §1.4 |
| runtime-coupled files with exact-markup string assertions (`toContain('<tag ...')`) | 53 files / 158 occurrences | `xargs grep -lE "(toContain\|toBe\|toEqual\|toMatch)\(\s*['\"\`]<[a-z]" < $S/runtime-coupled.txt` |
| unit files mentioning tailwind/@source/@theme/@apply/@utility/@custom-variant/safelist | 26 | `xargs grep -lE "tailwind\|Tailwind\|@source\|@theme\|@apply\|@utility\|@custom-variant\|safelist" < $S/unit.txt` |
| pinned sha256 HTML hashes in slow test (A2 no-stub parity) | 38 | `git grep -nE "[a-f0-9]{64}" -- 'packages/zudo-doc/src/__tests__/*.slow.test.ts'` |
| e2e spec files | 82 (smoke 51, sidebar 10, theme 10, i18n 6, versioning 4, hostpanel 1) | `sed 's#e2e/##' $S/e2e.txt \| ... uniq -c` |
| e2e static test() count | 411 | per-spec `grep -cE '^\s*test(...)\('` summed |
| e2e specs using getComputedStyle/toHaveCSS | 33 | table §2.2 |
| e2e specs using toHaveClass/classList/className | 9 | table §2.2 |
| e2e specs doing static dist reads | 29 | table §2.2 |
| e2e specs calling assertNoConsoleErrors | 12 (45 import `./fixtures`) | `grep -l assertNoConsoleErrors e2e/*.spec.ts \| wc -l` |
| island names in built showcase dist (dist built 2026-09-28 06:43, i.e. zfb 2.22.x — U: not rebuilt at HEAD) | 18 distinct (789 HTML pages) | `grep -rhoE 'data-zfb-island(-skip-ssr)?=[A-Za-z0-9_]+' --include='*.html' dist \| sort \| uniq -c` |
| ZFB_TAILWIND_BIN / ZFB_TAILWIND_OXIDE_WARMUP anywhere in tracked files | **0** | `git grep -lE 'ZFB_TAILWIND\|OXIDE_WARMUP' \| wc -l` |
| md-wasm `jsxRuntime:` option usage | **0** | `git grep -nE "jsxRuntime\s*:" -- ':!src/content' ':!*.md' ':!*.mdx'` |
| latest green pr-checks job durations (run 36351819646, zfb 2.22.1 bump, 2026-09-27) | E2E 267s, Build Site 176s, Theme A11y 166s, Package Unit 74s, Build Doc History 63s, Publish Contract 58s, Worker Contract 43s, Type Check 43s, HTML validate 42s, Slow Unit 41s, Root Unit 29s, Safelist 29s | `gh api repos/zudolab/zudo-doc/actions/runs/36351819646/jobs --jq ...` |

**Doc drift (M):** TESTING.md "Why L2 is skipped" says jsdom/happy-dom component tests are intentionally not used and must not be introduced, yet 17 test files declare `@vitest-environment happy-dom` and `packages/zudo-doc/package.json` has `"happy-dom": "^20.10.6"` (`grep -E '"happy-dom"' packages/*/package.json`). The migration will rewrite most of those files anyway; TESTING.md must be corrected in the same epic.

---

## 1. Unit tests

### 1.1 Configs

| Config | Env | Runtime coupling |
|---|---|---|
| `vitest.config.ts` (root; projects `unit` = `src/**/__tests__/**/*.test.ts`, `scripts` = `scripts/__tests__/**/*.test.{ts,mjs}`) | node | `resolve.alias` react/jsx-runtime→preact/jsx-runtime, react-dom→preact/compat, react→preact/compat; `server.deps.inline: [/@takazudo\/zfb/]` because `@takazudo/zfb/dist/island.js` imported `react/jsx-runtime` |
| `vitest.slow.config.ts` (root `*.slow.test.ts`) | node | same aliases + inline |
| `vitest.worker.config.ts` | `@cloudflare/vitest-pool-workers` 0.18.5 over `wrangler.toml`, `worker-tests/**` | none directly; consumes built `dist/_worker.js` |
| `packages/zudo-doc/vitest.config.ts` | node default, per-file `@vitest-environment happy-dom` | `esbuild: { jsx: "automatic", jsxImportSource: "preact" }`; alias `preact-render-to-string` to a pnpm-store path found by scanning `node_modules/.pnpm` (`findPreactRenderToString()`); react→preact aliases; inline zfb; testTimeout 30s |
| `packages/zudo-doc/vitest.slow.config.ts` | node | none (real `zfb build`s of committed fixtures) |
| `packages/create-zudo-doc/vitest{,.slow}.config.ts` | node | none (slow: scaffold + install + zfb build) |
| `packages/doc-history-server`, `packages/search-worker` | node | none |

v3 facts that change these (M from zfb v3.0.0): published `@takazudo/zfb@3.0.0` exports `./zudo-react`, `./zudo-react/jsx-runtime`, `./zudo-react/jsx-dev-runtime`, `./zudo-react/server`, `./zudo-react/client` as compiled `dist/*.js` (`npm view @takazudo/zfb@3.0.0 exports --json`). So: esbuild `jsxImportSource` → `@takazudo/zfb/zudo-react`; react→preact aliases and the `preact-render-to-string` store-scan alias become dead; `server.deps.inline` for zfb likely unnecessary (I — depends on whether v3 island.js still needs transforms; U).

### 1.2 How components are rendered in tests today (M)

- **SSR string contracts** — `preact-render-to-string` under plain node: 80 files (82 prts importers minus 2 that also mount). Swap target: `renderToString` from `@takazudo/zfb/zudo-react/server`. Import swap is mechanical, **but outputs differ** where markup differs (attribute spelling `class` vs `className` is already `class` in HTML; style objects must become HTML-spelled keys; island wrappers now carry `data-zfb-transport`, `data-zfb-protocol`, `data-zfb-build` and internal comment range markers — zfb `docs/src/content/docs/zudo-react/server-rendering.mdx`).
- **Hand-rolled VNode serializers / introspection** — 30 files (e.g. `packages/zudo-doc/src/nav-indexing/__tests__/helpers.ts` "Walks the Preact VNode tree … Function components are invoked with their props"). zudo-react descriptions are branded inert values (`$$zudo: "zudo-react.description.v1"`, api-reference.mdx) and v1 forbids child cloning/introspection patterns → these helpers must be rewritten to `renderToString` (I: cheapest path) — they break **mechanically**.
- **happy-dom interactive mounts** — 10 files use preact `render()` + `act()` (+ preact/test-utils): current-path-surfaces, doc-history-date-formats, doc-history-display-locale, html-preview-wrapper-visible-gate, preview-auto-height-component, mermaid-enlarge-button-injection, sidebar-toggle-interaction, sidebar-tree-active-path, theme-pack-switcher-interaction, theme-toggle-interaction. zudo-react `mount`/`hydrate` require a validated island wrapper + `RootOptions.identity` and return null on failure; `act` has no equivalent, `flush()` is the settle primitive (api-reference.mdx). zfb's own pattern (`packages/zfb/src/__tests__/zudo-react/hydrate.test.ts`): `host.innerHTML = renderToString(islandRoot(node,{identity}))` → `hydrate(node, host.firstElementChild, {identity, report})` → `await flush()`. These 10 files need **rewrite**, not import swap.
- **Hook unit tests** — `toc/__tests__/use-active-heading.test.ts` tests a hook directly; `theme-pack-switcher/__tests__/theme-pack-sync.test.ts`, `i18n-version/__tests__/language-switcher.test.tsx` call `use*` functions. Hooks do not exist in v3 → rewrite against the replacement setup-once/signal module.
- Other happy-dom files that are DOM-only (no Preact render): code-block-wrap-persistence, nav-overflow-active-exec (executes the generated inline script), sidebar-scroll-preserve, switcher-state, color-scheme-sync, design-token-panel-latch, nested-island-props-refresh (tests client-router props refresh). These survive the swap unless the scripts/markup they target change (I).

Per-file DOM-env detail: `$S/dom-detail.txt`.

### 1.3 Classification for planning

| Class | What breaks | Files (M) | Nature |
|---|---|---|---|
| A. Mechanical import/runtime break | preact imports, pragmas, render-to-string alias, VNode walkers | 126 runtime-coupled (subset below) | swap imports; rewrite walkers → renderToString |
| A1. SSR string contract | import swap + output drift | 80 | mostly mechanical; re-verify expected strings |
| A2. happy-dom mount/act | full rewrite to islandRoot→hydrate/mount→flush | 10 | expensive; mirrors component rewrite |
| A3. VNode introspection | helper rewrite | 30 | medium |
| A4. Hook tests | rewrite | 3 | follows component redesign |
| B. Assert markup/classes that change | class tokens, exact markup | 56 files (210 tw-shaped occurrences); 53 files / 158 exact-markup `toContain('<…')` | depends on wind token mapping; change only with a mapped reason |
| C. Tailwind pipeline contracts | safelist gen, compiled.css banner, @theme/z-index gen, content.css | 26 files mention tailwind/@source/safelist; key: `__tests__/gen-safelist.test.ts` (23 tw assertions), `scripts/__tests__/check-package-safelist.test.ts` (12), `__tests__/compiled-css.test.ts`, `theme-css.test.ts`, `gen-z-index.test.ts`, `z-index-defaults.test.ts`, `no-inert-spacing-utilities.test.ts`, `theme-no-reset-css.test.ts` | redefined, not ported: safelist → wind.manifests JSON candidate manifest |
| D. Generator contract | `create-zudo-doc/src/__tests__/scaffold.test.ts` asserts preact-compat `paths` block (l.1538-1545), `@takazudo/zudo-doc/safelist.css` import (l.1562), no `@types/react` (l.1893), `preact-render-to-string` always-on dep (l.2009-2018) | 4 create-zudo-doc tests mention tailwind/safelist; 2 runtime-coupled | intentional contract flips; update with generator |
| E. Pinned byte-hashes | `route-injection-build.slow.test.ts` 38 sha256 (A2 No-Stub Parity Gate) | 1 | full re-baseline; every hash moves |
| F. Snapshot files | `public-api-snapshot`, `ejectable-snapshot`, `component-tokens-snapshot`, `site-schema`, route-injection | 5 use toMatch*Snapshot; 0 `__snapshots__` dirs tracked | public API snapshot moves if hook exports disappear |

Contract test worth keeping and extending: `scripts/__tests__/zfb-md-wasm-release.test.ts` asserts md-wasm exports shape, `pre.hi-root`, no inline style, and that the package version equals the root pin — it will catch the md-wasm v3 export/digest change (M: file lines 66-237).

### 1.4 Tailwind-token regex used

`P='(expect|toContain|toMatch|toHaveClass|contains)\(?[^)]*["'"'"'\` ](-?(sm|md|lg|xl|2xl|hover|focus|group-[a-z-]+|peer-[a-z-]+|dark|data-\[[^]]*\]|aria-[a-z]+):[a-z]|(bg|text|border|ring|p[xytblr]?|m[xytblr]?|gap|w|h|min-w|max-w|min-h|max-h|flex|grid|inline|block|hidden|rounded|shadow|opacity|translate|scale|rotate|z|top|left|right|bottom|font|leading|tracking|transition|duration|animate)-[a-z0-9\[])'` — heuristic; overcounts (e.g. `validatePreset(...)`). Top files: gen-safelist.test.ts 23, home-page.test.tsx 22, doc-pager.test.tsx 13, content.test.tsx 13, check-package-safelist.test.ts 12, note-tray-card-list.test.tsx 10. Full list `$S/tw-assert.txt`.

---

## 2. E2E

### 2.1 Fixtures (M: `e2e/CLAUDE.md`, `git ls-files e2e/fixtures/<f>`)

| Fixture | Port | Tracked files | Purpose |
|---|---|---|---|
| sidebar | 4500 | 25 (24 mdx) | sidebar persistence/filter/resizer |
| i18n | 4501 | 17 (14 mdx) | locale fallback, generated resources |
| theme | 4502 | 2 | light/dark, theme packs, zdtp interplay, syntax highlight |
| smoke | 4503 | 45 (29 mdx + public assets) | general features; git repo for doc-history; builds browser-embed |
| versioning | 4504 | 11 | version switcher/banners |
| hostpanel | 4505 | 6 (incl. 3 tsx preact islands: `chrome-bindings.fixture.tsx`, `host-panel/bootstrap-island.tsx` (uses `useEffect` from preact/hooks), `host-panel/trigger.tsx`) | host-mounted design-token panel |

Each fixture copies root `pages/`, `src/{components,lib,styles,types,utils}`, `zfb.config.ts`, `tsconfig.json`, `src/chrome-bindings.tsx` (setup-fixtures.sh), so the host-side migration propagates into all six fixture builds automatically; `e2e/fixtures/hostpanel/src/**` and `e2e/browser-embed/main.tsx` (preact `h`/`Fragment` + `preact-render-to-string` running **in the browser** against `@takazudo/zudo-doc/chrome` + `compiled.css`) need their own port. `playwright.config.ts` boots one `zfb preview` per fixture (workerd).

### 2.2 Per-spec table (M; columns = static test count, computed-style hits, class-assert hits, dist-read hits, hydration-attr hits)

Full table: `$S/e2e-table.txt`. Highlights:
- Computed-style heavy (visual-parity signal already in-suite): i18n-home-intro 16, smoke-browser-embed 16, smoke-asset-viewer 13, theme-syntax-highlight 13, sidebar-hard-reload-flash 7, theme-html-preview-highlight 7, sidebar-toc-toggle 6, smoke-html-preview 5, smoke-image-enlarge 5.
- Tailwind class names asserted directly (will move with utility renames): `smoke-mobile-sidebar.spec.ts:31` `toHaveClass(/lg:hidden/)`, `:48` `/translate-x-0/`, `:61` comment `div.fixed.inset-0.z-30`; `versioning.spec.ts:161-199` `/hidden/` ×6; `theme-toggle.spec.ts:69` `/bg-accent\/10/`; `smoke-mobile-toc.spec.ts:22,61,76` selector `.xl\\:hidden`. (`grep -nE "toHaveClass" e2e/*.spec.ts`)
- Dist-read (L3) specs: 29 files — sensitive to island wrapper attribute changes if they grep raw HTML.

### 2.3 Island → spec coverage (M: `grep -lE "<keywords>" e2e/*.spec.ts`)

| Island (dist marker, count of 789 pages) | Specs touching it |
|---|---|
| ThemeToggle (789) | 13 (theme-toggle, theme-pack-*, theme-panel-*, sidebar-spa-nav-flash…) |
| ThemePackSwitcher (789) | 8 |
| ClientRouterBootstrap (789) | 24 (spaClick / zfb:after-swap / transition-persist users) |
| MermaidEnlarge skip-ssr (789) | 5 |
| ImageEnlarge skip-ssr (789) | 5 |
| AiChatModal skip-ssr (789) | 2 |
| SidebarToggle (771) | 7 |
| DesignTokenPanelBootstrap (742) / ConfiguredDesignTokenPanelBootstrap (47) | 11 (+ hostpanel) |
| SidebarTree (740) | 33 |
| DesktopSidebarToggle (734) | 11 |
| DocHistory skip-ssr (732) | 3 |
| Toc (624) / MobileToc (624) / DesktopTocToggle (624) | 8 / 1 / 2 |
| HtmlPreviewWrapperInner (18) | 3 (+ L6 `/test-flow-html-preview-hydration`) |
| SiteTreeNav (4) | 7 |
| PresetGenerator skip-ssr (2) | 1 dedicated (smoke-preset-generator) |
| SearchWidget (not an island; inline generated script) | 12 |
| find-in-page (Tauri only) | 0 |

Gap (M): only 12/82 specs call `assertNoConsoleErrors()`. v3 hydration "fails closed per island" and the default reporter is `console.error(diagnosticObject)` (`packages/zfb/src/zudo-react/root.ts:23` at v3.0.0) — an island that silently stays inert is caught only by a spec that exercises that island's interaction. `data-zfb-island-mounted` exists in both v2.22.1 and v3 (`git -C ../zfb grep -c island-mounted v2.22.1 -- packages`; islands.mdx:167) and is used by only 6 e2e occurrences today.

### 2.4 Policy constraints the migration must respect (M: TESTING.md)
- Anti-gaming: `test.skip`, `@flaky`, loosening a tolerance, deleting an assertion each need a linked issue; gate files (`playwright.config.ts`, `e2e/setup-fixtures.sh`, `pr-checks.yml`, `exam.yml`, `run-b4push.sh`, report scripts) need fresh-context review.
- Wait rules: `waitForTimeout` needs `// wait-ok:`; SPA nav via `spaClick`; sidebar via `waitForSidebarHydration` — these helpers key on island DOM/events that may change (I).
- Retry budget CI=1; retry-passes auto-file `retry-flake` issues (report-retry-flakes.mjs) — a noisy migration branch can spam issues; consider a `GITHUB_TOKEN`-less rehearsal (I).
- No committed visual baselines (`toHaveScreenshot` absent by decision) → a v2-vs-v3 screenshot diff must be an out-of-tree harness, not a committed baseline.

---

## 3. CI

### 3.1 Workflows (M: `grep -nE "^  [a-zA-Z0-9_-]+:$" .github/workflows/*.yml`)
- `pr-checks.yml` (1,474 lines): check-template-drift, check-no-host-alias-in-package, check-pin-parity, check-fixture-settings-drift, check-chrome-bindings-fixture-drift, check-package-safelist, publish-contract-gates, check-dist-mutating-tests, check-required-checks, check-b4push-ci-parity, check-e2e-spec-naming, check-flaky-tracking-issue, check-wait-debt, check-component-tokens, check-bash32-compat, lint-gates, typecheck, worker-contract, package-tests, root-tests, root-slow-tests, a2-parity-gate, build-site, html-validate, theme-a11y-pr, build-history, e2e, preview.
- `exam.yml`: scaffold-pin-published(+notify), e2e-full, slow-create, slow-zudo-doc, theme-a11y.
- `main-deploy.yml` / `preview-deploy.yml`: build-site, html-validate, build-history, deploy (+ CSS-shape smoke gate), notify.
- publish-{create-zudo-doc,zudo-doc,zudo-doc-history-server}.yml.
- `.required-checks-manifest`: 26 contexts (TESTING.md text lists 23 — doc drift; manifest adds Chrome Bindings Fixture Drift Check, Theme A11y Audit, Bash 3.2 Compatibility Lint).

### 3.2 Tailwind/Preact references in CI (M)
- ZFB_TAILWIND_BIN / OXIDE_WARMUP: 0 hits anywhere. No tailwind cache step (`grep -nE "cache\|tailwind\|oxide\|zfb" .github/actions/*/action.yml` → only pnpm store restore keyed on lockfile).
- Playwright: e2e and theme-a11y-pr jobs run in `mcr.microsoft.com/playwright:v1.58.2-noble` (no `playwright install` step).
- **`Package Safelist Check`** job (pr-checks.yml:175-196) = build package + `node scripts/check-package-safelist.mjs` — Tailwind-specific; must be redefined (manifest check) or retired, with `.required-checks-manifest` + branch protection updated in the same change.
- **`.github/actions/css-shape-smoke-gate/run.sh`** (used by main-deploy:359, pr-checks:1403, preview-deploy:387): asserts deployed CSS ≥ 50,000 bytes, ≥ 3 lines matching `^@media`, ≤ 2 leaked `--color-(gray|zinc|…)-N:` Tailwind default tokens. Thresholds tuned to Tailwind output; zudo-wind's fixed printer (not minified, own @media emission) can false-pass or false-fail — retune from a measured v3 build.
- `packages/zudo-doc/scripts/gen-compiled-css.mjs:assertCompiledCss` throws unless the CSS contains the banner `tailwindcss v4.2.0`, and asserts `@source/@apply/@tailwind/@import` absent, ≥ 75,000 bytes, specific rules (`.flex`, `.bg-surface`, `.text-fg`, `header[data-header]`, `.admonition-body>:where(*+*)`…). Runs in prepack (`check-compiled-css.mjs`) → Publish Contract Gates job.

### 3.3 Worker contract (M)
- `dist/_worker.js` (adapter-generated, 8.5 KB) forwards to `dist/_zfb_inner.mjs` (133,576 B). The inner bundle contains `preact/dist/preact` and `preact-render-to-string/dist/index` (`grep -oE "preact[a-z/-]*\|renderToString" dist/_zfb_inner.mjs`) → **yes, the Worker bundles a Preact SSR renderer**, even though `pages/api/ai-chat.tsx` (`prerender = false`, l.57) returns JSON via `new Response(JSON.stringify…)` and renders no JSX. (dist is from 2026-09-28 — U whether identical at HEAD, I: yes.)
- `worker-tests/worker-entry.test.ts` (pool-workers) asserts static `/robots.txt` 200 and a dynamic JSON route 200 + the SQLite DO counter; `scripts/verify-worker-dry-run.mjs` asserts one emitted entry exporting `AiChatDailySpendCap` + default and the adapter graph. Together they are the runtime proof that the v3 inner bundle (zudo-react server instead of preact) loads in workerd. Cheap once `dist/` exists (`pnpm test:worker:built`).
- `scripts/smoke-preview.mjs` asserts JSON content-type on the SSR route ("SSR likely not wired — missing dist/_worker.js or runtime crash").

---

## 4. b4push (34 steps; M: `grep -nE '^\s*step "' scripts/run-b4push.sh`)

| # | Step | v3 impact |
|---|---|---|
| 1 | Format check (mdx) | none |
| 2 | Template drift | **affected**: template `global.css`/tsconfig/pages stubs change (allowlisted files need manual review) |
| 3 | No-host-alias guard | low |
| 4 | Pin parity | **affected**: zfb family → 3.0.0 across root, scaffold.ts, package dev/peer, fixture; scaffold.ts also pins `preact ^10.29.1` + `preact-render-to-string ^6.6.6` (l.1020-1027) and zdtp |
| 5 | Fixture settings drift | only if settings fields change (e.g. new wind-related field) |
| 6 | Chrome-bindings fixture drift | **affected** if `src/chrome-bindings.tsx` changes (it will) — hostpanel override must follow |
| 7 | Tags audit | none |
| 8 | Current-only compatibility contract | **opportunity**: add deletion-matrix entries (preact imports, `tailwindcss` imports, `@source`, `@theme`, `className=`?) as the "migration complete" gate |
| 9 | Design token lint (`@takazudo/zudo-design-token-lint` 2.1.0, scans `class`+`className`) | still works on class strings; rules duplicate ZW006 once no default scales exist (I) |
| 10 | Component-tokens codegen drift | **affected** if generator emits Tailwind-shaped utilities/`@theme` |
| 11-13 | spec naming / flaky tracking / wait-debt | none (unless new specs) |
| 14 | Search-widget-script drift | **affected** if class tokens in the script change (generated literal) |
| 15 | Nav-overflow-script drift | **affected**: script mutates `classList`/`className` with tokens from `header/nav-class-tokens.ts` (`bg-fg text-bg`, `hover:text-accent`…) — runtime-added classes must be discoverable by wind (manifest/source) |
| 16 | Publish contract (prepack) | **affected**: check-safelist, check-compiled-css (Tailwind banner), check-theme-css etc. |
| 17-18 | dist-mutating guard / bash32 | none |
| 19 | Required-checks manifest + parity | **affected** if Package Safelist Check job is renamed/retired |
| 20 | Scaffold pin published guard | **affected** at release time (new pins must exist on npm) |
| 21 | Typecheck (zfb check + pages + packages) | **primary mechanical gate** for the swap |
| 22 | e2e/ typecheck | **affected** (hostpanel tsx, specs importing types) |
| 23 | Worker contract proof (build + check:worker + test:worker:built + dry-run) | **affected**: inner bundle renderer changes |
| 24-26 | Root unit / slow unit / package tests | **affected** (§1) |
| 27 | Package safelist check | **affected/retired** → replace with wind manifest coverage check |
| 28 | Build | **affected**: ZW009 leftovers fail the build; first real proof |
| 29 | Content-fallback | watch: MDX compile changes (Fragment import from zudo-react) |
| 30-31 | Link / image check | low (I) |
| 32 | HTML validation (`.htmlvalidate.json` = only `element-permitted-content`) | low-medium: zudo-react emits comment markers inside islands (fine), `template` unsupported inside islands |
| 33 | Preview smoke | affected only if SSR route breaks |
| 34 | Manual smoke | n/a |

---

## 5. Parity tooling

### 5.1 What exists (M)
- `scripts/migration-check/` + `/l-zfb-migration-check` (Astro→zfb) — **retired and deleted** (commit 4f497efb9 "chore: retire scripts/migration-check/ and l-zfb-migration-check skill", merged in 23faf3b36 #1687). Recoverable via `git show 4f497efb9^:scripts/migration-check/...` if any extractor is worth reviving (U: not inspected).
- `scripts/parity-build.sh` (135 lines): CI-faithful build — relocates gitignored `.claude/`/`src/content/` generated content (`git status --ignored`), runs `pnpm build`, then `parity-diff.mjs --generate|--verify`; default baseline dir `_temp-resource/2420-collapse-wiring-shells/baseline` (deleted; lessons say re-seal with `--generate`). **Writes repo `dist/`.**
- `scripts/parity-diff.mjs` (298 lines): per-route normalized-HTML sha256 (hard gate), raw sha, `__zfb/routes.json` route list, asset filename patterns, island-name manifest via `/data-zfb-island="([^"]+)"/g` — **bug for current output**: v2 dist emits unquoted `data-zfb-island=ThemeToggle` (minified HTML), so the regex only matches the 12 quoted `HtmlPreviewWrapperInner` occurrences plus prose samples (`grep -rhoE 'data-zfb-island="[^"]+"' --include='*.html' dist` → 12 HtmlPreviewWrapperInner, 4 `[^"`, 2 `&lt;Name>`). Island manifest is therefore unreliable as-is.
- `scripts/parity-html-normalize.mjs` (40 lines): only normalizes hashed asset filenames (islands-*.js, islands-chunk-*.js, styles-*.css). Shared with `route-injection-build.slow.test.ts`.
- `scripts/theme-a11y-audit.ts` (881 lines) + `theme-a11y-inventory.ts` + evaluator: static `node:http` server over a prebuilt dist (or `--url`), Playwright chromium, per pack×mode×page computed-style inventory (31 packs × 2 modes × 2 AUDIT_PAGES). Reusable machinery for computed-style capture.
- `e2e/*` 33 computed-style specs; `/verify-ui` (global skill) for ad-hoc computed styles; L6 skills `test-flow-html-preview-hydration`, `test-flow-sidebar-width-restore`.
- `.claude/skills/l-lessons-zfb-migration-parity/SKILL.md` (903 lines): cluster-first triage, "zfb is WIP — a dominant diff signature is a zfb gap", manager re-verification on persisted state, pin-sources-in-one-commit, CI-faithful builds, pack-not-link for downstream tests (dual-runtime SSR crash).
- Deps available for a harness (M): `parse5` in pnpm store (transitive, not a root dep), `happy-dom` (zudo-doc devDep), `@playwright/test` 1.58.2; no pixelmatch/pngjs/cheerio/linkedom.

### 5.2 What a v2-vs-v3 harness should compare (I, proposal)
Byte parity is the wrong target (island protocol attributes, comment range markers, class spellings and CSS all change by design). Compare in layers, each producing clustered signatures:
1. **Route set** — `__zfb/routes.json` + HTML file list identical (hard). Reuse parity-diff route list.
2. **Island inventory per route** — fix regex to accept unquoted/quoted markers; compare (name, when, skip-ssr) multiset per route; props JSON deep-equal after parse (hard; props are JSON transport in both).
3. **Normalized DOM structure per route** — parse5; drop `data-zfb-transport|protocol|build`, zudo-react comment markers inside island wrappers, `class` attr (separate layer), asset hashes; sort attributes; compare element tree + text. Cluster diffs by (tag path, attribute) signature before triage.
4. **Class-token mapping** — per element (matched by structural path) v2 class set vs v3 class set → emit a rename table; every rename must appear in the migration's token map, anything else is a regression.
5. **Computed styles** — Playwright on both dists (two static servers, theme-a11y-audit pattern), curated ~12 routes (home, getting-started, admonitions, a page with HtmlPreview, versions page, ja page, tag index, 404, asset viewer, changelog, preset generator, sidebar-heavy page) × {375, 1280} × {light, dark}; capture a fixed selector/property inventory (reuse theme-a11y-inventory selectors + chrome landmarks); numeric tolerance per property; plus full-page screenshots with an out-of-tree pixel diff reported as advisory (no committed baseline, per TESTING.md).
6. **Behavior** — the existing 411-test e2e suite + a new hydration-health probe per fixture: every `[data-zfb-island]`/`[data-zfb-island-skip-ssr]` reaches `data-zfb-island-mounted` after scheduling triggers (scroll for `visible`, idle wait), zero console errors whose args carry `code: "ZR_*"`.
7. **CSS inventory** — v2 compiled.css vs v3 zudo-wind CSS: selector set diff, custom-property set diff (tokens), @media query set; flags dead or missing utilities (complements `zfb wind audit`).

Baseline capture: build v2 once from a detached worktree at `main` (2.22.1) with `parity-build.sh` into a copied dist dir outside the repo, freeze it (dist + routes.json + computed-style JSON) — never regenerate the v2 side mid-epic.

---

## 6. Verification strategy (I, proposal)

### 6.1 Cheap, per implementation child (no heavy-guard needed)
- `pnpm --filter @takazudo/zudo-doc typecheck`, `pnpm check` (safe alongside dev), `pnpm check:e2e`.
- Targeted vitest: `pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts <dir>` for the component(s) touched.
- New per-island L1 "SSR→hydrate adopts cleanly" test (islandRoot → renderToString → hydrate → expect non-null handle, zero diagnostics) — this is L1-cost hydration parity; put a shared helper in `packages/zudo-doc/src/__tests__/zudo-react-island-harness.ts`.
- `zfb wind explain <candidate>` for each new token; `zfb wind audit` (read text output; see upstream candidate — it exits 0).
- Single-fixture e2e only for the island touched: `bash $HOME/.claude/scripts/heavy-guard.sh -- bash -c 'E2E_FIXTURES=smoke bash e2e/setup-fixtures.sh && E2E_FIXTURES=smoke npx playwright test e2e/smoke-<x>.spec.ts --project smoke'` (fixture build is heavy → guard it).

### 6.2 Central confirm sub-tasks (manager, via heavy-guard, run_in_background)
- **C0 Baseline freeze** (before any code): v2 parity capture (layers 1-7) + record current green durations; also run the hydration-health probe on v2 to validate the probe itself.
- **C1 Toolchain floor**: after bumping zfb family + vitest/tsconfig jsxImportSource + wind config skeleton — `pnpm check`, full `pnpm test`, `pnpm build` must pass on an otherwise-unconverted tree? (I: not possible if v3 has no preact path; then C1 = "one island + one page converted end-to-end, Worker contract green").
- **C2 CSS cutover**: after wind tokens/reset/manifest land — `pnpm build`, CSS inventory diff (layer 7), computed-style parity (layer 5) on the curated routes, theme-a11y audit full matrix (31×2×2).
- **C3 Island waves** (after each wave of ~5 islands): full `pnpm test`, full 6-fixture `pnpm test:e2e:ci`, hydration-health probe, layers 2-4 diff.
- **C4 Generator + package**: `pnpm pack` zudo-doc → scaffold barebone + all-features via create-zudo-doc (slow tests / `/l-generator-cli-tester`), `zfb build`; never `link:`.
- **C5 Final**: `pnpm b4push` (heavy-guard), full parity report (all layers), Worker contract (`pnpm verify:worker-contract`), exam dispatch `gh workflow run exam.yml --ref <branch>`, preview deploy + css-shape gate + manual curl of deployed preview (lessons: CI green ≠ delivered).
- Manager re-runs every child's claimed verification on the merged base (lessons: "sub-agent verified is not verification").

---

## 7. Upstream candidates (zfb unless noted) — evidence

1. **`zfb wind audit` cannot gate CI** (dx/gap): `crates/zfb/src/cli.rs:96-101` `WindAuditArgs` has only `--project-root`; `crates/zfb/src/commands/wind.rs:33-68` prints `render_audit(&report)` and returns `Ok(())` regardless of findings — no `--json`, no `--fail-on`, exit 0 always. (`git -C $HOME/repos/myoss/zfb show v3.0.0:crates/zfb/src/commands/wind.rs`)
2. **`zfb wind audit`/`explain` use the standalone source plan, not the build plan** (gap): wind.rs comment "This is the same default standalone plan as `zfb css` without explicit --source arguments. Neither command scans the build/dev package-route, mirror, or plugin roots." zudo-doc's markup ships from package-owned routes, so the audit under-reports what `zfb build` scans.
3. **v3 CLI docs still show a Tailwind-era safelist import** (docs): `docs/src/content/docs/api/cli.mdx` (v3.0.0) `zfb css` example imports `@takazudo/zudo-doc/safelist.css`; that file today is `@source inline("…")` (`head -c 400 packages/zudo-doc/dist/safelist.css`) which v3 rejects with ZW009.
4. **No zudo-react testing story** (docs/dx): no testing page under `docs/src/content/docs/zudo-react/`; migrating-to-v3.mdx has no test-tooling section (vitest `esbuild.jsxImportSource`, dropping react→preact aliases). `mount`/`hydrate` require a validated wrapper + identity, so every consumer hand-rolls zfb's internal `server()` helper (`packages/zfb/src/__tests__/zudo-react/hydrate.test.ts:11-17`). Candidate: public `@takazudo/zfb/zudo-react/testing` (render island, hydrate, collect diagnostics, flush).
5. **Default diagnostic reporter logs a bare object** (dx): `packages/zfb/src/zudo-react/root.ts:23` `console.error(value)` with the Diagnostic object; ZR_ code is not in a greppable string for log scrapers / Playwright `msg.text()` (U: exact Playwright rendering not tested).
6. **`@takazudo/zdtp` (not zfb) is still Preact + Tailwind** (gap, upstream = zdtp repo): `npm view @takazudo/zdtp@latest peerDependencies dependencies` → `preact ^10.29.1`, `@tailwindcss/browser 4.3.2`, `tailwind-merge 3.6.0`; its dist imports `preact`, `preact/hooks`, `preact/jsx-runtime`, `preact/compat` (`grep -rhoE "from ?['\"](preact[^'\"]*)['\"]" node_modules/@takazudo/zdtp/dist`). zudo-doc cannot drop preact until zdtp ships a zudo-react build or is isolated.

---

## 8. Risks (short)
- zdtp keeps Preact → dual runtime in the islands bundle or blocked design-token-panel (11 e2e specs + hostpanel fixture).
- Hydration fail-closed is silent-ish → inert islands pass most specs; need the hydration-health probe.
- 38 pinned hashes + 158 exact-markup assertions + 56 class-token test files invite "update expected to actual" gaming; require a token-map-justified change log.
- CSS-shape deploy gate and compiled-css asserts are tuned to Tailwind output (banner string, byte floors, @media count).
- Parity-diff island regex already broken for unquoted markers → any harness reusing it reports false "no islands".
- Heavy local runs contend: 6 fixture builds + theme-a11y + slow tests; all through heavy-guard.
- `retry-flake` auto-issue filing on a migration branch with churny specs can spam issues.
- TESTING.md drift (L2 claim; 23 vs 26 required contexts) will mislead child agents unless fixed early.
