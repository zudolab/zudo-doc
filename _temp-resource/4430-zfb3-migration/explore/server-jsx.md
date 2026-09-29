# server-jsx explorer: server-rendered component layer + JSX dialect / public API (zfb 2.22.1 -> 3.0.0)

Repo: $HOME/repos/myoss/zudo-doc @ main (337b9f110, zudo-doc 5.28.2). Upstream: zfb v3.0.0 (82193109).
All scratch artifacts: <planning-scratch>/explore/server-jsx/
(`$S` below). Nothing under $HOME/repos was modified.

## 0. How the file sets were built (MEASURED)

```
cd $HOME/repos/myoss/zudo-doc
git ls-files | grep -E '^(packages/zudo-doc/src|pages|src|packages/create-zudo-doc/templates)/' \
  | grep -v __tests__ | grep -E '\.(tsx|ts)$' > $S/all-files.txt            # 424 files (157 tsx)
# CLIENT set = files with a top-level "use client" directive  ∪  files calling hooks
grep -ln "^['\"]use client['\"]" $(cat $S/all-files.txt)  > use-client.txt  # 23
grep -lE "\buse(State|Effect|Ref|Memo|Callback|Context|LayoutEffect|Reducer|Id|ImperativeHandle)\s*[(<]" ... > hook-files.txt  # 24
sort -u use-client.txt hook-files.txt > client-files.txt                    # 28
# SERVER set = remaining .tsx (132) + 3 .ts files that import preact types
#   (chrome-bindings.ts, header/types.ts, mdx-components/index.ts)        -> server-set.txt = 135
```
Per-dir: packages/zudo-doc/src tsx=139 ts=240; pages tsx=11 ts=15; src tsx=4 ts=12; create-zudo-doc/templates tsx=3.

Caveat: 4 server-set files are only rendered inside islands (theme-pack-dialog/theme-pack-card.tsx) or shared with islands
(icons/index.tsx, smart-break/index.tsx, tree-nav-shared/index.tsx) — found by resolving relative imports of client files
(`$S/client-imports-tsx.txt`). Same JSX dialect applies, so they stay in this port.

AST scanner: `$S/scan.cjs` (TypeScript compiler API from the repo's node_modules, read-only). It embeds the exact
tag/attribute tables copied from zfb v3.0.0 `packages/zfb/src/zudo-react/render-html.ts`. Run:
`node $S/scan.cjs $S/server-set.txt $S/scan-server.json` (and client-files / all-files). Per-file table: `$S/per-file-server.tsv`,
per-dir table: `$S/per-dir.tsv`.

## 1. Headline counts (server set = 135 files, 657 intrinsic JSX elements)

| Construct | Server set | Island set (28) | Command |
|---|---|---|---|
| `className=` token (any use) | 68 | 293 | `xargs -d '\n' grep -ohE '\bclassName=' < $S/server-set.txt \| wc -l` |
| `className` on intrinsic JSX (AST) | 50 | 265 | scan.cjs `renames` |
| `class=` already HTML-spelled | 418 | 34 | `grep -ohE '(^\|[^-])\bclass='` |
| `htmlFor` | 0 | 2 | count.sh |
| `charSet` | 1 (doclayout meta) | 0 | scan.cjs |
| camelCase SVG attrs (strokeWidth etc.) | 0 | 26 | scan.cjs renames |
| `tabIndex` | 0 | 2 | scan.cjs |
| `dangerouslySetInnerHTML` code sites | 29 | 9 | `grep dangerouslySetInnerHTML \| grep -vcE '^\s*(//\|\*)'` -> total 38 |
| style object literals | 13 (8 server-only) | 22 | `grep -nE '\bstyle=\{'` |
| camelCase style keys | 8 AST + 3 `borderImage` behind `as JSX.CSSProperties` casts = 11 | 12 | scan.cjs + manual |
| React `onX={fn}` on server | 1 (theme-pack-card, island-rendered) | 92 | scan.cjs eventFnProps |
| lowercase string `on*` | 1 (`onload` via `as any` spread, head-with-defaults:370) | 0 | manual |
| JSX pragma `/** @jsxImportSource preact */` | 121 files | 23 files | `xargs grep -l '@jsxImportSource preact'` |
| files importing `preact`/`preact/*`/`react` | 127 / 135 | 28 | `xargs grep -lE "from ['\"](preact\|preact/[a-z-]+\|react)['\"]"` |
| type imports from preact (server) | JSX 91, VNode 43, ComponentChildren 26, ComponentType 2 | | grep+tr pipeline |
| `JSX.Element` | 163 (80 files) | 6 | count.sh |
| other `JSX.*` (IntrinsicElements[..] 15, CSSProperties 3, HTMLAttributes 2, MouseEventHandler 1) | 20 | | `grep -ohE '\bJSX\.[A-Za-z]+...' \| sort \| uniq -c` |
| `cloneElement` calls | 1 (code-syntax/tabs.tsx:123) | 0 | |
| `toChildArray` calls | 2 (tabs.tsx:79, mdx-components:256) | 0 | |
| `h()` calls | 3 (home-intro x2, auto-logo x1) | 0 | scan.cjs hCalls |
| `createElement` (preact) | 0 (all hits are `document.createElement` inside inline script strings) | 2 | |
| `isValidElement`, `createContext`, `useContext`, `createPortal` | 0 | createPortal 3 (theme-toggle) | |
| `Fragment` import | 1 (home-page `<Fragment key>`) | 0 | |
| `<>` shorthand | 58 | 12 | |
| hand-built `{type, props}` literals | 12 (all mdx-components/index.ts) | 0 | scan.cjs over all 424 files |
| `displayName` assignments | 23 across tree (3 in server set: doc-history-area, pages/lib/_body-end-islands, pages/lib/_preset-generator) | | scan.cjs over all-files |
| `Island({...})` plain calls / `ClientRouter(` | 31 in 15 files / 2 | | grep |
| `as unknown as VNode/JSX.Element` casts | 30 | | grep |
| nested async components | 0 (only pages/api/ai-chat.tsx default handler, a Response route) | 0 | scan.cjs asyncFns |
| `renderToString` of Preact in source | 0 (the 2 hits are katex.renderToString) | | |
| md-wasm `jsxRuntime` option | 0 (all 118/23 hits are `@jsxRuntime automatic` pragmas) | | `grep -rnE jsxRuntime ... \| grep -v '@jsxRuntime automatic'` |
| void elements with children | 0 | 0 | scan.cjs |
| data-* boolean shorthand | 47 | 9 | `$S/bool-data.cjs` — NOT a change: preact-render-to-string already emits `data-x="true"` (verified) |
| tests (packages/zudo-doc/src/**/__tests__) with preact pragma / import preact-render-to-string | 123 / 82 of 125 | | `git ls-files ... \| xargs grep -l ...` |

### Re-measurement of #3328 claims
- 38 raw-HTML insertion sites: CONFIRMED 38 (29 server + 9 island).
- "~272 className sites": re-measured 361 `className=` tokens in scope (68 server + 293 island); 315 on intrinsic elements (AST). Claim is stale/low.
- contract "13 literals, 2 child-array calls, 1 clone": measured 12 / 2 / 1.
- contract "21 displayName assignments": measured 23.
- contract "one link onload": confirmed (head-with-defaults async stylesheet).

## 2. dangerouslySetInnerHTML — every site (server set, 29)

| File:line | Element | Injects | v3 disposition |
|---|---|---|---|
| asset-components/asset-code.tsx:104 | div/pre | highlighted code excerpt HTML | rawHtml (static OK) |
| asset-index-page/body.tsx:190 | script | ASSET_INDEX_PAGE_SCRIPT controller | rawHtml static script |
| asset-page/body.tsx:125 | script | ASSET_DETAILS_PREPAINT_SCRIPT (pre-paint) | rawHtml |
| asset-page/body.tsx:211 | script | ASSET_PAGE_SCRIPT | rawHtml |
| asset-page/components.tsx:65 | pre.hi-root | build-time highlighted code | rawHtml |
| code-syntax/code-block-enhancer.tsx:39 | script | CODE_BLOCK_ENHANCER_SCRIPT | rawHtml |
| code-syntax/mermaid-init.tsx:79 | script | mermaid init (built string) | rawHtml |
| code-syntax/tabs-init.tsx:34 | script | TABS_INIT_SCRIPT | rawHtml |
| doc-body-end-islands/design-token-panel-island.tsx:50 | script | ZDTP_TOGGLE_SHIM_SRC | rawHtml |
| doclayout/doc-layout-with-defaults.tsx:437 | script | VERSION_SWITCHER_INIT_SCRIPT | rawHtml |
| footer/footer.tsx:162 | div | settings footer copyright HTML (config-supplied) | rawHtml |
| head-with-defaults/index.tsx:318 | script | SIDEBAR_RESIZER_RESTORE_SCRIPT | rawHtml |
| head-with-defaults/index.tsx:375 | noscript | `<link rel=stylesheet>` fallback for async CSS | rawHtml on static noscript: VERIFIED OK (not in island) |
| header/header.tsx:461 | script | NAV_OVERFLOW_SCRIPT | rawHtml |
| header/header.tsx:468 | script | LANGUAGE_SWITCHER_INIT_SCRIPT | rawHtml |
| header/header.tsx:477 | script | VERSION_SWITCHER_REWIRE_SCRIPT | rawHtml |
| header/header.tsx:846 | span/div | header-right `item.html` (config-supplied HTML) | rawHtml |
| math-block/index.tsx:77, :86 | div/span | KaTeX renderToString output | rawHtml |
| page-loading/page-loading-overlay.tsx:97 | script | buildPageLoadingOverlayBootstrap(id) | rawHtml |
| search-widget/index.tsx:211 | script | SEARCH_WIDGET_SCRIPT | rawHtml |
| sidebar-prepaint/index.tsx:101 | script | SIDEBAR_VISIBILITY_PREPAINT_SCRIPT | rawHtml |
| sidebar-resizer/sidebar-resizer-init.tsx:206, :244 | script | resizer init / restore | rawHtml |
| theme/color-scheme-provider.tsx:120 | style | generated color-scheme CSS | rawHtml (style: static only, no `</style`) |
| theme/color-scheme-provider.tsx:121 | script | theme bootstrap (prepaint) | rawHtml |
| theme/theme-pack-provider.tsx:328 | style | THEME_PACK_LATCH_CSS | rawHtml |
| theme/theme-pack-provider.tsx:329 | script | theme-pack bootstrap | rawHtml |
| toc-prepaint/index.tsx:107 | script | TOC_VISIBILITY_PREPAINT_SCRIPT | rawHtml |

Tag totals (AST): script=20, div=3, span=2, style=2, pre=1, noscript=1. No JSON-LD (`grep -rn 'ld+json'` = 0).
`</script`/`</style` inside payload constants: 0 in server set (only in html-preview.tsx srcdoc strings, island side).
Island-side sites (9): ai-chat-modal:47 (markdown), highlighted-code:62, mermaid-enlarge:308 (svg), sidebar-tree-island x6 (smartBreakToHtml labels).

## 3. Empirical probe of published @takazudo/zfb@3.0.0 renderer (MEASURED)

`npm pack @takazudo/zfb@3.0.0` into `$S/pkg`, then `node $S/pkg/probe.mjs` (output: `$S/probe-output.txt`).

FAIL (runtime throws, page render fails):
- `meta.property` (og:*) -> ZR_ATTRIBUTE — used 9x (head/og-tags.tsx x6, head-with-defaults x3); showcase sets `ogImage` so EVERY page fails.
- `link.as` (preload) -> ZR_ATTRIBUTE — head/doc-head.tsx:108, head-with-defaults:345 (public `settings.head.preload`).
- `svg.xmlns` -> ZR_ATTRIBUTE — 33 server (icons 16, metainfo 3, search-widget 3, header 2, ...) + 8 island.
- `svg.focusable` -> ZR_ATTRIBUTE — mdx-components ENLARGE_SVG literal + 5 island.
- `path.stroke-dasharray` -> ZR_ATTRIBUTE (not used in zudo-doc; common in icon sets).
- `ol.start` -> ZR_ATTRIBUTE — BUT zfb's own MDX emitter emits `<_components.ol start={N}>` (crates/zfb-content/src/mdx_jsx_emit.rs:1233, :2272). Heuristic count of non-1-start lists in zudo-doc content = 0 (awk over src/content), so latent for zudo-doc.
- `th.align` -> ZR_ATTRIBUTE — home-intro/prepare.ts:58 whitelists `align`/`start` and maps class->className (line 70).
- `video.preload` -> ZR_ATTRIBUTE — asset-page/components.tsx:99.
- `a.download={true}` -> "requires a string" (3 sites: asset-card:94, asset-page/components:46,:120); `download=""` OK.
- `input.spellcheck={false}` -> "requires a string" (search-widget:139).
- `script.async`, `div.popover` (theme-toggle island), `iframe.srcdoc` (html-preview island), `img.fetchpriority`, `link.hreflang`, `meta.itemprop`, `input.inputmode`, `script.integrity`/`nonce` (doc-head.tsx:91 conditional `integrity` from public head.stylesheets), `dialog.closedby` -> ZR_ATTRIBUTE.
- tags `search`, `hgroup`, `menu` -> ZR_TAG.
- style key `borderImage` -> ZR_STYLE (expected); style key `-webkit-mask` -> ZR_STYLE (vendor prefix rejected by `/^(--[a-zA-Z0-9_-]+|[a-z][a-z0-9-]*)$/`); home-page/index.tsx:326 uses `WebkitMask`.
- `className` -> ZR_PROP_DIALECT; unbranded `{type,props,key,constructor}` child -> ZR_CHILD.
- `tbody > <Component/>` and `tbody > <Fragment>` -> ZR_PARSER_CONTEXT even in STATIC (non-island) render; `table > tr` without tbody -> ZR_PARSER_CONTEXT. zudo-doc server tables all map intrinsic `<tr>` (frontmatter-preview.tsx:152, versions-page-content.tsx:92) -> OK; MDX GFM tables emit explicit thead/tbody via `_components.*` intrinsic strings -> OK as long as nobody maps `tr`/`td` to components (zudo-doc doesn't).
- nested async component -> ZR_ASYNC_COMPONENT (zudo-doc has none).
- custom element boolean attr -> requires string.
OK: static noscript rawHtml, script rawHtml, `link onload="..."` string, `html style="--x"`, `data-x={true}` -> `data-x="true"` (same as Preact 10 today — verified with preact-render-to-string), `aria-*`, `tabindex=-1`, render-region `<template>`, `button hidden`, `details name`, arrays of `tr` in tbody.

Type probe (`$S/pkg/types-probe.tsx`, tsc with jsxImportSource `@takazudo/zfb/zudo-react`; output `$S/types-probe-output.txt`):
type errors for meta.property, link.as, svg.xmlns, ol.start, className (expected), AND style keys `mask`, `cursor`, `inset`
(valid single-word CSS properties the runtime accepts), while `"-webkit-mask"` TYPE-CHECKS but FAILS at runtime -> the two
validators disagree (contract ZR03 says both must share one finite table). `import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime"` works.

## 4. MDX -> JSX pipeline and document rendering (MEASURED from source)

- zudo-doc never compiles MDX itself: zfb (Rust, crates/zfb-content/src/mdx_jsx_emit.rs) compiles MDX to a JSX module whose
  `MDXContent({components})` merges `_components` with caller overrides. v3 emitter: Fragment from
  `@takazudo/zfb/zudo-react/jsx-runtime` (line 610), hast attrs renamed className->class, htmlFor->for, charSet->charset,
  dateTime, tabIndex, readOnly, strokeWidth (render_hast_attrs ~1736-1765), style emitted as CSS strings, HTML literals and
  syntect-highlighted fences embedded via `<span|div rawHtml={...}/>` (tests/mdx_jsx_emit_hast.rs:120-124). Authored JSX is NOT rewritten.
- Consequence for zudo-doc content components: MDX now passes `class` (not `className`) to `_components.h2/p/a/ul/ol/code/...`.
  content/*.tsx destructure `className` (11 files, 15 attr sites) and ContentCode detects `language-` via className (content-code.tsx:30-32) -> must read `class`.
  ContentCode/ContentLink `extractText()` unwrap an Astro-era `props.value` StaticHtml wrapper — likely dead; verify on a real v3 build.
- Authored `className=` in src/content/**/*.mdx: 38 tokens in 6 files, ALL inside code fences (awk fence-aware count = 0 live).
- Component map: package-owned `createMdxComponents()` (mdx-components/index.ts) = defaultComponents (h2..h4,p,a,ul,ol,blockquote,strong,table,code)
  + `a` (manifest link) + `img` (base rewrite, returns an UNBRANDED literal) + `p` (EnlargeableParagraph: toChildArray + `vnode.type === ContentImg`
  introspection + unbranded figure/button/svg/figcaption literals) + admonitions (Note..Caution) + CodeGroup/Tabs/TabItem/MathBlock +
  host navData wrappers (CategoryNav/CategoryTreeNav/SiteTreeNav/SiteTreeNavDemo/NoteTrayIndex, plain-called with `lang`) + host `extras`
  (showcase: Details, SmartBreak stub, Island pass-through `IslandWrapper`, PresetGenerator SSR shell, Avatar/Button/Card/... stubs).
- Document render: pages (`pages/docs/[[...slug]].tsx` etc.) call `createChrome(routeCtx, chromeBindings).renderDocPage()` -> doc-page-renderer
  -> `<ContentComponent components={createMdxComponents(...)}/>` -> DocLayout renders `<html><head>..</head><body>` itself
  (doclayout/doc-layout.tsx:321). zfb's page router owns renderToString (v3 contract ZR21: router imports owned server renderToString,
  keeps async top-level page functions and string/Response passthrough — sitemap.xml.tsx/robots.txt.tsx return strings, api route returns Response).
  Static render emits no doctype (zfb shell's job) and no markers outside islands.
- md-wasm usage in zudo-doc: home-intro/prepare.ts (`parseToAst` + `renderHtml` with `dialect: "markdown"`, no jsxRuntime),
  html-preview highlight-runtime + plugins/routes.ts (`/highlight` subpath). `jsxRuntime` removal: no zudo-doc source change.
- Config: packages/zudo-doc/src/config.ts:911-913 hard-codes `framework: "preact"` and `tailwind: { enabled: true }` inside zudoDoc() ->
  both are hard config errors in v3 (migrating-to-v3.mdx). preset.ts:373 JSDoc example also shows framework.

## 5. Public API surface exposing Preact (breaking -> zudo-doc major)

- package.json: 176 export subpaths, 164 typed. Entry .d.ts importing preact directly: 67; preact in .d.ts import closure: 91
  (node script over dist/, `$S/exports-preact.tsv`). dist: 123/379 .d.ts import preact; .d.ts type refs JSX.Element 161, VNode 115,
  ComponentChildren 73, JSX.IntrinsicElements 11. dist JS: 128 files import `preact/jsx-runtime`, 16 `preact/hooks`, 9 `preact/compat`, 5 `preact`.
- peerDependencies: `preact ^10.29.1`, `@takazudo/zfb ^2.22.1`, zfb-md-wasm/zfb-runtime ^2.22.1, `@takazudo/zdtp` (zdtp 0.8.5 latest has peer preact ^10.29.1).
- `./tsconfig.base.json` (exported, consumers extend it) sets `jsxImportSource: "preact"`.
- ChromeBindingsInput / defineChromeBindings (chrome-bindings.ts): slot callables return `unknown` (portable), but
  BreadcrumbSlotProps.rightSlot: ComponentChildren; host components are Preact components -> must become zudo-react components.
  Six primary keys Header, Footer, Sidebar, Toc, Breadcrumb, DocPager + SearchWidget, headerRightComponents (HeaderRightComponentRegistry in
  header/types.ts: `(props) => ComponentChildren`, and HeaderRightComponentProps fields themeToggle/languageSwitcher/versionSwitcher/search: ComponentChildren),
  BodyEndIslands, DocHistory, DesignTokenPanelBootstrap, frontmatterRenderers, mdxExtras, docContentHeaderExtras, homeExtras.
- factory-context/index.ts: `FactoryComponent = (props: Record<string, unknown>) => unknown`, `Island?: FactoryComponent` pass-through.
- metainfo: `FrontmatterCellRenderer = (props) => ComponentChildren` (public; showcase src/config/frontmatter-preview-renderers.tsx imports `ReactNode` from "react" via tsconfig paths alias and uses className).
- mdx-components: `createMdxComponents` returns Record<string, unknown>; host `extras` components must be zudo-react.
- home-intro/prepare (public `./home-intro/prepare`): `IntroNode.attrs` emits `className` key + `start`/`align` -> data contract change.
- theme-pack-switcher: `ThemePackDialogComponent = (props) => JSX.Element | null` (public injection point).
- content/* components typed with `JSX.IntrinsicElements["a"|"p"|...]` (zudo-react JSX namespace exposes no per-element prop types; only Element/ElementType/IntrinsicElements/...).

## 6. Classification of every non-island construct

MECHANICAL (sed/codemod-able):
1. Remove `/** @jsxRuntime automatic */` + `/** @jsxImportSource preact */` pragmas (121 server files; + 23 island files; + 123 tests) and flip
   packages/zudo-doc/tsconfig.base.json + root tsconfig (drop `react`/`react-dom` paths alias) + templates/base/tsconfig.json.
2. Type imports: `JSX` -> `@takazudo/zfb/zudo-react/jsx-runtime`; `ComponentChildren` -> `Child`; `VNode` -> `Description` (or JSX.Element when it is a return type);
   `ComponentType<P>` -> `Component<P>`; `Fragment`/`h` -> `@takazudo/zfb/zudo-react`.
3. `className=` -> `class=` on intrinsic (50) and the component-prop API names (≈18 more `className=` on components; asset-components shared icons, SlotWrapper, home-intro).
4. `charSet` -> `charset` (1). `dangerouslySetInnerHTML={{__html: x}}` -> `rawHtml={x}` (29).
5. camel style keys -> CSS spelling: content-ol/ul (paddingLeft, listStyleType), heading-h2/h3/h4 (`borderImage`, drop `as JSX.CSSProperties`).
6. `download` bare -> `download=""` (3); `spellcheck={false}` -> `spellcheck="false"` (1).
7. Delete `xmlns` on inline `<svg>` (33 server; harmless in HTML) and `focusable` (mdx-components literal).
8. Drop the 30 `as unknown as VNode` casts around `Island()`/`ClientRouter()` (v3 `Island` returns `Description`).
9. `onload` string spread with `as any` (head-with-defaults:370) -> typed `onload="..."` (now first-class).

NEEDS REWRITE (authored logic change, small):
- mdx-components/index.ts: 12 unbranded literals (ContentImg return, ENLARGE_SVG tree, enlarge button, figcaption spans/link, figure) -> JSX or `h()`;
  EnlargeableParagraph: `toChildArray` -> `flattenChildren`, `(vnode.type === ContentImg)` works on branded descriptions (`isDescription`).
- code-syntax/tabs.tsx: toChildArray + cloneElement(node, {default}) -> `flattenChildren` + `{...node, props: {...node.props, default}}` (ZR08 allows copying) or `h(TabItem, {...})`.
- code-group/index.tsx: manual `Array.isArray(children)` flatten -> flattenChildren.
- home-intro/index.tsx: `h` from zudo-react; drop `className` alias; prepare.ts: emit `class`, convert `align` to `style="text-align:..."`, drop/handle `start`.
- content/*.tsx: accept `class` (MDX v3 passes class), replace `JSX.IntrinsicElements[...]` prop types with local interfaces; content-code language detection.
- home-page/index.tsx:326 `WebkitMask` -> style STRING (object key `-webkit-mask` is rejected at runtime).
- doclayout: `JSX.HTMLAttributes<HTMLHtmlElement>` building html attrs -> plain record; `<meta charSet>`.
- theme-pack-card.tsx (island-rendered): onClick -> on:click, camel style keys, className.
- displayName: doc-history-area:135, pages/lib/_body-end-islands.tsx:50, pages/lib/_preset-generator.tsx:32 must equal scanner marker (island identity).

UNSUPPORTED IN v1 (upstream fix or authored workaround):
- `<meta property="og:*">` (9) — NO authored workaround inside `<head>`; BLOCKER for every showcase page (ogImage set). Upstream.
- `<link rel="preload" as>` (2) and `<link integrity>` (1) — public head settings; no workaround. Upstream.
- `<video preload>` (1) — workaround: drop attribute. `ol start` from MDX emitter — latent upstream bug. `th align` — workaround in prepare.ts.
- Island-side (for the islands explorer): `popover` (theme-toggle), `srcdoc` (html-preview), `createPortal`.

## 7. Proposed sub-task grouping (server layer; each <= ~20 agent tool calls)

Pre-req F0 (S): flip JSX source: packages/zudo-doc/tsconfig.base.json, root tsconfig.json (drop react alias paths), package.json peers
(zfb ^3, drop preact peer), tsup jsx settings, bulk pragma strip (sed over 144 files), add an internal `jsx-types` re-export shim if wanted.
config.ts: remove `framework`, replace `tailwind` (coordinate with wind explorer). After F0 the tree is red; each group below greens its dirs
(`pnpm check 2>&1 | grep '<dir>/'`).

| ID | Dirs (files / lines) | Main work | Size |
|---|---|---|---|
| S1 content+MDX | content/ (11/466), content-admonition, mdx-components (1/484), code-group, code-syntax (4/316), tab-item, math-block, details, smart-break, home-intro (+prepare.ts) | class prop, literals->h(), flattenChildren, Tabs clone, JSX.IntrinsicElements types, borderImage/list styles | L |
| S2 head+document shell | head/ (3/214), head-with-defaults (415), doclayout (2/921), theme/ providers (3/497), page-loading, sidebar-prepaint, toc-prepaint, sidebar-resizer | rawHtml (≈14 sites), charset, onload typed, WebKit n/a; BLOCKED on upstream meta.property / link.as | M (+blocker) |
| S3 header/footer chrome | header/ (2/1038), header-with-defaults (349), footer/, footer-with-defaults, i18n-version (3/1049), inline-version-switcher, breadcrumb, body-foot-util, search-widget, icons (408), auto-logo | xmlns removal (≈30), rawHtml (6), spellcheck, h(), public HeaderRightComponentRegistry types | M |
| S4 nav indexing & trees | nav-indexing (13/1409), category-nav, category-tree-nav, site-tree-nav, tree-nav-shared, note-tray-index, versions-page, tag-pages, doc-tags-area | mostly pragma/type swap; xmlns x3; tbody intrinsic OK | M |
| S5 doc-page composition | chrome/ (3/1038), doc-page-shell (446), doc-page-renderer (382), doc-content-header, doc-metainfo-area, metainfo/ (3/463), doc-pager, doc-history-area, doc-body-end, doc-body-end-islands (3/445), sidebar-with-defaults | 30 `as unknown as VNode` casts around Island(), FrontmatterCellRenderer type, displayName | L (couple with islands explorer) |
| S6 asset + home pages | asset-components (3/369), asset-page (3/529), asset-index-page (2/253), home-page (441) | 20 className, download="", video preload, -webkit-mask string, rawHtml x5, Fragment import | M |
| S7 routes + public types | routes/ (19/899), chrome-bindings.ts, header/types.ts, factory-context, theme-pack-switcher public type, API.md | Child/Description in public types; exports audit (67 direct preact d.ts) | M |
| S8 host showcase + templates | pages/** (11 tsx), src/chrome-bindings.tsx, src/config/frontmatter-preview-renderers.tsx (ReactNode->Child), create-zudo-doc templates (3 tsx + tsconfig.json paths) + scaffold.ts deps | pragmas, types, className | S |
| S9 server tests | 125 test tsx: 123 pragma, 82 preact-render-to-string | shared render helper on `@takazudo/zfb/zudo-react/server` renderToString; split per S1–S7 | XL (split) |
| S10 renderer smoke | new test: render every package server component through zudo-react renderToString with representative settings (catches ZR_ATTRIBUTE/ZR_PARSER_CONTEXT that tsc may miss via spreads: 42 spreads onto intrinsics) | M |
