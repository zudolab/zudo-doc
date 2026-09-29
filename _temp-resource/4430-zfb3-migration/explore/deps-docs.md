# deps-docs explorer map — zudo-doc 5.28.2 -> zfb 3.0.0

Scope: PART A (runtime deps with their own engines: zdtp, katex, mermaid, diff, zfb-md-wasm,
zfb-adapter-cloudflare, search-worker, doc-history-server, Tauri, e2e browser-embed, watchers,
zudo-design-token-lint) and PART B (docs + agent-instruction surface that states Tailwind/Preact facts).

All commands ran with cwd `$HOME/repos/myoss/zudo-doc` unless noted. Scratch outputs in
`<planning-scratch>/explore/deps-docs/`.
Legend: MEASURED = command output; INFERRED = reasoning; UNVERIFIED = not checked.

---------------------------------------------------------------------------------------------------

## A0. Headline findings

1. MEASURED (probe build): zfb 3.0.0's authored-CSS bundler does NOT honor package.json `exports`
   subpath maps. `@import "@takazudo/zdtp/styles.css"` fails; `@import "@takazudo/zdtp/dist/zdtp.css"`
   builds. zudo-doc's own six CSS artifacts are exported the same way (`./theme.css` ->
   `./dist/theme.css`, etc.), so every `@import "@takazudo/zudo-doc/<x>.css"` in the showcase, the
   scaffold template and every consumer would fail the same way. Upstream zfb bug (regression vs 2.x,
   where Tailwind did the real resolution). Blocking for the migration unless worked around by
   importing `dist/` paths.
2. MEASURED (probe build + headless browser): zdtp 0.8.5 (Preact inside) builds and mounts correctly
   when lazily imported from a zudo-react island in a zfb 3.0.0 project: lazy chunk 504,228 bytes
   includes zdtp + its Preact; `configurePanel` + `toggleDesignPanel` produce 1 `.tokenpanel-shell`,
   0 console errors, while zudo-react islands keep working. => Keep zdtp as an opaque self-mounting
   Preact bundle for the zudo-doc v3 major. Do not block on migrating zdtp.
3. MEASURED: zdtp's shipped CSS (`dist/zdtp.css`, 122,564 bytes) is plain CSS: 0 Tailwind directives,
   0 `theme()/--spacing()/--alpha()/--value()`, 0 `--tw-` vars -> passes ZW009.
4. MEASURED: md-wasm v3 API delta is `jsxRuntime` removal only (`git diff --stat v2.22.1 v3.0.0 --
   crates/zfb-md-wasm/npm/src/` = 9 deletions). zudo-doc passes no `jsxRuntime` anywhere; no wasm
   SHA-256 digest is pinned in the repo. md-wasm needs a version bump only.
5. MEASURED: design-token panel tweaks Tailwind-v4 `@theme` custom-property names (manifest has 51
   `cssVar` entries: `--spacing-vsp-*` x8, `--spacing-hsp-*` x7, `--text-*` x7, `--text-scale-*` x7,
   `--leading-*` x4, `--font-weight-*` x4, `--spacing-icon-*` x4, `--radius-*` x2, ...). zudo-wind
   emits utilities against `--zw-*` vars. To keep live panel tweaks working, `wind.tokens` must point
   at the project properties (e.g. `spacing: { "hsp-sm": "var(--spacing-hsp-sm)" }`) and authored CSS
   must keep declaring those properties — or the manifest must be renamed to `--zw-*`. Cross-area
   constraint for the CSS/token workstream.
6. Docs surface: 48 EN / 45 JA non-changelog pages mention engine terms; ~12 per locale need a real
   rewrite; the rest are one-line wording fixes ("Preact island" -> "island"/"zudo-react island").

---------------------------------------------------------------------------------------------------

## PART A — dependencies and runtimes

### A1. @takazudo/zdtp 0.8.5 (Design Token Panel)

Facts (MEASURED):
- `node_modules/@takazudo/zdtp/package.json`: peerDependencies `preact ^10.29.1`; dependencies
  `@tailwindcss/browser 4.3.2`, `culori ^4.0.2`, `tailwind-merge 3.6.0`; repo
  `Takazudo/zudo-design-token-panel` (local clone `$HOME/repos/myoss/zdtp`, HEAD 6e22465 v0.8.5).
- zdtp dist imports (`grep -rhoE 'from ?"(preact[^"]*|react[^"]*|tailwind-merge|culori)"' dist`):
  `preact` x1, `preact/compat` x1, `preact/hooks` x2, `preact/jsx-runtime` x3.
- Tailwind browser runtime is bundled inside zdtp (`index-Byasm3Xo.js`: 341 `tailwindcss` refs) and
  only drives the DOM-Tweaker class editor, which activates only when the config supplies
  `domTweaker`. zudo-doc never supplies it (`grep -rn -i "tweaker|tailwind"
  packages/zudo-doc/src/design-token-panel-config/` -> none; bootstrap.tsx:217 comment only). Dormant.
- zdtp CSS: `dist/zdtp.css` single minified line, 122,564 bytes; only `@container`, `@media`,
  `@keyframes` at-rules; `grep -c -- "--tw-"` = 0; ZW009-forbidden constructs = 0.
- zdtp source size (for the "migrate zdtp" option): `git -C zdtp ls-files packages/zdtp/src | grep
  -E '\.tsx?$' | grep -v tests` = 169 files (77 .tsx), ~38,929 lines, 490 hook calls, 18 files using
  `createPortal`/`createContext` (both absent from zudo-react).
- zdtp issue search (`gh issue list -R Takazudo/zudo-design-token-panel --state all --search
  "zfb v3" | "zudo-react" | "zudo-wind"`): no v3 / zudo-react / zudo-wind plan exists.
- Circularity: zdtp's own `doc/` site pins `@takazudo/zudo-doc ^5.27.0` and zfb 2.20.3; `playground/`
  pins zfb 2.20.3; `.github/workflows/consumer-drift.yml` runs zudo-doc against the local panel
  build. zudo-doc 6 (zfb v3) becomes a downstream migration for zdtp's doc site.

How zudo-doc loads it (MEASURED, files under `packages/zudo-doc/src/`):
- `doc-body-end-islands/design-token-panel-island.tsx` (62 lines): SSR emits an inline toggle shim
  `<script dangerouslySetInnerHTML>` + `Island({ when: "load", children: <DesignTokenPanelBootstrap/> })`.
- `design-token-panel-bootstrap.tsx` (858 lines): component renders `null`, calls
  `runDesignTokenPanelBootstrapOnce(...)`; zdtp loaded lazily via
  `import("@takazudo/zudo-doc/zdtp-loader")` (line 413); type-only imports from `@takazudo/zdtp` and
  `import type { JSX } from "preact"`.
- `zdtp-loader.ts` (9 lines): `export * from "@takazudo/zdtp"`.
- `plugins/zdtp-loader.ts` (48 lines): shadows the loader via `ctx.addVirtualModule` when zdtp is not
  bundled; its comment says "Workaround for zfb#3002". MEASURED: zfb#3002 is CLOSED 2026-09-15 —
  the comment is stale (the virtual-module approach still works; optional cleanup).
- `src/styles/global.css:22`: `@import "@takazudo/zdtp/styles.css";` <- breaks under v3 (A0.1).
- `packages/create-zudo-doc/src/features/design-token-panel.ts`: inserts the same import line after
  `@layer zd-preflight, zd-flow;` — must change with the template.
- Tests: 18 files under `packages/zudo-doc/src/**/__tests__` mention zdtp; 11 e2e specs touch the
  panel (`hostpanel-design-token-panel`, `smoke-design-token-panel{,-probe,-ui}`,
  `theme-pack-zdtp-interplay`, `theme-panel-{persistence,repaint}`, ...). hostpanel fixture's
  `src/host-panel/bootstrap-island.tsx` uses `useEffect` from `preact/hooks` — must be rewritten to
  zudo-react (`getScope().onActivate`).

Probe (MEASURED, scratch `.../explore/deps-docs/v3probe/`, never inside the repo):
- `git -C $HOME/repos/myoss/zfb archive v3.0.0 crates/zfb/templates/basic-blog | tar -x ...`,
  deps `@takazudo/zfb 3.0.0`, `@takazudo/zfb-runtime 3.0.0`, `@takazudo/zdtp 0.8.5` (npm auto-installed
  the preact peer), added a `"use client"` zudo-react island doing `import("@takazudo/zdtp")` inside
  `getScope().onActivate`.
- `zfb --version` -> `zfb 3.0.0`, embedded esbuild 0.25.12.
- Build 1 with `@import "@takazudo/zdtp/styles.css";` ->
  `✗ error: production asset emitters failed / CSS emitter (DefaultRunner) failed / failed to resolve
  authored CSS import "@takazudo/zdtp/styles.css" from .../styles/global.css at .../global.css:0:1`.
- Build 2 with `@import "@takazudo/zdtp/dist/zdtp.css";` -> `✓ 6 pages built in 2.26s`; styles css
  161,178 bytes containing 43 `tokenpanel-shell` refs; zdtp lazy chunk `islands-chunk-BLEYLDLH.js`
  504,228 bytes.
- Headless (Playwright 1.58.2 from the repo's pnpm store, run from scratch): island text
  `loaded:40` (40 zdtp exports), `configurePanel` + `toggleDesignPanel` -> `.tokenpanel-shell` count 1,
  2 `[data-zfb-island]`, 0 console errors / page errors.

Root cause in zfb (MEASURED): `git show v3.0.0:crates/zfb-css/src/css_imports.rs`
`resolve_package_specifier` (line 508): "Explicit subpath (`pkg/dist/tokens.css`) — resolve it
directly" via `file_or_css_index(&pkg_root.join(sub))`; `exports` is consulted only for a bare package
(`package_css_entry`). In v2.22.1 the same function existed (line 365) but its module header says
"zfb shells out to the Tailwind v4 standalone CLI ... Tailwind resolves `@import` targets", i.e. it
only built the watch graph. v3 promoted it to the real resolver (commit 86ffa9c2 "feat(zfb-css):
attribute package URLs while bundling authored CSS").

Options and recommendation:
| Option | Cost | Risk | Verdict |
|---|---|---|---|
| Keep zdtp as opaque Preact bundle; zudo-doc bootstrap becomes a zudo-react island (render null + `getScope().onActivate`/lazy import) | S–M in zudo-doc | Two runtimes on page only when the panel opens (~500 KB lazy, already the case today); preact stays an install-time peer | RECOMMENDED (probe-proven) |
| Migrate zdtp to zudo-react + zudo-wind first | XL (169 files, 490 hooks, 18 portal/context files) | Blocks zudo-doc major on a second product rewrite | Defer; track as separate zdtp epic |
| Drop the panel in the v3 major | S | Feature regression | Reject |

Consequences of the recommendation:
- zudo-doc no longer needs `preact` for its own code, but a designTokenPanel-ON project still needs
  preact installed as zdtp's peer. Root `package.json` keeps `preact` (showcase has the panel on);
  `packages/zudo-doc` drops the `preact` peer; create-zudo-doc adds `preact` only in the
  designTokenPanel dependency block (today `scaffold.ts:1016-1051` adds it unconditionally with a
  "single preact instance" rationale that disappears).
- The root `pnpm.overrides.preact = 10.29.2` can stay (only zdtp consumes it).
- CSS import: switch to a path that resolves (`@takazudo/zdtp/dist/zdtp.css`) only as a temporary
  workaround with an upstream-issue pointer, or wait for the zfb fix. Same decision for
  `@takazudo/zudo-doc/*.css`.
- Upstream (zdtp, optional): bundle Preact inside zdtp (or make it a dependency) so zfb v3 hosts are
  not asked to install a framework the zfb migration guide says to remove.

### A2. katex (optional peer ^0.16)
- MEASURED: `packages/zudo-doc/src/math-block/index.tsx:43` `const katex = await import("katex").then(pickKatex, () => null)`
  — server-side top-level await; output is an HTML string. KaTeX CSS is an injected `<link>`
  (`head/doc-head.tsx`, `head/types.ts:64`).
- Engine impact: none for katex itself; the HTML insertion moves from `dangerouslySetInnerHTML` to
  zudo-react `rawHtml` (owned by the component-port workstream). Keep as optional peer.

### A3. mermaid (not a dependency)
- MEASURED: `code-syntax/mermaid-init-script.ts:66` `MERMAID_CDN_MODULE_URL = "https://esm.sh/mermaid@11.15.0"`;
  inline init script does `await import(<cdn url>)` (line 304). `mermaid-enlarge` is a zudo-doc island.
- Engine impact: script injection -> `rawHtml`; the mermaid-enlarge island is ported with the other
  islands. No dependency change.

### A4. diff (optional peer ^8)
- MEASURED: `doc-history/index.tsx:163,187` type import + rejection-handled `import("diff")` inside
  the DocHistory island. Engine-agnostic library. No change beyond the island port.

### A5. @takazudo/zfb-md-wasm
- MEASURED call sites (non-test): `home-intro/prepare.ts:84-99` (`renderHtml(source, { dialect:
  "markdown", pipeline: {...} })`), `plugins/routes.ts:576` and `html-preview-wrapper/highlight-runtime.ts:4,56`
  (`@takazudo/zfb-md-wasm/highlight`), `e2e/browser-embed/main.tsx:6,65` (`renderHtml(MARKDOWN,
  { filename, pipeline })`). No `jsxRuntime` anywhere (`grep -rn "jsxRuntime"` hits only
  `/** @jsxRuntime automatic */` pragmas).
- MEASURED v3 exports: `. ./highlight ./render ./parse` (unchanged); peerDependencies `{}`.
- Digests: `git grep -n -i -E "sha256|integrity|\.wasm\b"` finds no wasm digest pin (only e2e resource
  filename checks in `e2e/smoke-html-preview.spec.ts:192-242` by prefix/extension, and a
  `scaffold.ts:930` comment). `scripts/__tests__/zfb-md-wasm-release.test.ts` asserts exact highlight
  HTML for html/css/javascript fences + version == root pin + glue/wasm size > 0. The exact-HTML
  expectations are UNVERIFIED against 3.0.0 (highlighter code not in the v3 diff, so expected unchanged).
- Required: bump pins; nothing else in md-wasm usage.

### A6. @takazudo/zfb-adapter-cloudflare
- MEASURED: v3 release notes "No package-specific changes". `pages/api/ai-chat.tsx` imports
  `getCloudflareContext`, returns `Response` objects; no JSX elements rendered (`grep -n "<[A-Za-z]"`
  -> only generic types). `worker-entry.ts` / `worker-preview-entry.ts` wrap `./dist/_worker.js`.
- Required: pin bump; re-run `pnpm verify:worker-contract` after the build switches to zudo-react SSR.

### A7. packages/search-worker, packages/doc-history-server
- MEASURED: no `.tsx`, no preact/jsx imports (only two comments mentioning `pages/api/ai-chat.tsx`).
  No engine impact.

### A8. src-tauri, src-tauri-dev
- MEASURED: no preact/tailwind/jsx references in `src-tauri*/src`, `tauri.conf.json`,
  `src-tauri-dev/frontend/index.html`. They serve `dist/` or the dev server. No engine impact
  (the `tauri` scaffold feature's find-in-page files are a template-drift concern for the component port).

### A9. e2e browser-embed
- MEASURED: `e2e/browser-embed/main.tsx` uses `h`, `Fragment` from `preact`, `renderToString` from
  `preact-render-to-string`, `/** @jsxImportSource preact */`, maps `class` -> `className` in
  `htmlToPreact`, and renders `createChrome(...).renderDocPage(...)` to a string. Built by
  `pnpm exec vite build --config e2e/browser-embed.vite.config.ts` in `e2e/setup-fixtures.sh:709-721`,
  which also copies `packages/zudo-doc/dist/compiled.css`. Spec: `e2e/smoke-browser-embed.spec.ts`.
- v3 replacement exists (MEASURED `packages/zfb/src/zudo-react/{index,server}.ts`): `h`, `Fragment`
  from `@takazudo/zfb/zudo-react`; `renderToString(node)` from `@takazudo/zfb/zudo-react/server`.
  Must keep `class` (no className mapping). Whether `/server` runs in a browser bundle is UNVERIFIED
  (it is pure TS: description.ts + render-html.ts).
- `DEPENDENCIES.md` line 40 justifies `preact-render-to-string` + `vite` by this fixture; update it.
- Also: `guides/browser-embedding.mdx` (EN+JA) documents this exact Preact recipe.

### A10. .claude/.codex watchers and scripts
- MEASURED: `scripts/dev-claude-watch.mjs` / `dev-codex-watch.mjs` import chokidar +
  `@takazudo/zudo-doc/plugins/claude-resources`; no preact/tailwind. Engine-agnostic MDX generators.
- `scripts/*` engine mentions (`grep -rn -i -E "preact|tailwind|className|jsxImportSource" scripts/*.{mjs,ts,js,sh}`):
  `check-package-safelist.mjs` (4, validates `dist/safelist.css` — obsolete under wind manifests),
  `check-template-drift.sh` (1 comment), `gen-tauri-icon.mjs` (1 comment), `setup-zudo-doc-wisdom.sh`
  (1: skill description "built with zfb, MDX, Tailwind CSS v4, and Preact islands").

### A11. @takazudo/zudo-design-token-lint 2.1.0 (bin `design-token-lint`, `pnpm lint:tokens`)
- MEASURED: repo `Takazudo/zudo-design-token-lint`; deps chalk + glob only. `dist/extractor.js`:
  `DEFAULT_CLASS_ATTRIBUTES = ['className', 'class']`, `DEFAULT_CLASS_FUNCTIONS = ['cn','clsx','classNames','twMerge']`.
  `rules.js`: "Checks Tailwind class names", strips variants at the last `:` and both Tailwind v3
  (`!p-4`) and v4 (`p-4!`) important forms. `css-rules.js`: opt-in `zIndex`/`colorLiterals` on plain CSS
  declarations — no `@theme` parsing.
- `.design-token-lint.json`: 36 prohibited patterns (spacing `{n}` scales, `z-{n}`, Tailwind-default
  `{color}-{shade}` palette), patterns `src/**/*.{tsx,jsx}`, `packages/**/*.{tsx,jsx}`.
- Assessment (INFERRED): works unchanged on zudo-react `class=` markup. The `{color}-{shade}` rules
  become redundant under zudo-wind (no default palette -> such candidates are already compile errors),
  and `zfb wind audit` overlaps. Keep the linter for spacing/z-index discipline; no upstream release is
  required. Optional upstream polish: recognise zudo-wind-rejected spellings (`!`-important, stacked
  variants) or add a zudo-wind preset. Issue search for "zudo-wind"/"zfb v3": none; open #187 (arbitrary
  `z-[70]` skipped) is unrelated.
- `gen-component-tokens` / `gen-z-index` are zudo-doc's own bins (`packages/zudo-doc/bin/`), pure fs,
  write `--zdc-*` custom-property blocks into content.css/features.css — no Tailwind dependency.

### A12. preact footprint that the dependency change touches (MEASURED)
`git ls-files <dir> | grep -E '\.(tsx?|mjs|js)$' | xargs grep -l -E "from ['\"](preact|preact/[a-z-]+|preact-render-to-string)['\"]|@jsxImportSource preact"`:
| dir | files | of which tests |
|---|---|---|
| packages/zudo-doc/src | 269 | 128 |
| pages | 10 | 0 |
| src | 4 | 1 |
| e2e (non-dist) | 4 | 0 |
| packages/create-zudo-doc/templates | 2 | 0 |
| packages/create-zudo-doc/src | 1 | 1 |
`@jsxImportSource preact` pragma files (non-test, packages/zudo-doc/src + pages + src): 142.

Dependency manifest changes (INFERRED from the above):
- root `package.json`: zfb family 2.22.1 -> 3.0.0 (4 pins); drop `preact-render-to-string` once
  browser-embed is ported; keep `preact` only as zdtp's peer (+ keep override); keep `vite` if
  browser-embed stays vite-built.
- `packages/zudo-doc/package.json`: peers zfb/md-wasm/runtime `^3.0.0`; remove `preact` peer and dev
  deps `preact`, `preact-render-to-string`; keywords drop "preact"; keep zdtp optional peer.
- `packages/zudo-doc/tsconfig.base.json`: `jsxImportSource` -> `@takazudo/zfb/zudo-react`.
- root + template `tsconfig.json`: drop the `react`/`react/jsx-runtime`/`react-dom` -> preact paths
  (template `packages/create-zudo-doc/templates/base/tsconfig.json` lines 6-9).
- `scripts/check-pin-parity.mjs`, `check-scaffold-pin-freshness.mjs`: pin lists unchanged in shape;
  values bump. `scaffold.ts` ZFB pins + the long per-version comment block.

---------------------------------------------------------------------------------------------------

## PART B — documentation and agent-instruction surface

### B1. Showcase docs counts (MEASURED)
- Tracked docs: `git ls-files 'src/content/docs/*' 'src/content/docs-ja/*' | grep -E '\.mdx?$'` = 648
  (EN 324 = 211 changelog + 7 blog + 106 core; JA identical 324/211/7).
- Core (non-changelog/blog) pages with engine terms
  (`P='[Tt]ailwind|@theme|@apply|[Pp]react|\bReact\b|\bJSX\b|jsxImportSource|[Ii]sland|className|dangerouslySetInnerHTML|\buse(State|Effect|Ref|Memo)\b'`;
  JA additionally `アイランド`): EN 48, JA 45. EN-only 3 (`components/admonitions`, `guides/changelog`,
  `guides/i18n`) are generic "JSX in MDX" wording that needs no change.
- Per-category over core pages (python scan, `doc-hits.json`): EN tailwind 10 files/66 occ; `@theme`
  family 7/39; preact 19/34; island 30/135; className 3/24; dangerouslySetInnerHTML 2/4. JA matches
  EN for tailwind/@theme/preact/className/dsih.
- Code samples: `from "preact"` imports in 2 pages per locale (`guides/browser-embedding`,
  `guides/custom-components`); hook calls in 1 per locale (`guides/custom-components`); `className=` JSX
  lines: `reference/component-first` 13, `guides/custom-components` 2, `reference/frontmatter-preview` 1.
- Live (unfenced) class/style JSX in MDX: 40 lines total, all benign (HtmlPreview iframe demos, inline
  code in prose) — `components/html-preview.mdx` 13 per locale (includes a Tailwind-CDN-in-iframe demo,
  which stays valid because it runs inside the preview iframe, not zudo-wind). No `style={{` outside
  fences.
- Changelog: 33 EN changelog pages mention these terms — historical, leave untouched; add new 6.0.0
  (zudo-doc + create-zudo-doc) entries EN+JA.
- `src/content/docs-v1` (5 files, English-only archived version): 0 engine-term hits. Issue #3328 asks
  to keep 2.x-era docs "clearly versioned" — the showcase already has a `versions` mechanism
  (`src/config/settings.ts:287-297`, slug 1.0 -> `src/content/docs-v1`), so snapshotting current 5.x docs
  as a version is possible (decision for the plan).
- Generated (gitignored) mirrors: `src/content/docs{,-ja}/claude-md|claude-skills|codex-*` are
  regenerated from CLAUDE.md/skills by the watchers — they update automatically once the sources change.

### B2. Page list (EN path; JA mirror exists for all 48) — rewrite weight
Heavy rewrite (examples/architecture are Tailwind/Preact-specific):
- `reference/design-system.mdx` — tailwind 27, @theme 16; describes "only preflight + utilities loaded",
  `@import "tailwindcss/preflight" layer(zd-preflight)`, `@theme` token strategy. Rewrite around
  `wind.tokens`, reset choice, `--zw-*`.
- `reference/color.mdx` — tailwind 13, @theme 10; `@theme` wipe of `--color-*`, 23 `--color-zd-*`
  aliases, three-tier color strategy.
- `reference/customizing.mdx` — @theme 7; "Token overrides = @theme block in global.css" tier.
- `reference/component-first.mdx` — Tailwind utilities, "write `className`, not `class`", footer
  sample with `className` + `dangerouslySetInnerHTML` (inverts under zudo-react: `class`, `rawHtml`).
- `guides/custom-components.mdx` — preact 5, island 17, className 7, `import type { ComponentChildren } from "preact"`, hook sample.
- `guides/browser-embedding.mdx` — Preact + preact-render-to-string recipe, `useEffect` hydration notes,
  "does not need zfb's Tailwind pipeline".
- `guides/development-workflow.mdx` — "zudo-doc is a Preact-only project running on zfb"; server
  vs island section.
- `getting-started/installation.mdx` — tsconfig "preact-compat `paths`", global.css "`@theme { … }` block".
- `getting-started/introduction.mdx` — feature bullets "Tailwind CSS v4", "Preact islands".
- `guides/dynamic-page-transitions.mdx` — two `@theme { ... }` samples.
- `reference/component-tokens.mdx` — "components hardcode their Tailwind utility classes".
- `reference/theme-packs.mdx` — "never the `--color-*` Tailwind alias", "never against Tailwind utility".
- `reference/smart-break.mdx` — "For Preact islands", `dangerouslySetInnerHTML` sample -> `rawHtml`.
- `reference/frontmatter-preview.mdx` — "Each renderer is a Preact component", className sample.
- `components/basic-components.mdx` — tech table row "Tailwind v4".
Light wording ("Preact island"/"Preact component" -> "island"/"component"), island semantics check:
- `components/{category-nav,category-tree-nav,note-tray-index,site-tree-nav,image-enlarge}.mdx`,
  `guides/{ai-assistant,doc-history,header-right-items,configuration,body-foot-util-area,sidebar-filter,deployment}.mdx`,
  `reference/{host-chrome-bindings,design-token-panel,create-zudo-doc,doc-history-server}.mdx`,
  `markdown-features/{mermaid,image-enlarge,heading-marker-toc,toc-export,index}.mdx`,
  `getting-started/writing-docs.mdx` ("You can use Preact components in your documentation"),
  `guides/claude-skills.mdx` (design-system skill description).
- `reference/design-token-panel.mdx` additionally must document the zdtp Preact peer and the CSS
  import spelling.
- `components/html-preview.mdx` — "preflight reset (Tailwind v4 CSS reset injected into every preview)"
  describes HtmlPreview's own iframe reset; verify whether that reset source changes (UNVERIFIED).
Full snippet dump: `.../explore/deps-docs/en-snippets.txt`; hit table: `doc-hits.json`.

### B3. Agent instructions / repo docs (MEASURED line counts of engine terms)
`xargs grep -c -E "$P" < instr-files.txt` (P adds `safelist`):
| file | lines | sections |
|---|---|---|
| packages/zudo-doc/CLAUDE.md | 40 | "Shipped CSS artifacts (six static + one compiled)" 26; "GOTCHA — preact/compat `paths` stay in the PROJECT tsconfig" 10; preset; tsconfig base |
| src/CLAUDE.md | 19 | CSS & Components 5, Three-Tier Font-Size 5, Components 3, Three-Tier Color 2, Color Rules 2, Z-index, Two-Tier Size |
| .claude/skills/l-lessons-zfb-migration-parity/SKILL.md | 18 | migration lessons (historical; add v3 lessons) |
| packages/zudo-doc/README.md | 11 | "Styling — Tailwind setup for consumers" 8 |
| TESTING.md | 11 | "Package Safelist Check" 6, T1 CI gates 3 |
| .claude/skills/zudo-doc-design-system/SKILL.md | 9 | "Server-rendered Preact vs client islands", color tokens, "Component First" — also shipped as scaffold template `templates/features/claudeSkills/files/.claude/skills/zudo-doc-design-system/SKILL.md` (11 lines) |
| packages/zudo-doc/API.md | 5 | "## 3. `@theme` Design Tokens" (public API contract), CSS Artifacts, Drift Guards |
| README.md | 5 | Tech Stack, Project Structure |
| CLAUDE.md (root) | 5 | Tech Stack (Tailwind v4 + Preact bullets), Commands (safelist b4push step), Key Directories |
| .claude/skills/l-migrate-to-preset-style/SKILL.md | 4 | |
| DEPENDENCIES.md | 3 | keep-table rows for preact / preact-render-to-string / vite |
| .claude/skills/{test-flow-html-preview-hydration,l-update-generator} | 2 each | |
| e2e/CLAUDE.md, packages/create-zudo-doc/{CLAUDE,README}.md, src-tauri/README.md, skills test-flow-sidebar-width-restore / l-generator-cli-tester / color-scheme-a11y | 1 each | |
| AGENTS.md (26 lines), .codex/* (config, agents, hooks, rules; skills are symlinks to .claude/skills/b4push + check-docs) | 0 | nothing to change |
| CONTRIBUTING.md | 0 | |
Generated-but-templated text:
- `packages/create-zudo-doc/src/claude-md-gen.ts:45-58` — emitted CLAUDE.md Tech Stack ("Tailwind CSS v4
  — compiled by zfb's embedded Tailwind engine", "Preact — for interactive islands only (with compat
  mode for React API)").
- `packages/create-zudo-doc/src/scaffold.ts:123-146` — emitted README EN+JA ("Tailwind CSS v4 for styling"
  / "スタイリングには Tailwind CSS v4").
- `packages/create-zudo-doc/templates/base/src/styles/global.css` (Tailwind imports, `@source` x3,
  `@theme {}`), `templates/base/tsconfig.json` (preact paths), `templates/base/pages/docs/[[...slug]].tsx`
  and `templates/features/i18n/files/pages/[locale]/docs/[[...slug]].tsx` (2 hits each).
- `scripts/setup-zudo-doc-wisdom.sh:88` skill description; gitignored
  `.claude/skills/zudo-doc-wisdom/SKILL.md` still says "Astro 6 ... Tailwind CSS v4, and Preact islands".

---------------------------------------------------------------------------------------------------

## Proposed sub-tasks (each <= ~20 tool calls)

PART A — dependency strategy
- A-1 (S) Pin bump + manifests: zfb family 3.0.0 in root, packages/zudo-doc peers/dev, create-zudo-doc
  scaffold pins + comment block; drop preact peer from packages/zudo-doc; keep root preact for zdtp.
  Depends on: component/CSS ports landing in the same major branch.
- A-2 (M) zdtp opaque-bundle adaptation: port `design-token-panel-bootstrap.tsx` (+ island wrapper,
  inline shim -> rawHtml) to zudo-react; keep lazy `zdtp-loader`; move scaffold `preact` dep into the
  designTokenPanel block; update scaffold tests; refresh stale #3002 comment. Verify with the 11 panel
  e2e specs + hostpanel fixture port (`useEffect` -> `getScope().onActivate`).
- A-3 (S) CSS import spelling decision: file zfb upstream bug (exports subpath), then either wait for
  the fix or switch `@takazudo/zdtp/styles.css` and `@takazudo/zudo-doc/*.css` imports to `dist/`
  paths with a TODO pointing at the upstream issue (showcase global.css, template global.css,
  design-token-panel feature, e2e fixtures).
- A-4 (S) Token-name bridge for the panel: agree with the CSS workstream that `wind.tokens` values point
  at the 51 panel-managed custom properties (or rename the manifest), and add an e2e assertion that a
  panel spacing tweak still moves a utility-styled element.
- A-5 (S) md-wasm + adapter: bump, re-run `scripts/__tests__/zfb-md-wasm-release.test.ts`,
  `pnpm verify:worker-contract`; confirm exact highlight HTML unchanged.
- A-6 (M) e2e browser-embed port: rewrite `e2e/browser-embed/main.tsx` to zudo-react `h`/`Fragment`
  + `/server` `renderToString`, drop className mapping, drop `preact-render-to-string`; update
  DEPENDENCIES.md rows.
- A-7 (S) token-lint: keep; prune now-redundant `{color}-{shade}` rules or leave; optionally add
  `zfb wind audit` to b4push; retire `check-package-safelist.mjs` with the safelist -> wind manifest move.
- A-8 (L, separate upstream epic, not blocking) zdtp: decide Preact bundling/dependency; later
  zudo-react/zudo-wind port; migrate zdtp `doc/` site to zudo-doc 6.

PART B — docs rewrite (bilingual rule: every EN change mirrored in docs-ja)
- B-1 (M) Styling reference trio: `reference/design-system`, `reference/color`, `reference/customizing`
  (+ `guides/dynamic-page-transitions` `@theme` samples) — EN+JA.
- B-2 (M) Component authoring: `reference/component-first`, `guides/custom-components`,
  `guides/development-workflow`, `reference/smart-break`, `reference/frontmatter-preview` — EN+JA;
  samples to `class`, `rawHtml`, `signal`, `getScope`.
- B-3 (S) Getting started: `getting-started/{introduction,installation,writing-docs}`,
  `components/basic-components` tech table — EN+JA.
- B-4 (M) Browser embedding: `guides/browser-embedding` recipe (after A-6) — EN+JA.
- B-5 (S) Wording sweep: ~25 pages "Preact island/component" -> neutral wording; `reference/component-tokens`,
  `reference/theme-packs`, `reference/design-token-panel` (zdtp peer + CSS import) — EN+JA.
- B-6 (S) Changelog + versioning: 6.0.0 entries EN+JA for zudo-doc/create-zudo-doc; decide whether to
  snapshot 5.x docs via `versions`.
- B-7 (M) Agent instructions: root CLAUDE.md Tech Stack/Commands, packages/zudo-doc/CLAUDE.md (six CSS
  artifacts, preact/compat GOTCHA), src/CLAUDE.md, TESTING.md (safelist check), e2e/CLAUDE.md,
  packages/zudo-doc/{README,API}.md (`@theme Design Tokens` section is a public-contract doc),
  README.md, DEPENDENCIES.md, `.claude/skills/zudo-doc-design-system` (+ its scaffold template copy),
  `l-lessons-zfb-migration-parity` (append v3 lessons), `test-flow-html-preview-hydration`,
  `l-update-generator`, `setup-zudo-doc-wisdom.sh` description.
- B-8 (S) Generator text: `claude-md-gen.ts` Tech Stack, `scaffold.ts` README EN+JA, template
  global.css/tsconfig comments (template-drift guard applies).
