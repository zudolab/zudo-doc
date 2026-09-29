# islands-content — zfb v3 (zudo-react) port map for CONTENT/FEATURE islands

Scope: zudo-doc main @ 337b9f110 (zudo-doc 5.28.2, zfb 2.22.1). Reference: zfb tag v3.0.0 (read with `git -C $HOME/repos/myoss/zfb show v3.0.0:<path>`).
Scratch artifacts: `explore/islands-content/measure.py` (per-file metric script), `measure-out.txt` (raw output), `zr-contract.md`, `zw-spec.md` (copies of the v3 specs).

Labels: **MEASURED** = command shown; **INFERRED** = reasoning from read code/spec; **UNVERIFIED** = not executed.

---

## 1. Inventory — what is (and is not) an island in this area

MEASURED: `Island({...})` call sites + child component, repo-wide, via a python scan of `packages/zudo-doc/src/**/*.tsx pages/**/*.tsx src/**/*.tsx` (non-test) for `\bIsland\(\{` and `children:\s*<X`.

Hydrated islands owned by this area (8 distinct components):

| # | Component (marker) | Defined in | Island call site(s) | `when` | SSR mode |
|---|---|---|---|---|---|
| 1 | `HtmlPreviewWrapperInner` | packages/zudo-doc/src/html-preview-wrapper/html-preview-wrapper.tsx | same file L350 (loading="visible"), L358 (eager) | visible | eager: full SSR + hydrate; visible: skip-SSR w/ reservation fallback |
| 2 | `ImageEnlarge` | image-enlarge/index.tsx | doc-body-end-islands/index.tsx L236; pages/lib/_body-end-islands.tsx L154 | idle | skip-SSR, fallback = closed `<dialog>` shell |
| 3 | `MermaidEnlarge` | mermaid-enlarge/index.tsx | doc-body-end-islands/index.tsx L247; pages/lib/_body-end-islands.tsx L168 | idle | skip-SSR, fallback = closed `<dialog>` shell |
| 4 | `AiChatModal` | ai-chat-modal/index.tsx | doc-body-end-islands/index.tsx L223; pages/lib/_body-end-islands.tsx L135 | load (default) | skip-SSR, fallback `<p class="sr-only">` |
| 5 | `DocHistory` | doc-history/index.tsx | doc-history-area/index.tsx L227 (component injected via deps; host imports it in src/chrome-bindings.tsx) | idle | skip-SSR, fallback sr-only Created/Updated/Author |
| 6 | `DesignTokenPanelBootstrap` | design-token-panel-bootstrap.tsx L854 | doc-body-end-islands/design-token-panel-island.tsx L52 (component via deps) | load | hydrate, renders `null` both sides |
| 7 | `ConfiguredDesignTokenPanelBootstrap` | routes/_design-token-panel-bootstrap.tsx | same factory as #6 via `hostBindings.DesignTokenPanelBootstrap` | load | hydrate, renders `null` |
| 8 | `PresetGenerator` (default export) | src/components/preset-generator.tsx | pages/lib/_preset-generator.tsx L77 | load | skip-SSR, fallback = 9 `<HeadingH3>` section headings |

SSR-only (no hydration) components in this area — still need the JSX dialect port:
SearchWidget (+ `<site-search>` custom element + inline IIFE script), CodeGroup, TabItem, code-syntax/tabs.tsx (Tabs — paired with TabItem/CodeGroup), Details, MathBlock (KaTeX), BodyFootUtilArea, EditLink, NoteTrayIndex wrapper, DocBodyEnd, createBodyEndIslands, createDesignTokenPanelIsland, createDocHistoryArea, host stubs pages/lib/_search-widget.tsx, _details.tsx, _body-end-islands.tsx, _preset-generator.tsx, src/chrome-bindings.tsx (MDX `Island` passthrough), page-loading overlay (mounted here; inline script).

Pure logic, no framework change needed: search-widget-script/* (generated IIFE string), note-tray-model, design-token-panel-config/* (no JSX), src/lib/preset-generator-logic.ts, html-preview-wrapper/{preview-auto-height,highlight-runtime,dedent,preflight}.ts.

Shared dependency this area needs first: `use-modal-dialog/index.ts` (`useModalDialog`, public export `@takazudo/zudo-doc/use-modal-dialog`). MEASURED 6 call sites:
`find packages/zudo-doc/src pages src -name '*.ts*' -not -path '*/__tests__/*' -print0 | xargs -0 grep -n "useModalDialog("` → theme-pack-dialog (islands-nav), doc-history, image-enlarge, mermaid-enlarge, ai-chat-modal, preset-generator.
Also used inside islands: smart-break (SmartBreak), icons (History/Close/ArrowLeft with `className` prop + `xmlns`), render-markdown, island-types (dialog class/style constants), transitions (event names).

Other hydrated islands found (NOT this area → islands-nav): ClientRouterBootstrap, DesktopSidebarToggle, DesktopTocToggle, FindInPageInit, MobileToc, Sidebar/SidebarInner, SidebarToggle, SidebarTree, SiteTreeNav, ThemePackSwitcher, ThemeToggle/ThemeToggleBare, Toc.

---

## 2. Per-file metrics (MEASURED)

Command: `python3 <planning-scratch>/explore/islands-content/measure.py` (comments stripped before counting; hook regex `\buseX\b\s*[<(]`).

| file | lines | useState | useEffect | useRef | useMemo | useCallback | memo | useModalDialog | className= | class= | dSIH | onX= | camel SVG/HTML | focusable | xmlns | key= | .map( | ref= | import() | fetch | addEventListener | observers | iframe | displayName= | Island( | style={{ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| html-preview-wrapper.tsx | 364 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 (IO) | 0 | 1 | 2 | 1 |
| html-preview.tsx | 402 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| preview-base.tsx | 256 | 3 | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 13 | 0 | 2 | 1 (srcDoc) | 0 | 0 | 2 | 2 | 1 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 2 |
| highlighted-code.tsx | 66 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| highlight-runtime.ts | 120 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| image-enlarge/index.tsx | 220 | 1 | 2 | 0 | 0 | 0 | 0 | 1 | 5 | 0 | 0 | 2 | 1 (srcSet) | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 4 | 2 (RO, MO) | 0 | 1 | 0 | 0 |
| mermaid-enlarge/index.tsx | 369 | 4 | 3 | 2 | 0 | 9 | 0 | 1 | 9 | 0 | 1 | 10 | 8 | 5 | 0 | 0 | 0 | 2 | 0 | 0 | 2 | 2 (MO×2) | 0 | 1 | 0 | 1 |
| doc-history/index.tsx | 683 | 9 | 2 | 1 | 1 | 2 | 0 | 1 | 48 | 0 | 0 | 8 | 0 | 0 | 0 | 3 | 2 | 1 | 1 (`diff`) | 1 | 0 | 0 | 0 | 1 | 0 | 5 |
| ai-chat-modal/index.tsx | 275 | 5 | 3 | 2 | 0 | 2 | 1 | 1 | 19 | 0 | 1 | 5 | 6 | 0 | 2 | 1 | 1 | 3 | 0 | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| design-token-panel-bootstrap.tsx | 859 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 (zdtp-loader) | 0 | 7 | 0 | 0 | 1 | 0 | 0 |
| routes/_design-token-panel-bootstrap.tsx | 64 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| use-modal-dialog/index.ts | 195 | 0 | 3 | 2 | 0 | 0 | 0 | def | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| src/components/preset-generator.tsx | 851 | 4 | 1 | 1 | 3 | 5 | 0 | 1 | 81 | 0 | 0 | 36 | 2 (htmlFor) | 0 | 0 | 7 | 10 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| doc-history-area/index.tsx | 281 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 |
| doc-body-end-islands/index.tsx | 298 | — | — | — | — | — | — | — | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 |
| doc-body-end-islands/design-token-panel-island.tsx | 63 | — | — | — | — | — | — | — | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| body-foot-util-area.tsx / edit-link.tsx | 113/75 | — | — | — | — | — | — | — | 0 | 5/2 | 0 | 0 | 0 | 0 | 1/1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| search-widget/index.tsx | 215 | — | — | — | — | — | — | — | 0 | 13 | 1 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| code-group / tab-item / code-syntax/tabs / details / math-block | 79/71/156/35/90 | — | — | — | — | — | — | — | 0 | 1/1/4/3/2 | 0/0/0/0/2 | 0 | 0 | 0 | 0 | 1/0/1/0/0 | 2/0/3/0/0 | 0 | 0/0/0/0/2 (katex) | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| pages/lib/_preset-generator.tsx / _body-end-islands.tsx | 83/190 | — | — | — | — | — | — | — | 0 | 1/2 | 0 | 0 | 0 | 0 | 0 | 1/0 | 1/0 | 0 | 0 | 0 | 0 | 0 | 0 | 1/1 | 1/4 | 0 |
| **TOTAL (35 files)** | 8164 | **28** | **18** | **12** | **6** | **18** | **1** | 6 | **162** | 53 | **7** | **63** | 18 | **6** | **7** | 16 | 36 | 10 | 7 | 2 | 18 | 5 | 1 | 10 | 13 | 10 |

Repo-wide cross-checks of the #3328 claims (MEASURED):
- dangerouslySetInnerHTML JSX sites: `find packages/zudo-doc/src pages src -name '*.tsx' -not -path '*/__tests__/*' -print0 | xargs -0 grep -nE 'dangerouslySetInnerHTML=\{' | wc -l` → **38** (matches claim).
- `className=` occurrences: `… | xargs -0 grep -oE '\bclassName=' | wc -l` → **361** (claim ~272; mine also counts component props such as `<History className>`/`<HeadingH3 className>`).
- files carrying the per-file `/** @jsxImportSource preact */` pragma: `find packages pages src e2e -path '*/node_modules' -prune -o \( -name '*.tsx' -o -name '*.ts' \) -not -path '*/dist/*' -print0 | xargs -0 grep -l "@jsxImportSource preact" | wc -l` → **375** (31 of the 40 files in this area). esbuild honours per-file pragmas, so a tsconfig-only switch is not enough.

---

## 3. Effects classification (MEASURED by the same script; 18 useEffect in area)

| file:line | deps | class | cleanup | zudo-react target |
|---|---|---|---|---|
| html-preview-wrapper.tsx:217 | [deferUntilVisible, shouldRenderPreview] | rerun | yes (IO disconnect) | **delete** — v3 skip-SSR roots honour `data-when` (ZR20, hydration.mdx L71), so the private `__zudoDocVisibleMount` prop + in-component IntersectionObserver gate are obsolete |
| preview-base.tsx:124 | [autoHeightEnabled, srcdoc, syncDelay] | rerun | yes | `onActivate` (props are static per instance) |
| preview-base.tsx:156 | [activeViewport, autoHeightEnabled] | rerun | no | `scope.effect` reading `activeViewport` signal |
| highlighted-code.tsx:38 | [code, language] | rerun | yes | `onActivate` (code/language static per instance) |
| image-enlarge:38 | [] | mount-only | yes | `onActivate` |
| image-enlarge:134 | [] | mount-only | yes | `onActivate` |
| mermaid-enlarge:82 | [] | mount-only | yes | `onActivate` |
| mermaid-enlarge:154 | [] | mount-only | yes | `onActivate` |
| mermaid-enlarge:172 | [open] | rerun | yes | `scope.effect` on `open` |
| doc-history:214 | [older.hash, newer.hash] | rerun | yes | `onActivate` inside keyed DiffViewer instance |
| doc-history:549 | [view] | rerun | yes | `scope.effect` (body overflow lock) |
| ai-chat-modal:80 | [dialogRef] | rerun (effectively mount) | yes | `onActivate` |
| ai-chat-modal:94 | [isOpen] | rerun | no | `scope.effect` (focus input) |
| ai-chat-modal:100 | [messages, loading] | rerun | no | `scope.effect` (scrollIntoView) |
| use-modal-dialog:112 | [isOpen, manageFocus, restoreFocusOnly, returnFocusRef] | rerun | no | `scope.effect` on isOpen signal |
| use-modal-dialog:143 | [isOpen, onClose, …] | rerun | yes | `onActivate` close listener reading signal inside |
| use-modal-dialog:167 | [navigateEvent, onClose] | rerun (effectively mount) | yes | `onActivate` |
| preset-generator:122 | [] | mount-only | yes (timer) | `onCleanup` |

Totals: **5 mount-only / 13 rerun; 13 with cleanup / 5 without** (claim for whole repo: 31 of 52 rerun). After port, several "rerun" effects collapse to `onActivate` because their deps are per-instance props.

---

## 4. Per-island port rows

### 4.1 HtmlPreview (HtmlPreviewWrapper → HtmlPreviewWrapperInner → HtmlPreview → PreviewBase → HighlightedCode) — **XL (blocked)**
- Island: `when="visible"`; eager = SSR + hydrate; `loading="visible"` = skip-SSR + reservation fallback. Content usage MEASURED: `grep -rF "<HtmlPreview" src/content | wc -l` → 49 occurrences / 8 files; `loading="visible"` → 10 / 4 files.
- Props JSON-serializable: yes (html/css/head/js strings, labels object, globalConfig `settings.htmlPreview ?? null`, height number, booleans, string arrays). RISK: any optional prop explicitly `undefined` (e.g. `globalConfig` fields, `lang`) → `ZR_PROPS_UNDEFINED` (see §6.5).
- Hooks: useState 5, useEffect 4, useRef 4, useMemo 2. Effects: see §3.
- Listeners/observers: iframe `load`; iframe-realm ResizeObserver; rAF + setTimeout (preview-auto-height.ts, framework-free, reusable as-is); IntersectionObserver (delete).
- Show/For: Show(codeOpen) for the code panel; Show(highlighted html) in HighlightedCode (or reactive `rawHtml`). Viewport buttons: static array mapped at setup with computed `class`/`aria-pressed` — no For. `title`/`showSource`/`showViewportControls` are static props → plain JS conditionals.
- Forms: none (buttons only).
- Refs: iframeRef, reservationRef.
- Raw HTML: highlighted-code.tsx:62 — zfb semantic highlight markup (`pre.hi-root`) from `@takazudo/zfb-md-wasm/highlight` → reactive `rawHtml`.
- **BLOCKER A:** `<iframe>` is rejected anywhere inside an island subtree: server `render-html.ts` `sensitive = words("noscript xmp iframe noembed noframes plaintext")` + `if (context.identity && (tag === "template" || sensitive.has(tag))) fail("ZR_PARSER_CONTEXT", …)`; client `hydrate.ts` L25 + `validatePosition()` L274-276 (`ZR_UNSUPPORTED_POSITION`), used by both `hydrate` and `mount` (element() L294). So neither eager nor skip-SSR mode can render the preview iframe as JSX.
- **BLOCKER B:** `srcdoc` is not in the HTML attribute table (render-html.ts L20-22; hydrate.ts L65-67) → `ZR_ATTRIBUTE` even in static (non-island) SSR. Only `sandbox`/`allow`/`allowfullscreen`/`loading`/`src` exist.
- Workaround if upstream does not change: emit the iframe as `rawHtml` markup (`<div rawHtml={'<iframe srcdoc="…escaped…" sandbox=… title=…>'}>`) and drive height via `ref.current.querySelector('iframe')`; rawHtml regions are opaque on hydration (contract "Trusted raw HTML"), and scripts inside an iframe srcdoc document still execute (inertness applies to scripts inserted into the parent document). INFERRED, UNVERIFIED.
- Other dialect fixes: `srcDoc`→`srcdoc`, `onClick`→`on:click`, numeric `style={{height: n}}` must become `"${n}px"` (v3 emits numbers verbatim, no implicit px — contract ZR03), reservation `style={{height: reservationHeight(height)}}` same.
- Dynamic import: `import("@takazudo/zfb-md-wasm/highlight")` — subpath still exported in 3.0.0 (`npm view @takazudo/zfb-md-wasm@3.0.0 exports` shows `./highlight` with browser/workerd conditions) and `git diff v2.22.1 v3.0.0 --stat -- crates/zfb-md-wasm/npm/src/` touches only the `jsxRuntime` removal (index/render/types) — highlight API unchanged.
- Utility classes: arbitrary values `min-h-[44px]`, `min-w-[44px]`, `bg-[#fff]`, `transition-[background,color,border-color]`, `hover:bg-[color-mix(in_srgb,…)]`, `shadow-[0_1px_3px_color-mix(…)]`, `rotate-90` — all adopt-changed/supported in V1 (W12, catalog rows 35/39); none rejected.
- Tests: MEASURED `cat html-preview-wrapper/__tests__/* | wc -l` → 1925 lines / 12 files using `preact`, `preact-render-to-string`, `preact/test-utils`.

### 4.2 ImageEnlarge — **M**
- Island idle, skip-SSR (dialog shell fallback). Props: none.
- Hooks: useState 1, useEffect 2 (both mount-only w/ cleanup), useModalDialog.
- Global: window `resize`, document `click` (delegated), document AFTER_NAVIGATE, per-img `load` (AbortController); ResizeObserver + MutationObserver on `main .zd-content`. All → `onActivate` with cleanup; framework-independent DOM scanning code survives unchanged.
- Show: 1 (dialog body when imgData).
- Dialect: `className`×5→`class`, `srcSet`→`srcset`, `focusable="false"` on svg (**unsupported attribute**, §6.3), `onClick`×2.
- Classes: `max-h-[85vh]`, `max-w-[85vw]`, `object-contain`, dialog constant uses `backdrop:z-modal-backdrop` (backdrop pseudo supported W05) — no V1 rejections. `ENLARGE_DIALOG_STYLE = {position, inset, margin}` is valid CSS-spelled but `inset` is a **TS type error** in v3 `CssProperty` (§6.4).

### 4.3 MermaidEnlarge — **M/L**
- Island idle, skip-SSR (dialog shell). Props none.
- Hooks: useState 4, useEffect 3 (2 mount-only, 1 rerun on `open`), useRef 2, useCallback 9, useModalDialog. All useCallback disappear (setup-once).
- Global: document click, AFTER_NAVIGATE, MutationObserver on content scope (attributeFilter data-mermaid-rendered), per-open MutationObserver on container. Imperative `btn.innerHTML = <svg…>` button injection (DOM API; unchanged).
- Show: 1 (dialog content). Reactive: scale/translate/panActive signals → whole `style` reactive string `transform:translate(..) scale(..);transform-origin:center` (camelCase `transformOrigin` must become CSS spelling); `disabled`, `aria-pressed`, `data-pan-active` reactive attrs.
- Raw HTML: mermaid-enlarge:308 cloned diagram `svg.outerHTML` → reactive `rawHtml` on a `div` (allowed; rawHtml only rejected when the parent is SVG).
- Dialect: pointer/key handlers `onPointerDown/Move/Up/Cancel/onKeyDown` → `on:pointerdown` …; `tabIndex={0}`→`tabindex`; `strokeWidth/strokeLinecap/strokeLinejoin`×8 → hyphenated; `focusable`×5 (unsupported).
- Depends on mermaid rendering by code-syntax/mermaid-init (inline script; outside this area) setting `data-mermaid-rendered`.

### 4.4 AiChatModal — **M**
- Island load (default), skip-SSR, fallback sr-only `<p>`. Props `{ basePath: string }` — JSON ok.
- Hooks: useState 5, useEffect 3 (all rerun), useRef 2, useCallback 2, `memo` 1 (drop), useModalDialog (restoreFocusOnly).
- Global: window `toggle-ai-chat` custom event; BEFORE_NAVIGATE close via modal helper. fetch POST `${base}/api/ai-chat`.
- Show/For: For(messages) (messages are append-only and reset to [] on close; key currently = index — prefer assigning ids), Show(empty prompt), Show(loading), Show(error); live-region text → `computed`.
- Forms: 1 text input `value`+`onChange` → **text adapter** `modelValue={input}` (supported).
- Raw HTML: ai-chat-modal:47 `renderMarkdown(msg.content)` (escape-first markdown → trusted) → `rawHtml` per For item (static per item).
- Dialect: `className`×19, `strokeWidth/Linecap/Linejoin`×6, `xmlns`×2 (unsupported), `onKeyDown`/`onChange`/`onClick`.
- Classes: `backdrop:bg-bg/80`, `lg:h-[90vh]`, `rounded-t-[1rem]`, `h-dvh`/`w-dvw`, `placeholder:text-muted`, `disabled:opacity-50` — supported forms (dvw/dvh listed in sizing row 8).
- Pre-existing bug surfaced by the port: Enter-to-send has no `isComposing` guard (MEASURED: `… | xargs -0 grep -ln "isComposing\|compositionstart"` → only sidebar-tree-island and sidebar-toggle-island). Japanese IME Enter-to-confirm sends the message. Fix while porting (zudo-doc issue, not upstream).

### 4.5 DocHistory — **L** (split in 2)
- Island idle, skip-SSR, fallback sr-only metadata. Props `{slug, locale?, basePath, displayLocale, dateFormats}` — JSON-compatible **but** doc-history-area passes `locale={docHistoryLocale}` which is `undefined` on every default-locale page → `ZR_ISLAND_PROPS … ZR_PROPS_UNDEFINED` (props-transport.ts `if (value === undefined) fail("ZR_PROPS_UNDEFINED", path)`; render-html.ts islandRoot copies `child.props` verbatim into `serializeProps`). Must strip undefined before the Island call.
- Hooks: useState 9 (DocHistory 5 + DiffViewer 2 + RevisionList 2), useEffect 2, useRef 1, useMemo 1, useCallback 2, useModalDialog (manageFocus + returnFocusRef).
- fetch GET `${base}/doc-history/[locale/]<slug>.json`; lazy `import("diff")` (optional peer, unchanged); module-level LRU Map (allowed: browser shared state).
- Show: ~7 reactive (loading, error, data, hasDiff pane, sidebar layout class, diffError, spinner/!changes) — most conditionals are on signals. For: revision list could stay a static map inside Show(data) (entries never change after load); A/B selection → computed class/aria per row.
- **Table constraint:** DiffViewer renders `<table><colgroup>…</colgroup><tbody>{rows.map(<tr>)}</tbody></table>`. v3 forbids dynamic regions directly inside `tbody`/`tr` (render-html.ts `tableChildren` + `restricted()`; hydration.mdx "do not put … dynamic regions directly at table-structural levels"). Port: build the whole table inside one Show/For-of-one factory so rows are a static intrinsic array (allowed) — explicit `tbody` already present.
- Keyed remount (`<DiffViewer key={older:newer}>`): no `key`-remount primitive; use `For each={computed(() => sel ? [sel] : [])} by={pairKey}`.
- Raw HTML: none. Dialect: `className`×48 (includes `<History/Close/ArrowLeft className>` icon props), `onClick`×8, style camelCase `borderBottomColor`, `tableLayout`, numeric `width: 48, height: 48` (needs px).
- Classes: **`animate-spin` (Spinner) — V1 rejects animation utilities (R20/ZW004)** → authored CSS keyframes. Others: `lg:w-[clamp(16rem,25%,22rem)]`, `h-[calc(100%-3rem)]`, `backdrop:bg-bg/30`, `w-[1.5rem]`, `pt-[2px]` (adopt-changed).

### 4.6 DesignTokenPanelBootstrap / ConfiguredDesignTokenPanelBootstrap / createDesignTokenPanelIsland — **S (island) + M (zdtp coexistence spike)**
- Islands load, no fallback, component body calls `runDesignTokenPanelBootstrapOnce(builder, origin)` during render and returns `null`. Props none.
- Port: move the call into `getScope().onActivate(...)` (or keep in setup — the module already guards absent `window`); return `null` (valid Child; `c` region empty).
- The rest of design-token-panel-bootstrap.tsx (859 lines) is framework-free glue: 7 `addEventListener` (COLOR_SCHEME_CHANGED ×2, THEME_PACK_CHANGED ×2, toggle channel, BEFORE/AFTER_NAVIGATE via zdtp `setLifecycleAdapter`), 2 `import()` of `@takazudo/zudo-doc/zdtp-loader` (which is `export * from "@takazudo/zdtp"`).
- Raw HTML: design-token-panel-island.tsx:50 inline `<script>` ZDTP_TOGGLE_SHIM_SRC → static `rawHtml` on `script` (no `</script` substring — contract requirement satisfied by inspection).

**How zdtp is mounted (MEASURED):** zudo-doc does NOT render zdtp inside its own Preact tree. `DesignTokenPanelBootstrap` renders `null`; `bootstrapDesignTokenPanel()` lazily imports zdtp and calls its `configurePanel`, and zdtp **self-mounts its own Preact root**: `grep -o 'import {[^}]*} from "preact[^"]*"' $ZDTP/dist/*.js` shows `import { createContext, Fragment, render } from "preact"`, `preact/hooks` (useContext/useImperativeHandle/…), `preact/compat` (createPortal, forwardRef, memo, useId, useLayoutEffect); `document.body.appendChild(l)` in dist/index-CAajoSLj.js. zdtp 0.8.5 is npm latest (`npm view @takazudo/zdtp versions`), `peerDependencies: { preact: '^10.29.1' }`, deps `@tailwindcss/browser 4.3.2`, `tailwind-merge 3.6.0`, `culori`. 49 zdtp `.d.ts` files import preact types (`grep -rl "from 'preact\|from \"preact" $ZDTP/dist --include='*.d.ts' | wc -l`). zdtp.css is plain compiled CSS (only `@container`×12, `@keyframes`×3, `@media`×2 at-rules — no Tailwind directives), so zudo-wind's ZW009 scan should not trip on `@import "@takazudo/zdtp/styles.css"` (UNVERIFIED end-to-end).

**What zfb v3 dropping Preact means here (INFERRED):** the bootstrap island ports trivially, but zdtp remains a Preact 10 app that brings its own runtime in a lazily-split chunk. The migration must (a) keep `preact` installed as zdtp's peer (root devDep + create-zudo-doc scaffold when `designTokenPanel` is on) even though zudo-doc itself no longer uses it, (b) keep TS able to resolve preact types for zdtp's `.d.ts`, (c) confirm zfb v3's islands esbuild bundles a node_modules package that imports `preact`/`preact/jsx-runtime` through a dynamic import (zfb v3 has no preact handling left: `git grep -i preact v3.0.0 -- crates/zfb-islands/src` only hits two test asserts) — UNVERIFIED, needs a spike build. Porting zdtp to zudo-react is XL and blocked by missing context/portals/forwardRef/useLayoutEffect; that is a zdtp-repo decision. v3 migrating-to-v3.mdx L101 says "Do not ship Preact or React JSX runtime imports for zfb consumers", which zdtp contradicts — docs candidate.

### 4.7 PresetGenerator (showcase) — **L** (split in 2)
- Island load, skip-SSR, fallback 9 `HeadingH3`. Props none. Default-exported named function — allowed (islands.mdx examples use `export default function Counter`). The `displayName = "PresetGenerator"` pin equals the function name, so it passes the v3 identity check (island-boundary.ts throws only on a conflicting displayName) but is now redundant.
- Hooks: useState 4, useEffect 1 (mount-only, timer cleanup), useRef 1, useMemo 3, useCallback 5, useModalDialog (PresetModal).
- Form controls MEASURED (python scan of `<input|select|textarea` in src/components/preset-generator.tsx) — 26 source sites:
  - text inputs ×6 (L318, 361, 664, 696, 763, 776) → **text adapter** `modelValue: Signal<string>` ✓ (behavior change: v2 Preact `onChange` = `change` event; v3 model uses `input`).
  - `<select>` ×5 (L340, 427, 495, 746, 814), all single, static option lists → **single-select adapter** ✓.
  - radio ×4 in 2 named groups (`colorSchemeMode` L399/410, `defaultMode` L450/461) → **radio adapter** shared `modelValue: Signal<string|null>` ✓.
  - checkbox ×11 sites (L66, 179, 474, 523, 547, 633, 650, 682, 714, 731, 799): 7 bound to a boolean field → `modelChecked` ✓; L547 static disabled ✓; L523 `checked={state.features.includes(v)}` (derived from array) and L66 HeaderRightItemRow (`checked={true|false}` per list, row moves between lists on toggle) → reactive `checked` is rejected (`ZR_MODEL_UNSUPPORTED`), so use static `checked` default + `on:change` (uncontrolled) or one writable signal per item ✓ (restructure).
  - No range/number/color/date/file/textarea/multiple-select controls → nothing unsupported.
- State: one `useState<FormState>` object → per-field signals (store of signals) + `computed` for `additionalLangsError`, JSON output, `orderedItems/missingItems`.
- Show ×6 reactive (L382 additionalLangsError, L426 single vs light-dark, L663 keywordsEnabled, L695 ogImageEnabled, L744 twitterCardEnabled, L845 modalState); static conditionals L75, L531. For ×2 (orderedItems with move up/down — key `kind:name`, index signal drives disabled; missingItems).
- Other: clipboard API + execCommand fallback; `htmlFor`×2→`for`; `className`×81; `onChange/onClick`×36; `<HeadingH3 className>` (content component prop — depends on content-typography port); `accent-accent` (accent-color row 40 ✓).

---

## 5. SSR-only components in this area

| Component | Size | Notes |
|---|---|---|
| SearchWidget (+pages/lib/_search-widget.tsx) | S | `<site-search>` custom element (supported: lowercase hyphenated tag, string `data-*` attrs; remove `@ts-expect-error`). `xmlns`×3 unsupported. `spellcheck={false}` → must be `"false"` (enumerated string; boolean → `ZR_ATTRIBUTE … requires a string`). Inline `<script>` → static `rawHtml`; MEASURED `grep -ci "</script" search-widget-script/generated-script.ts` → 0. Boolean `data-open-search` etc. serialize as `data-x="true"` in v3 (INFERRED from attributes(): booleans allowed only for data/aria and emitted via `String(value)`) — selectors still match; byte-exact tests may change. Generated IIFE class strings: `-mx-hsp-lg border-b border-muted`, `text-small text-muted` — zudo-wind must see them (source/manifest). |
| CodeGroup + TabItem + code-syntax/tabs.tsx | S/M | Tabs uses `toChildArray` + `cloneElement` → `flattenChildren` + description copy `{...d, props: {...d.props, default}}` (ZR08 allows). CodeGroup indexes MDX children (`toArray`) → `flattenChildren`. TabItem `hidden`/`data-tab-default=""` fine. Content: `:::code-group` 30 occurrences/4 files, `<Tabs` 19/5, `<TabItem` 35/7 (MEASURED `grep -rF -- "$c" src/content`). |
| Details (+pages/lib/_details.tsx) | S | `<details>/<summary>` supported tags; children passthrough. 17 content uses. |
| MathBlock | S | 2 raw sites (math-block:77 block, :86 inline) KaTeX HTML → `rawHtml` on div/span (SSR only). Top-level-await `import("katex").then(pick, () => null)` unchanged. 30 content uses. |
| BodyFootUtilArea / EditLink | S | `xmlns` on svg ×2 (unsupported); `docHistoryIsland?: VNode` prop type → `Child`. |
| NoteTrayIndex wrapper / note-tray-model | S | JSX types only; model is pure TS. |
| DocHistoryArea factory | S/M | Island call + undefined-prop stripping (§4.5); `as unknown as VNode` casts go away (v3 `Island()` returns `Description`). |
| createBodyEndIslands / createDesignTokenPanelIsland / DocBodyEnd / pages/lib/_body-end-islands.tsx / _preset-generator.tsx / chrome-bindings.tsx | S | Types + Island() calls; `IslandWrapper` MDX passthrough (renders children, ignores `when`) keeps working as a plain component. Host `_body-end-islands.tsx` duplicates the package default except for ClientRouterBootstrap (islands-nav) — candidate to collapse. PageLoadingOverlay inline `<script>` → static rawHtml. |

Raw-HTML sites in this area (JSX `dangerouslySetInnerHTML`, MEASURED 7): highlighted-code:62 (zfb highlight markup, island, reactive), mermaid-enlarge:308 (mermaid SVG clone, island, reactive), ai-chat-modal:47 (renderMarkdown output, island, per-item), math-block:77/86 (KaTeX, SSR), search-widget:211 (inline `<script>` IIFE, SSR), design-token-panel-island:50 (inline `<script>` shim, SSR). Adjacent non-JSX: page-loading-overlay:97 inline script (SSR), mermaid-enlarge `btn.innerHTML` (DOM), preview iframe `srcdoc` (attribute), search IIFE `innerHTML`×9 (runtime DOM, `grep -o innerHTML generated-script.ts | wc -l` → 9).

---

## 6. Upstream (zfb v3) candidates with evidence

1. **[gap/bug] `<iframe>` rejected anywhere inside an island, even empty.** render-html.ts: `const sensitive = words("noscript xmp iframe noembed noframes plaintext")` and `if (context.identity && (tag === "template" || sensitive.has(tag))) fail("ZR_PARSER_CONTEXT", …)`; hydrate.ts L25 + `validatePosition` L274-276 (both hydrate and mount). Contract ZR13 table says "No hydrated content or rawHtml … Static empty/ordinary supported element shells do not promise hydration of parser-sensitive content"; hydration.mdx says "Hydrated content and rawHtml are rejected in parser-sensitive … iframe … contexts" — both read as content-only restrictions. Impact: zudo-doc HtmlPreview (49 MDX uses) cannot be an island.
2. **[gap] `srcdoc` missing from the HTML attribute table** (render-html.ts L20-22 `htmlAttrs`, hydrate.ts L65-67) → `ZR_ATTRIBUTE` even in static SSR. jsx-types.ts HtmlAttributes has `sandbox/allow/allowfullscreen/loading` but no `srcdoc`.
3. **[gap] SVG `xmlns` and `focusable` not accepted** (render-html.ts L23-25 `svgAttrs`; `git grep -n "xmlns\|focusable" v3.0.0 -- packages/zfb/src/zudo-react` → no hits). Static render fails with `ZR_ATTRIBUTE`. zudo-doc: `xmlns=` 43 sites, `focusable=` 6 sites repo-wide (MEASURED `find packages/zudo-doc/src pages src -name '*.tsx' -not -path '*/__tests__/*' | xargs grep -nE '\bxmlns='|wc -l`).
4. **[bug/dx] `CssProperty` TS union rejects valid single-word properties** (jsx-types.ts L10-33 allows only `--*`, `*-*`, and 21 names). `inset`, `cursor`, `resize`, `visibility`, `outline`, `filter`, `order`, `float`, `clear`, `content`, `isolation`, `rotate`, `scale`, `translate`, `zoom` are type errors while the runtime `style()` regex `^(--[a-zA-Z0-9_-]+|[a-z][a-z0-9-]*)$` accepts them. zudo-doc `ENLARGE_DIALOG_STYLE = {position, inset, margin}` (island-types/index.ts).
5. **[dx] Island props with an explicit `undefined` throw** `ZR_ISLAND_PROPS … ZR_PROPS_UNDEFINED` (props-transport.ts `validate()`; render-html.ts islandRoot `const props = { ...child.props }; delete props.children; serializeProps(props)`). JSON.stringify-era code routinely passes optional props as undefined (zudo-doc DocHistory `locale` on every default-locale page). Suggest omitting top-level undefined or a migration-guide callout + clearer diagnostic.
6. **[dx] Unitless numeric style values are silently invalid CSS** (`style()` emits `${name}:${entry};`; contract ZR03 "no implicit px"). No dev diagnostic; zudo-doc has ≥4 numeric length styles in these islands (preview-base iframe height, reservation height, doc-history spinner 48×48). coming-from-preact-hooks.mdx does not mention it.
7. **[docs/dx] No idiom for dynamic table rows.** `For`/`Show` are rejected directly under `tbody`/`tr` (render-html.ts `tableChildren` + `restricted()`); docs forbid it but give no pattern (whole-table-in-factory). Hit by DocHistory diff table.
8. **[docs] Third-party self-mounting framework widgets.** migrating-to-v3.mdx L101 "Do not ship Preact or React JSX runtime imports for zfb consumers" — no guidance for a package like @takazudo/zdtp that is lazily imported from an island and mounts its own Preact root; unclear whether `preact` in the islands graph is supported (UNVERIFIED that it bundles).
9. **[dx] Attribute/tag allowlists are duplicated** in render-html.ts (L13-40) and hydrate.ts (L25-70) although contract ZR03 requires "Both validators must use the same finite attribute table" — drift risk; any fix for #2/#3 must touch both.
10. **[docs] No `key`-remount equivalent.** React/Preact `key={identity}` remount (DocHistory DiffViewer) maps to `For` over a one-element array; coming-from-preact-hooks.mdx has no entry for it.
11. **[gap, other repo: Takazudo/zudo-design-token-panel]** zdtp 0.8.5 (npm latest) is Preact-only (peer `preact ^10.29.1`; uses createContext/createPortal/forwardRef/useImperativeHandle/useLayoutEffect/useId/memo) and depends on `@tailwindcss/browser 4.3.2` → every zfb-v3 zudo-doc consumer with designTokenPanel keeps a Preact runtime and a Tailwind browser runtime.

---

## 7. Proposed sub-tasks (≤ ~20 tool calls each)

Prereqs from other explorers: zfb 3.0.0 install, tsconfig `jsxImportSource @takazudo/zfb/zudo-react`, removal of 375 per-file preact pragmas, wind config/tokens, test harness switch from preact-render-to-string to `@takazudo/zfb/zudo-react/server` + client `mount` + `flush()`.

| ID | Task | Size | Depends |
|---|---|---|---|
| IC-0 | Spike: zfb v3 island with (a) iframe via rawHtml, (b) xmlns/focusable/srcdoc attrs, (c) lazy `import("@takazudo/zdtp")` + preact in islands bundle; record results → file upstream issues #1-#3,#8 | M | zfb 3 installed |
| IC-1 | Port `use-modal-dialog` → setup-scope helper (`createModalDialog({isOpen: ReadonlySignal<boolean>, onClose, …})` returning `{dialogRef, onBackdropClick}`), island-types style constants, icons `className`→`class` prop + drop `xmlns` (coordinate with islands-nav: theme-pack-dialog is the 6th caller) | M | infra |
| IC-2 | ImageEnlarge + tests | M | IC-1 |
| IC-3 | MermaidEnlarge + tests | M | IC-1 |
| IC-4 | AiChatModal (+ renderMarkdown/SmartBreak check, isComposing guard) + tests | M | IC-1 |
| IC-5a | DocHistory shell: dialog, fetch, Show states, body-overflow effect, Spinner CSS (replace `animate-spin`) | M | IC-1 |
| IC-5b | DocHistory RevisionList + DiffViewer (table-in-factory, For-of-one remount, lazy diff) + doc-history-area undefined-prop strip + tests | M | IC-5a |
| IC-6a | HtmlPreview port: PreviewBase/HtmlPreview/HighlightedCode signals, delete VISIBLE_MOUNT_PROP gate, iframe per IC-0 outcome | L | IC-0 |
| IC-6b | HtmlPreview unit tests (12 files, 1925 lines) + i18n/smoke e2e | M | IC-6a |
| IC-7 | DesignTokenPanelBootstrap ×2 + island factory; keep preact for zdtp (deps/scaffold/tsconfig types) | S | IC-0 |
| IC-8a | PresetGenerator: state→signals store, sections 1-6 forms (text/select/radio/checkbox adapters) | M | IC-1 |
| IC-8b | PresetGenerator: header-right For lists (reorder), meta-tag Show blocks, PresetModal + clipboard, fallback stub | M | IC-8a |
| IC-9 | SSR components: SearchWidget, CodeGroup/Tabs/TabItem (flattenChildren/copy), Details, MathBlock, BodyFootUtil/EditLink, NoteTrayIndex, body-end/doc-body-end factories, host stubs, chrome-bindings | M | infra |
| IC-10 | e2e verification: smoke-html-preview, i18n-html-preview, smoke-mermaid*, smoke-ai-chat, smoke-details, smoke-tabs*, smoke-design-token-panel*, hostpanel-design-token-panel, theme-pack-zdtp-interplay, preset-generator/doc-history specs | M | all |

MEASURED e2e spec coverage (`find e2e -maxdepth 1 -name '*.spec.ts' -print0 | xargs -0 grep -li -- "$k" | wc -l`): html-preview 3, doc-history 2, image-enlarge 2, enlarge 5, mermaid 5, ai-chat 2, preset 5, design-token 10, site-search 1, tab-panel 3, details 5, katex 1.
