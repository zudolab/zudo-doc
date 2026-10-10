# islands-nav: navigation/chrome islands + island wiring, zudo-doc 5.28.2 → zfb 3.0.0

Scope: zudo-doc `main` @ 337b9f110 (zfb 2.22.1) and zfb `v3.0.0` (82193109). Read-only. The scratch
evidence (probe scripts, the npm-packed zfb 3.0.0 tarball, and the count scripts) is under
`<planning-scratch>/explore/islands-nav/`.

Legend: **M** = measured by the command shown; **R** = established by reading the code, file:line cited;
**I** = inference; **U** = unverified.

---

## 0. Headline measurements

| Fact | Value | How |
|---|---|---|
| `Island({...})` call sites (package + host) | **27** (M) | `grep -rnE "\bIsland\(\{" packages/zudo-doc/src pages src --include='*.tsx' --include='*.ts' \| grep -v __tests__ \| grep -vE ":\s*(//\|\*)" \| grep -vE "create[A-Za-z]+Island\(" \| wc -l` |
| `"use client"` modules (package + host src) | **23** (M) | `grep -rlE "^\s*['\"]use client['\"]" --include='*.tsx' --include='*.ts' packages/zudo-doc/src src pages \| grep -v __tests__ \| wc -l` |
| Distinct components used as Island children | **19** (R: enumerated in island-calls-detail.txt) | same as the upstream #3328 claim |
| …of which are in this NAV/CHROME group | **12** | DesktopSidebarToggle, DesktopTocToggle, SidebarToggle, SidebarTree, SiteTreeNav, Toc, MobileToc, Sidebar, ThemeToggle, ThemePackSwitcher, FindInPageInit, ClientRouterBootstrap |
| `.displayName =` assignments (non-test) | **23** (M) | `grep -rnE "\.displayName\s*=" packages/zudo-doc/src src pages --include='*.tsx' --include='*.ts' \| grep -v __tests__ \| wc -l` — all equal the function name, so none trips v3's `ZR_ISLAND_IDENTITY` conflict check (R: island-boundary.ts `displayName !== functionName`) |
| Files with `/** @jsxImportSource preact */` pragma (pkg, non-test) | **131** (M) | `grep -rl "@jsxImportSource preact" packages/zudo-doc/src --include='*.tsx' --include='*.ts' \| grep -v __tests__ \| wc -l` |
| Runtime preact imports (pkg+src+pages, non-test) | `preact` 141, `preact/hooks` 17, `preact/compat` 9 (M) | `grep -rnoE "from \"preact[^\"]*\"" … \| grep -v __tests__ \| awk -F: '{print $NF}' \| sort \| uniq -c` |
| `dangerouslySetInnerHTML` lines (pkg+src+pages) | **38** (M) | the #3328 claim is confirmed |
| `className=` (package only / all) | **279 / 361** (M) | `grep -rnE "\bclassName=" packages/zudo-doc/src --include='*.tsx' \| grep -v __tests__ \| wc -l`. #3328's "~272" was the package-only figure; the tree has grown since |
| `on[A-Z]…=` handlers (all) | **101** (M) | `grep -rnoE "\bon[A-Z][A-Za-z]+=" … \| grep -v __tests__ \| wc -l` |
| Client import closure of the 12 nav islands | **36 files** (M) | `node scratchpad/explore/islands-nav/closure.mjs <seeds>` → client-closure.txt |
| Dialect debt inside that closure | className 145, on* 38, camel SVG attrs 12, xmlns 23, tabIndex 1, style objects 21, dSIH 6, `.map(` 19, cond-JSX 44, `ref=` 10, createPortal 1 (M) | `bash scratchpad/explore/islands-nav/dialect.sh client-closure.txt` |
| Unit test files in the area / using Preact render APIs | **43 / 28** (M) | `ls …/__tests__ \| grep -c "\.test\."`; `grep -lE "preact/test-utils\|preact-render-to-string\|from \"preact\"" … \| wc -l` |
| Area e2e specs (see §7) | 39 of 82 specs relevant (M) | `ls e2e/*.spec.ts \| grep -iE "sidebar\|toc\|theme\|nav\|drawer\|…"` |

---

## 1. How island identity/registration works today (2.22.1) and what v3 changes

### 2.22.1 (R)
- **SSR side**: `Island()` (zfb `packages/zfb/src/island.ts@v2.22.1`) is a plain function that returns a
  `jsx("div", …)` element from `react/jsx-runtime` (Preact via alias). The marker name comes from
  `captureComponentName(children)` = `type.displayName || type.name || "Anonymous"`. Props come from
  `captureSerializableProps` = `JSON.stringify(child.props minus children)` — which **silently drops
  `undefined` fields, functions and non-enumerables**, and swallows errors. When the JSON is `{}`, it omits `data-props`.
- **Scanner side** (`crates/zfb-islands/src/scanner.rs`): walks pages → transitive imports; every
  `"use client"` file registers **every exported binding** as `(source_path, name)`. Only clearly non-component
  literal exports are dropped (#998), so exported helpers and hooks such as `readState`, `setDataAttribute`,
  `useModalDialog` and `bootstrapDesignTokenPanel` are registered too. The manifest is a flat `name → path` map, and on
  a name collision the first path by sort order wins (manifest.rs). zudo-doc hit this with #3257: `readState` had to
  be renamed `readTocState`.
- **Package code under node_modules**: bare imports made from inside `node_modules` are never followed, with one
  exception: an **injected route** whose realpath is under `node_modules` is treated as
  honorary project source, and it gets one bare hop (issue #1268). zudo-doc's `packageOwnedRoutes`
  plugin injects the raw `routes-src/*.tsx`, and `copy-routes-src.mjs` rewrites their relative imports to
  `@takazudo/zudo-doc/<subpath>`, so the scanner reaches the package's compiled `dist/**.js`. tsup
  runs with `bundle:false` so that each dist file keeps its `"use client"` directive (packages/zudo-doc/tsup.config.ts header).
  `is_same_package_duplicate` suppresses the source/dist twin collisions (manifest.rs, #2441).
- **Host**: host code calls `Island({...})` as a *function*, not as JSX, and casts the result `as unknown as VNode`. The MDX
  `<Island>` tag is an SSR pass-through (`chrome/derive.tsx:178 IslandPassthrough`,
  `src/chrome-bindings.tsx:108 IslandWrapper`). It is not a real island.

### v3.0.0 (R, plus the M probes noted)
- `Island()` → `ownedIslandBoundary()` (`packages/zfb/src/island-boundary.ts`) requires:
  - exactly one **function-component description**. A host element, a string, several children or a nested island all fail with `ZR_ISLAND_CHILD`.
  - a non-empty `type.name`. A `displayName` is allowed only if it **equals** `name` (otherwise `ZR_ISLAND_IDENTITY`).
  - `globalThis.__zfb.zudoReactBuild` must be set, and the name must be in `globalThis.__zfb.zudoReactIslands`
    (the scanner's registry). An unregistered name is now a **hard SSR error**; in 2.x it was only a build warning.
  - props go through `serializeProps` (`zudo-react/props-transport.ts`), which **rejects undefined anywhere**
    (`ZR_PROPS_UNDEFINED`), as well as non-enumerable own props, class instances, Dates and functions.
- The wrapper carries `data-zfb-island`, `data-when`, `data-zfb-transport="json/1"`, `data-zfb-protocol="zudo-react/1"`,
  `data-zfb-build` and `data-props` (always present). The client validates all of them (`runtime.ts readProps`) and
  rejects nested island wrappers (`ZR_NESTED_ISLAND`).
- **Hand-authored wrappers** are supported only with the complete metadata above plus an inner produced by
  `renderToString(child, { island: identity })`. This is the only way to put `data-zfb-transition-persist` on an
  island *root*, because the SDK `Island` has no persist prop (contract line 461: "No new persist prop is added").
- Scanner registration semantics are unchanged: every exported function of a `"use client"` file is still registered. Only the
  diff stat moved: `git diff --stat v2.22.1 v3.0.0 -- crates/zfb-islands/src/scanner.rs` → 170 lines.
- **What zudo-doc must do**:
  1. Compile *all* package code with `jsxImportSource @takazudo/zfb/zudo-react`. A Preact vnode is not an
     `isDescription` value, so a Preact-compiled dist child fails `singleChild()`. Remove or replace the 131 `@jsxImportSource preact`
     pragmas (they override tsconfig per file).
  2. Make every island prop tree JSON-strict (see §3). This was measured failing today.
  3. Keep function names stable. tsup `bundle:false` with no minify preserves them; the existing displayName
     pins are now redundant but harmless.
  4. Optional hygiene: move non-component exports (`readState`, `setDataAttribute`, `readTocState`,
     `setTocDataAttribute`, `useModalDialog`, …) out of `"use client"` files so that they are not registered as markers.
  5. Re-evaluate `ClientRouterBootstrap`. The v3 docs (concepts/client-side-routing.mdx) say the scanner auto-ships
     the router when a page reaches `<ClientRouter />`. zudo-doc keeps a side-effect island (#1524) because the
     package `doc-layout.tsx` imports `ClientRouter` from the pure barrel. Whether the scanner detects that from the
     package closure is **U**; verify it during dogfooding and delete the island if so.

---

## 2. Per-island inventory (NAV/CHROME group)

Hook counts exclude import and comment lines (`bash scratchpad/.../count.sh`, output hookcounts.txt). Effects were
classified by hand-reading each file. "Re-runs" means the effect has non-empty deps that change after mount; props
are static in zudo-react, so a props-only dep list behaves as mount-only after porting.

### 2.1 DesktopSidebarToggle — `packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx` (110 lines)
- **Island call**: `sidebar-prepaint/index.tsx:135` `when:"load"`, no props.
- **Hooks**: useState 1, useEffect 3, useRef 1.
- **Effects**: [visible] persist to localStorage and `<html data-sidebar-hidden>` (re-runs on state, no cleanup); [] reconcile from storage (mount); [] AFTER_NAVIGATE listener (mount, has cleanup).
- **Globals**: document AFTER_NAVIGATE_EVENT; localStorage `zudo-doc-sidebar-visible`.
- **Show/For**: `{visible ? <ChevronLeft/> : <ChevronRight/>}` → Show.
- **Dialect**: className 3, onClick 1.
- **Persistence**: `data-zfb-transition-persist="desktop-sidebar-toggle"` sits on the inner `<button>`, not on the island
  wrapper. The router lifts an owned child node of a disposed root into the new wrapper (see §5 risk).
- **Other**: exports non-components `SIDEBAR_STORAGE_KEY`, `readState`, `setDataAttribute`, which the scanner registers.
- **Port**: **S**. Replace the hydrated-ref dance with `onActivate` plus `scope.effect`.

### 2.2 DesktopTocToggle — `desktop-toc-toggle-island/index.tsx` (115 lines)
Mirror of 2.1 (`toc-prepaint/index.tsx:141`, `when:"load"`), storage key `zudo-doc-toc-visible`, persist key
`desktop-toc-toggle`, exports `readTocState` / `setTocDataAttribute` (renamed in #3257 because of the scanner collision). **S**.

### 2.3 SidebarToggle (mobile drawer) — `sidebar-toggle-island/index.tsx` (279 lines)
- **Island call**: `header-with-defaults/index.tsx:177` `when:"visible"`. It sits inside the persisted `<header data-zfb-transition-persist="header-${lang}">`.
- **Props**: `nodes, currentSlug, rootMenuItems, backToMenuLabel, locale, localeLinks, themeDefaultMode,
  themeLabels, themeRespectSystem, dateFormats`. **Not v3-JSON-safe**: `currentSlug` is undefined on the home page
  header, and `nodes[*]` carry undefined keys (§3).
- **Hooks**: useState 1, useEffect 3, useRef 1.
- **Effects**: [open] body overflow lock (re-runs, cleanup); [] AFTER_NAVIGATE close (mount, cleanup); [open] document keydown Escape
  with isComposing/defaultPrevented guards (re-runs, cleanup).
- **Module side effect**: `ensureNestedIslandPropsRefresh()` installs the BEFORE_SWAP data-props rewrite (§5).
- **Show/For**: none needed. Both icons are always rendered, and open/closed is expressed through class, style (`HIDDEN_ICON_STYLE` string) and `inert`.
- **Dialect**: className 6 (one of them a template-literal class), onClick 2, camel SVG attrs 6 (`strokeWidth/strokeLinecap/strokeLinejoin`), `xmlns` 2
  (rejected by zudo-react, §6), ref 1.
- **Child tree**: hosts `<SidebarTree>` (and through it the bare `<ThemeToggle>`) as ordinary children. There is no nested boundary.
- **Port**: **M**. The component itself is simple, but it depends on the SidebarTree and ThemeToggle ports and on the persist/props-refresh rework.

### 2.4 SidebarTree — `sidebar-tree-island/index.tsx` (828 lines) + `sidebar-scroll-preserve.ts`
- **Island calls**: `sidebar-with-defaults/index.tsx:93` `when:"load"` (desktop, inside the persisted `<aside id=desktop-sidebar
  data-zfb-transition-persist=sidebarPersistKey>` at `doclayout/doc-layout.tsx:419`). It is also rendered as a plain child of SidebarToggle.
- **Props**: `nodes, currentSlug, currentPath, rootMenuItems, backToMenuLabel, locale, localeLinks, themeDefaultMode,
  themeLabels, themeRespectSystem, dateFormats`. `backToMenuLabel` is `undefined` when `!navSection`
  (`sidebar-with-defaults/index.tsx:78`), `currentSlug` is optional, and `nodes` has undefined keys, so it is **not JSON-safe**.
- **Hooks (whole file)**: useState 7, useEffect 9, useRef 1, useMemo 5, useCallback 2, `memo()` 3 (NodeList,
  CategoryNode, LeafNode).
- **Effects**: 9 in total.
  - useActiveSlug [nodes,currentPath]: AFTER_NAVIGATE listener, has cleanup.
  - SidebarTree [] platform placeholder: mount.
  - SidebarTree [] ⌘/ keydown: mount, has cleanup.
  - TrayGroupNode: [] restore-from-sessionStorage (mount), [containsCurrent] (re-runs because activeSlug is state), [open,storageKey] (re-runs).
  - CategoryNode: [] restore (mount), [currentSlug] (re-runs), [open, node.slug] (re-runs).
  - Total: 4 mount-only and 5 re-running on state.
- **Setup-time browser read (v3 hazard)**: `useState(() => initial ?? deriveActiveSlug(nodes, currentPath))` reads
  `window.location` / dataset at setup when `currentSlug` is absent. SSR yields undefined and the client yields a slug, which picks
  a different root branch, so the server and client DOM differ → `ZR_HYDRATION_MISMATCH`, fail closed. It must move to `onActivate`.
- **Show/For**:
  - Three alternative root returns (root-menu view / top-page view / tree) → Show chain.
  - `hasChildren && expanded`, `isExpanded && …`, the `noteTrayRoot ? … : …` ternary, `rootMenuItems && …`, `footer`.
  - Keyed lists: `filteredNodes` (recursive, changes with the filter query → **For with keys**), `rootMenuItems.map`,
    tray `items.map` / `groupItems(...).map` / `group.items.map`, `links.map`.
- **Form control**: filter `<input type=text value={query} onInput>` → writable `modelValue` signal (text adapter, supported).
- **Raw HTML**: 6 `dangerouslySetInnerHTML` sites (`smartBreakToHtml` labels) → `rawHtml` on `<span>`, trusted. 5 are code sites; 1 is a comment.
- **Style**: 7 `style={{…}}` camelCase objects (`paddingLeft`, `left`, `top`, …) → CSS-spelled keys, and numbers need explicit units.
- **Dialect**: className 51, on* 7, ref 1. Its children `ConnectorLines`, `CategoryLinkIcon` (tree-nav-shared) and the icons (`xmlns` ×16 in icons/index.tsx) are rendered too.
- **Storage**: sessionStorage `zd-sidebar-open` plus per-tray-group keys.
- **Module side effect**: `ensureSidebarScrollPreserve()` installs BEFORE/AFTER_NAVIGATE listeners that snapshot and restore `#desktop-sidebar` scrollTop.
- **Port**: **XL**. It is the largest island and has a recursive keyed For, 3 memo components, 9 effects, raw HTML, sessionStorage, a controlled input,
  a nested ThemeToggle, and it lives in a persisted aside. Split it into at least 3 sub-tasks (§4).

### 2.5 SiteTreeNav — `site-tree-nav-island/index.tsx` (405 lines) + `state.ts`
- **Island calls**: `site-tree-nav/index.tsx:206` and `home-page/index.tsx:363`, both `when:"idle"` (must stay idle, #1453).
- **Props**: `tree, ariaLabel?, categoryOrder?, categoryIgnore?, initiallyCollapsedCategorySlugs?, locale?, dateFormats?, updatedLabel?` (deprecated). `tree` nodes carry undefined keys, and the optionals may be undefined. **Not JSON-safe.**
- **Hooks**: useState 1 (per CategoryNode, lazily from props), no effects.
- **Show/For**: `open && (children)`, and `depth>=1 && !isLast && open`. Its lists are prop-static, so plain arrays work inside a Show.
- **Style**: 5 camelCase objects (`gridTemplateColumns`, `left`, `top: 0`, `bottom: 0`, `paddingLeft`, `width`).
- **Dialect**: className 24, onClick 2.
- **Port**: **M**. It is mechanical, with no lifecycle.

### 2.6 Toc — `toc/toc.tsx` (120 lines) + `toc/use-active-heading.ts` (162 lines)
- **Island calls**: `doc-page-shell/index.tsx:323`, `doclayout/doc-layout-with-defaults.tsx:324`, both `when:"load"`.
- **Props**: `headings` (depth/slug/text), `title` (string). JSON-safe (I).
- **Hooks**: Toc has useMemo 1. useActiveHeading has useState 1, useEffect 1 ([headings] → mount after porting; cleanup removes
  window scroll/resize/scrollend listeners and timers), useRef 3, useCallback 1 (`activate` with setTimeout).
- **Show/For**: the list is prop-static (no For needed). The per-item active class and `aria-current` → `computed` per item.
  `filtered.length > 0 &&` is static.
- **Dialect**: className 4, onClick 1.
- **Port**: **M**. The hook becomes a function returning a signal, and the scroll-spy moves into `onActivate`.

### 2.7 MobileToc — `toc/mobile-toc.tsx` (141 lines)
- **Island calls**: `doc-page-shell/index.tsx:331`, `doc-layout-with-defaults.tsx:330`, `when:"load"`.
- **Hooks**: useState 1, useMemo 1, no effects.
- The early return on `filtered.length === 0` depends only on props (fine as a setup-time branch).
- The open state is expressed through classes and `aria-*` only, so no Show is needed.
- **Dialect**: className 7, onClick 2, camel SVG attrs 3, `xmlns` 1.
- **Port**: **S**.

### 2.8 Sidebar (shell) — `sidebar/sidebar.tsx` (137 lines)
- **Island call**: `doc-layout-with-defaults.tsx:386` `Island({when:"load", children:<Sidebar nodes={[]} />})`. It is the
  default used when there is no `sidebarOverride`, and it **renders null** (no treeComponent, no children).
- The `treeComponent` prop is a function and was never serializable (#1459).
- **Port**: **S**. Better: drop the island wrap entirely, because an island that renders null ships nothing useful.

### 2.9 ThemeToggle (appearance menu) — `theme-toggle/index.tsx` (256 lines) + `color-scheme-sync.ts` + `hydration-pending.ts`
- **Island calls**:
  - `header-with-defaults/index.tsx:195` `when:"load"` (inside the persisted header).
  - `theme/theme-toggle.tsx:28` (the `./theme` barrel wrapper, `when:"load"`, used by `doclayout/doc-layout-with-defaults.tsx:92`).
  - Rendered bare inside the SidebarTree footer, and through that inside SidebarToggle.
- **Props**: `defaultMode, labels, respectPrefersColorScheme, pendingUntilHydrated`. JSON-safe (I).
- **Hooks**: useState 5, useEffect 4, useRef 6, plus `useHydrationPending` (useState 1, useEffect 1).
- **Effects**:
  - [defaultMode, respect]: subscribe to preference/scheme events. Mount-only after porting; has cleanup.
  - [open]: showPopover, then pointerdown/resize/scroll(capture)/AFTER_NAVIGATE listeners and positioning. Re-runs; has cleanup.
  - [open, placement]: focus. Re-runs.
  - [open]: restore focus via rAF. Re-runs.
  - Totals: 1 mount-only and 3 re-running on state, plus the pending mount effect.
- **Preact-only API**: `createPortal(menu, document.body)`. zudo-react has **no portals**.
- **`popover="manual"` attribute**: zudo-react's closed allowlist **rejects it** (M, §6). Porting the menu in place to the top layer
  therefore needs a ref plus `el.popover = "manual"` in `onActivate`, or an upstream fix.
- **Style**: the object has **numeric** `left/top/width/maxHeight` in camelCase. zudo-react emits numbers unitless
  (documented, M: `left:10`) → silently invalid CSS unless it is rewritten to `${n}px`.
- **Show/For**: `open && createPortal(...)` → Show. `PreferenceIcon` branches on reactive `preference` → Show/switch
  (the light branch is `<circle>+<path>` and the dark/system branches are a single `<path>`, so the structures differ). The `preferences.map` list is static.
- **Dialect**: className 8, on* 5 (onClick/onKeyDown/onFocus), camel SVG 3, xmlns 1, ref 4 (including callback refs in a loop).
- **Globals**: the `window.__zudoDocColorScheme` runtime, localStorage `zudo-doc-theme`, custom `color-scheme-changed` /
  `theme-preference-changed` events, and module-level `menuSequence` counter used for ids.
- **Port**: **L**.

### 2.10 ThemePackSwitcher — `theme-pack-switcher/index.tsx` (330 lines) + `switcher-state.ts`, `theme-pack-sync.ts`; child ThemePackDialog `theme-pack-dialog/index.tsx` (250) + `theme-pack-card.tsx` + `dialog-state.ts`; hook `use-modal-dialog/index.ts` (194)
- **Island call**: `doc-body-end-islands/theme-pack-switcher-island.tsx:68` `when:"load"`. It is in the body end, not persisted.
- **Props**: `active, order[{slug,name,mode,description}], base, pendingUntilHydrated`. JSON-safe (R: switcher-state.ts:24).
- **Hooks**:
  - Switcher: useState 3, useEffect 3, useRef 2, plus pending.
  - Dialog: useState 5, useEffect 5, useRef 2, useCallback 1.
  - useModalDialog: useEffect 3, useRef 2.
- **Effects**:
  - Switcher: [] connectActivePackSync (mount, cleanup), [open, dialogOpen] Escape (re-runs, cleanup), [open] focus (re-runs).
  - Dialog: [] pack sync (mount), [] color-scheme listener (mount, cleanup), [open] capture launcher (re-runs), [open, hasBrowsable] fetch trigger
    (re-runs), [fetchToken, base] fetch with a cancellation flag (re-runs, cleanup → should use the scope abort signal).
  - useModalDialog: [isOpen,…] showModal/close (re-runs), [isOpen,onClose,…] native `close` listener (re-runs, cleanup), [navigateEvent,onClose]
    (mount, cleanup).
- **Parent → child reactive props**: `open={dialogOpen}` and function props (`onClose`, `onSelect`) cross a normal component
  boundary. That is fine in zudo-react (not an island boundary), but the `open` flag must be passed as a signal.
- **Show/For**: the card `open ? … : null`, the entry badge and description conditionals, the dialog `registryState` branches, and
  **For over the fetched `packs`**. The `order` skeleton list is static.
- **Dialect**:
  - Switcher: uses `class=` (15) already, but `tabIndex={-1}` (camel, rejected) and `xmlns` ×2.
  - Dialog: className 14, on* 4.
  - Card: className 11, style objects 7.
  - The dialog also uses `animate-pulse` (animation utility, rejected by zudo-wind v1; the CSS explorer owns that).
- **Shared-hook blast radius**: `useModalDialog` is also used by image-enlarge, mermaid-enlarge, doc-history, ai-chat-modal
  and the host `src/components/preset-generator.tsx` (M: `grep -rln "use-modal-dialog" …`). Porting it is a cross-group dependency.
- **Other**: uses `React.RefObject` / `React.MouseEvent` global-namespace types, and imports from `preact/compat`.
- **Port**: **L** (L for the switcher and dialog together; M for useModalDialog alone).

### 2.11 FindInPageInit — `find-in-page/index.tsx` (86) + `find-bar.tsx` (133) + `find-in-page.ts`
- **Island call**: `doc-body-end-islands/index.tsx:263` `when:"load"`. Gated on `settings.findInPage`, Tauri-only at runtime.
- **Hooks**: useState 2, useEffect 3, useRef 1 (Init); useState 2, useEffect 3, useRef 2, useCallback 2 (FindBar).
- **Effects**: [] Tauri detect (mount), [isTauri] ⌘F keydown (re-runs, cleanup), [] `zfb:before-preparation` (mount, cleanup); FindBar
  [findInPage] ref sync, [visible] focus, [visible] reset (re-runs).
- **Show/For**: `if (!isTauri) return null` and `if (!visible) return null` → Show.
- **Form**: `<input value={query} onChange>`. Under core-Preact JSX, `onChange` is the native change event, so porting must choose on:input or on:change
  deliberately (I: the current behaviour may be an unintended blur-time search).
- `find-bar.tsx` also carries `"use client"`, so `FindBar` is registered as a marker even though it is never an island child.
- **Port**: **M**.

### 2.12 ClientRouterBootstrap (host) — `src/components/client-router-bootstrap.tsx` (71)
- **Island call**: `pages/lib/_body-end-islands.tsx:108` `when:"load"`.
- It renders null. Its only job is `import "@takazudo/zfb-runtime/client-router"`. **S**: port it, or delete it if the v3 scanner
  auto-ships the router (§1 item 5, U).

### 2.13 Wiring-only / SSR-only members of the area (not islands)
| File | Role | v3 impact |
|---|---|---|
| `sidebar-prepaint/index.tsx`, `toc-prepaint/index.tsx` | Pre-paint `<script dangerouslySetInnerHTML>` + the Island wrap of the desktop toggles | `rawHtml` on script (static string only) |
| `sidebar-resizer/sidebar-resizer-init.tsx` + `index.ts` | Inline init/restore scripts (localStorage `zudo-doc-sidebar-width`) | `rawHtml` ×2 |
| `page-loading/page-loading-overlay.tsx` | Overlay + bootstrap script | `rawHtml` |
| `theme/color-scheme-provider.tsx`, `theme/theme-pack-provider.tsx` | Head bootstrap scripts; theme-pack-provider mutates `event.newDocument` on BEFORE_SWAP | `rawHtml` ×2 each |
| `theme/theme-toggle.tsx`, `theme/index.ts` | `./theme` barrel Island wrapper around the bare ThemeToggle (not `"use client"`, on purpose) | Types change (`Island` returns `Description`) |
| `i18n-version/{language-switcher,version-switcher,version-banner}.tsx`, `inline-version-switcher/index.tsx` | SSR + inline init scripts (LANGUAGE_SWITCHER_INIT_SCRIPT, version-switcher rewire) and **no hooks**; already use `class=` | Static-render dialect only (`xmlns`, SVG attrs) |
| `transitions/{index,page-events,nested-island-props-refresh}.ts` | Router event names; the BEFORE_SWAP nested-props refresh | Must learn the v3 wrapper metadata (§5) |
| `client-router/raw-link-attrs.ts` | 5-line attrs helper | none |
| `hydration-pending.ts` | `useHydrationPending` hook (used by ThemeToggle and ThemePackSwitcher) | Becomes a signal flipped in `onActivate` |

---

## 3. JSON-props strictness: measured failure

`node scratchpad/explore/islands-nav/navprobe.mjs` feeds two docs into zudo-doc's own `dist/site-schema/nav-tree.js`
`buildNavTree` and then into zfb 3.0.0's `serializeProps`:

```
undefined-valued keys: 17 nodes[0].description nodes[0].children[0].description nodes[0].children[0].shape …
serializeProps FAIL: ZR_PROPS_UNDEFINED at props.nodes[0].description
top-level undefined FAIL: ZR_PROPS_UNDEFINED at props.currentSlug
```

- **Cause (R)**: `site-schema/nav-tree.ts:35-51 toNavNode` always writes `description, shape, noteTrayDated,
  noteTraySidebar, date, updated, rank` even when they are undefined. 2.x `JSON.stringify` hid this.
- **Affected islands**: SidebarToggle, SidebarTree, SiteTreeNav (all of them take `nodes` / `tree`), plus optional top-level
  props (`currentSlug`, `backToMenuLabel`, `ariaLabel`, `initiallyCollapsedCategorySlugs`, `updatedLabel`).
- **Latent second trap (R)**: `sidebar-tree/build-tree.ts:207` defines a **non-enumerable** `__sortPosition` on
  intermediate nodes. The `toNavNode` copy drops it, but any path that forwards raw `SidebarNode` objects would hit
  `ZR_PROPS_PROPERTY`.
- **Fix options**: (a) make the builders omit undefined keys (the conditional-spread style `build-tree.ts` already uses); (b) add a
  zudo-doc `islandProps()` sanitizer at the 27 call sites; (c) an upstream DX change (see upstreamCandidates).

---

## 4. Proposed sub-task grouping (each ≤ ~20 agent tool calls)

Prerequisite (owned by the tsconfig/tooling explorer, listed here for ordering): package and root `jsxImportSource` switch, removal of the 131
pragmas, `Island` / `VNode` type swap, and test harness helpers for zudo-react render/hydrate under happy-dom.

| # | Sub-task | Files | Size | Depends on |
|---|---|---|---|---|
| N1 | **Island prop hygiene**: make the nav builders omit undefined (`toNavNode`, root node, `remapVersionedHrefs`); strip optional top-level props at the 27 `Island()` call sites (conditional spread or `islandProps()`); unit test running `serializeProps` over real builder output; move helper exports out of `"use client"` files | site-schema/nav-tree.ts, sidebar-tree/build-tree.ts, nav-data-prep, header-with-defaults, sidebar-with-defaults, site-tree-nav, home-page, doc-page-shell, doc-layout-with-defaults, desktop-*-toggle-island | M | jsx switch |
| N2 | **Persist/transition layer**: teach `nested-island-props-refresh.ts` the v3 metadata set (marker, `data-when`, transport, protocol, build, props) plus the remount flag; extend it from the header to the persisted sidebar `<aside>` and the footer (§5); decide how DesktopToggle persists (a hand-authored wrapper via `islandRoot`, or dropping persist); update transitions tests | transitions/*, header/header.tsx, doclayout/doc-layout.tsx, footer/footer.tsx, desktop-*-toggle-island | M | N1 |
| N3 | **Small islands**: DesktopSidebarToggle, DesktopTocToggle, MobileToc, the Sidebar shell (drop its wrap), ClientRouterBootstrap (verify auto-router), and `hydration-pending` → signal helper, with their SSG tests | 6 dirs | S–M | jsx switch |
| N4 | **Toc + useActiveHeading** (signals, onActivate scroll-spy, per-item computed class) and their tests | toc/* | M | N3 (helper) |
| N5 | **SiteTreeNav** (Show regions, kebab style keys) and its 3 tests | site-tree-nav-island/* | M | N1 |
| N6 | **ThemeToggle** (no portal: in-place menu, with popover set through a ref or an upstream fix; px units; Show for the icon and menu; focus management) plus its 3 tests | theme-toggle/*, theme/theme-toggle.tsx | L | N3 |
| N7a | **SidebarTree core**: the active-slug signal (moved to onActivate), open-set storage helpers, CategoryNode/LeafNode/NodeList without memo, **recursive keyed For**, rawHtml labels, filter `modelValue` | sidebar-tree-island/index.tsx (first half), tree-nav-shared, icons | L | N1, N6 |
| N7b | **SidebarTree note-tray, root menu, and footer branches** (TrayList, TrayGroupNode, RootMenuItemEntry, SidebarFooter, Show chain for the 3 root views), plus scroll-preserve re-check | sidebar-tree-island/index.tsx (second half) | M | N7a |
| N7c | **SidebarTree tests**: migrate 5 SSG/active-path/date-format/note-tray tests to zudo-react render + hydrate parity | sidebar-tree-island/__tests__/* | M | N7b |
| N8 | **SidebarToggle** (drawer; Escape layering; `inert`; hosts SidebarTree) plus its 2 tests | sidebar-toggle-island/* | M | N2, N7b |
| N9 | **useModalDialog** as a zudo-react helper taking signals (shared with 4 islands in other groups plus the host preset-generator) | use-modal-dialog/index.ts | M | jsx switch; coordinate with the content-island explorer |
| N10 | **ThemePackSwitcher + ThemePackDialog + ThemePackCard** (fetch lifecycle with the scope abort signal, For over packs) plus its 7 tests | theme-pack-switcher/*, theme-pack-dialog/* | L | N9 |
| N11 | **FindInPage** (Show, input binding decision) | find-in-page/* | M | N9 is not needed |
| N12 | **Nav e2e sweep**: run the 39 area specs (§7) after N2–N11; triage fail-closed hydration diagnostics | e2e/* | L | all |

---

## 5. Client-routing and persistence interaction (the riskiest area)

**Persisted roots in zudo-doc (M)** — `grep -rn "data-zfb-transition-persist" packages/zudo-doc/src src pages …`:

| Persisted element | Persist key | Nested islands inside it |
|---|---|---|
| `header/header.tsx:386` `<header>` | `header-${lang}` | **SidebarToggle** (`visible`), **ThemeToggle** (`load`) |
| `doclayout/doc-layout.tsx:419` `<aside id=desktop-sidebar>` | `sidebarPersistKey` (locale + nav section) | **SidebarTree** (`load`) |
| `footer/footer.tsx:98` | `persistKey` | none seen (U) |
| the `<button>` INSIDE the DesktopSidebarToggle island | `desktop-sidebar-toggle` | the element is itself an island's owned child |
| the `<button>` INSIDE the DesktopTocToggle island | `desktop-toc-toggle` | the element is itself an island's owned child |

**v3 runtime behaviour (R: zfb `packages/zfb/src/runtime.ts@v3.0.0`, lines ≈432-650)**:
- `unmountIslands(body, incomingBody)` skips only islands whose own element carries a persist id that is present in
  the incoming body. It **disposes** every island nested inside a persisted `<header>` or `<aside>`: handle released,
  DOM left in place.
- `swapBodyElement` (`zfb-runtime/src/client-router/swap-functions.ts:~188-230`) refreshes identity and props only
  when the persisted element is itself an island root.
- `mountNewIslands` then finds a lifted nested island that has no handle and no remount flag, and calls
  **`hydrate`** on DOM the previous page's client state has already mutated. Under v3's fail-closed preflight, any
  structural difference makes the island inert (`ZR_HYDRATION_MISMATCH`).
- Concrete case (I): the ThemeToggle icon branch for "light" (`<circle>+<path>`) versus the SSR default "system" (one `<path>`). For a
  light-mode user, the header toggle would go inert after the first soft navigation. The same applies to SidebarTree
  categories expanded from sessionStorage inside the persisted aside.
- With `data-zfb-island-remount`, the runtime disposes and calls `render` → `mount` → `container.replaceChildren(fragment)`
  (R: zudo-react/hydrate.ts:1123). That path is safe but loses client state.
- **zudo-doc's `nested-island-props-refresh.ts`** already sets the remount flag and copies `data-props`, but only for the
  header, and only `data-props`. It must copy the complete v3 metadata and should cover the persisted aside as well.
  Its "known gap" comment (the listener is installed lazily by a `visible` island) matters more in v3.
- This contradicts contract line 461 ("Persisted ancestors preserve descendant islands by matching each
  descendant's boundary identity under the retained DOM"). No v3 test covers it: `persist-island-lifecycle.test.ts`
  cases are all persisted island roots. **Upstream candidate.**
- DesktopToggles: the router moves the live `<button>` (an owned node of an island whose handle was just disposed) into
  the new wrapper, replacing the SSR button between fresh `zr:` markers. The icon branch structure is the same (`svg>path`), so preflight probably passes
  (I). This pattern is outside the v3 contract, which recommends a persist attribute on a full hand-authored wrapper.

Other routing touch points:
- `ensureNestedIslandPropsRefresh()` and `ensureSidebarScrollPreserve()` run as island-module top-level side effects in the
  shared bundle (still valid in v3).
- `theme-pack-provider.tsx` mutates `event.newDocument` on BEFORE_SWAP.
- `ClientRouter preserveHtmlAttrs` keeps `data-sidebar-hidden`, `data-toc-hidden` and the theme attributes.

---

## 6. zudo-react static-render attribute allowlist (measured against @takazudo/zfb@3.0.0)

`node scratchpad/explore/islands-nav/probe.mjs`, which renders with `dist/zudo-react/server.js` from `npm pack @takazudo/zfb@3.0.0`:

```
svgXmlns   FAIL ZR_ATTRIBUTE: svg.xmlns          scriptDefer FAIL script.defer     scriptAsync FAIL script.async
metaProperty FAIL meta.property (OGP)           linkAs FAIL link.as              aHreflang FAIL a.hreflang
inputInputmode FAIL input.inputmode             inputForm FAIL input.form        buttonPopovertarget FAIL
divPopover FAIL div.popover                      imgFetchpriority FAIL            svgFocusable FAIL svg.focusable
iframeSrcdoc FAIL iframe.srcdoc                  inputAutocap FAIL autocapitalize/enterkeyhint   textareaWrap FAIL
styleCamel FAIL ZR_STYLE paddingLeft             classNameProp FAIL ZR_PROP_DIALECT  onClick FAIL ZR_PROP_DIALECT
OK: inert, aria-hidden=false, dialog open=false, style string, kebab/custom-prop style, html lang + data-*, meta charset,
    select multiple (static), details name, kbd, role menuitemradio, tabindex, data-*=true → "true", numeric style → "left:10" (no px)
```

- **Cause (R)**: `render-html.ts` lines 13-31 hold a closed `commonAttrs` / `htmlAttrs` / `svgAttrs` set, and it applies to **every** render,
  static pages included, not just islands.
- **zudo-doc exposure (M)** — `grep -rnE '<pat>' packages/zudo-doc/src src pages --include='*.tsx' | grep -v __tests__ | wc -l`:
  - `xmlns=` 43
  - `property="` 9 (OGP meta in head/og-tags.tsx and head-with-defaults)
  - `focusable=` 6
  - `srcdoc/srcDoc` 2
  - `popover=` 1 (ThemeToggle)
  - `async` script 1 (head-with-defaults:352 `s.async`)

---

## 7. Tests in the area

- **Unit tests**: 43 files; 28 of them use Preact `render` / `preact-render-to-string` / `preact/test-utils` (list: scratchpad/.../preact-tests.txt). They run
  under happy-dom per file (`/** @vitest-environment happy-dom */`).
- **Directories**: sidebar-toggle-island (2), desktop toggles (1 each), sidebar-tree-island (5), site-tree-nav-island (3), toc (5),
  theme (4), theme-toggle (3), theme-pack-switcher (4), theme-pack-dialog (3), sidebar-resizer (1), prepaints (1 each),
  page-loading (2), client-router (1), transitions (1), inline-version-switcher (1), i18n-version (4).
- **e2e specs (39)**:
  - i18n: i18n-language-switcher, i18n-sidebar-fallback, i18n-vt-chrome-persist
  - sidebar: sidebar-filter, sidebar-hard-reload-flash, sidebar-note-tray(-dist), sidebar-resizer-{hit-area,restore,spa-nav-width},
    sidebar-spa-nav-flash, sidebar-toc-toggle, sidebar-toggle-layout
  - smoke: smoke-asset-details-rail-toggle, smoke-client-router-back-race, smoke-home-secondary-nav, smoke-loading-overlay,
    smoke-mobile-drawer-section-swap, smoke-mobile-sidebar, smoke-mobile-toc, smoke-sidebar-toggle-icon-cascade, smoke-toc-markup,
    smoke-toc, smoke-visual-vt-chrome-persist, smoke-vt-chrome-persist
  - theme: theme-html-preview-highlight, theme-pack-fonts, theme-pack-sidebar-active, theme-pack-spa-nav-flash,
    theme-pack-switcher, theme-pack-zdtp-interplay, theme-panel-persistence, theme-panel-repaint, theme-syntax-highlight,
    theme-toggle
  - versioning: versioning-navigation, versioning-spa-nav-availability, versioning-vt-chrome-persist, versioning
- The **vt-chrome-persist** trio and **mobile-drawer-section-swap** are the specs that will surface the §5 behaviour.

---

## 8. Upstream candidates (evidence summary, do not file)
1. **bug**: the closed attribute allowlist rejects standard attributes (§6).
2. **bug/docs**: descendant islands of a persisted non-island ancestor are disposed and then re-hydrated over mutated DOM, which contradicts contract line 461 (§5).
3. **gap**: no persist option on the SDK `Island`. Persisting an island root requires a hand-authored wrapper with full metadata (contract 461).
4. **dx**: top-level and nested `undefined` props fail SSR (`ZR_PROPS_UNDEFINED`), whereas 2.x `JSON.stringify` dropped them silently. The migration guide does not call this out (§3).
5. **gap**: the scanner still registers every exported function of a `"use client"` module (hooks and helpers) under a global name with first-wins collisions (zudo-doc #3257). Under the v3 hard identity check this has a bigger impact.
6. **dx**: the `Style` type accepts numbers, and a numeric length is emitted unitless (`left:10`), so the result is silently invalid CSS. This is documented in components-and-jsx.mdx:35, but nothing warns at build time.
7. **docs/U**: auto-shipping the ClientRouter from package-owned layouts under node_modules. Verify in the dogfood run whether zudo-doc's `ClientRouterBootstrap` island is still needed.
8. **gap**: there are no portals and no `popover` attribute. A top-layer menu inside a stacking-context header (ThemeToggle) has no supported spelling other than setting the property through a ref.
