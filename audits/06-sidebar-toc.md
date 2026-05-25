# S6 Audit: Sidebar, TOC, and Breadcrumbs

> Source branch: `zfb-feature-audit/s6-sidebar-toc`
> Generated: 2026-05-04
> Build: `pnpm build` — 217 pages built in 30.71 s (clean exit, 0 errors)
> Verifier: static dist/ inspection + island source analysis

---

## Legend

- **PASS** — feature confirmed working as documented
- **DEFERRED** — interactive behavior (toggle, drag, scroll spy, localStorage) not verifiable without a browser; code path is present and structurally correct
- **NOT WIRED** — component exists in `src/` but is not imported by any page template; feature is absent from built HTML
- **PARTIAL** — some aspects pass, some deferred or missing

---

## Results

| Feature ID | Status | Evidence / Notes |
|---|---|---|
| filesystem-sidebar-tree | PASS | `buildNavTree()` in `src/utils/docs.ts` assembles `NavNode[]` from collection; serialized tree found in `data-props` of `data-zfb-island="Sidebar"` on every doc page; directory structure faithfully reflected |
| _category_.json label+position | PASS | `loadCategoryMeta()` reads `_category_.json` from each dir; `label` and `position` consumed by `toNavNodes()`; verified in built sidebar props JSON (e.g. Guides at position 1) |
| _category_.json noPage | PASS | `noPage: true` sets `href: undefined` on the nav node in `toNavNodes()`; verified in `src/content/docs/claude-md/_category_.json` (noPage=true); dir exists in dist (`dist/docs/claude-md/`) but the category node carries no page href in sidebar |
| sidebar_position ordering | PASS | Sidebar tree props confirm ascending sort by position: Configuration(1) → Frontmatter(2) → Sidebar(3) → Header Nav(4) → Sidebar Filter(4) → Header Right Items(4.1) → Search(5) … |
| sidebar_label override | PASS | `toNavNodes()` prefers `doc.data.sidebar_label` over `title`; e.g. `hide-sidebar.mdx` has `sidebar_label: Hide Sidebar` vs title `Demo: Hide Sidebar`; verified in serialized sidebar props |
| unlisted: true | PASS (code path only — no live example) | `isNavVisible()` in `src/utils/docs.ts` returns `false` when `doc.data.unlisted === true`; sidebar builder filters via `docs.filter(isNavVisible)`; **no content page currently has `unlisted: true` in its frontmatter** (only appears in code-example blocks in `guides/frontmatter.mdx`); feature is correctly implemented but untestable without an actual unlisted page |
| hide_sidebar frontmatter | PASS | `hide-sidebar.mdx` has `hide_sidebar: true`; DocLayoutWithDefaults receives `hideSidebar={entry.data.hide_sidebar}`; built HTML: `<aside id="desktop-sidebar" … class="sr-only">` (visually hidden, not absent) vs normal page: `class="hidden lg:block fixed …"` |
| hide_toc frontmatter | PASS | `hide-toc.mdx` has `hide_toc: true`; `shouldRenderDefaultToc = !props.hideToc && tocHeadings.length > 0`; built HTML for `hide-toc/index.html` has NO `data-zfb-island="Toc"` or `="MobileToc"` markers (islands conditionally dropped) |
| hide_both frontmatter | PASS | `hide-both.mdx` has both `hide_sidebar: true` + `hide_toc: true`; built HTML: `<aside … class="sr-only">` AND no Toc/MobileToc islands |
| sidebar-toggle island (mobile) | PASS (interactive DEFERRED) | `SidebarToggle` component exists at `src/components/sidebar-toggle.tsx`; wraps `SidebarTree` and renders hamburger button + slide-in `<aside>`; wired in `pages/lib/_header-with-defaults.tsx` via `Island({when:"load"})`; `data-zfb-island="SidebarToggle"` confirmed in all doc page HTML; open/close state + body scroll-lock + AFTER_NAVIGATE_EVENT close — interactive verification deferred to browser |
| sidebar-toggle DesktopSidebarToggle | NOT WIRED | `src/components/desktop-sidebar-toggle.tsx` exists (correct `localStorage` toggle using `zudo-doc-sidebar-visible` key + `data-sidebar-hidden` attribute); CSS at `global.css:812` styles `.zd-desktop-sidebar-toggle`; **no page template imports or mounts the component** — not present in any built HTML; this is a `create-zudo-doc` feature-injection slot (gated by `sidebarToggle: true` setting) that is not self-wired in the host |
| sidebar-resizer island | PARTIAL — NOT WIRED IN HOST | `packages/zudo-doc-v2/src/sidebar-resizer/index.ts` exports `initSidebarResizer()` (idempotent drag-handle attach, localStorage `zudo-doc-sidebar-width`, CSS var `--zd-sidebar-w`); `src/scripts/sidebar-resizer.ts` also has a parallel host implementation; **no page template calls `initSidebarResizer()`**; `data-sidebar-resizer` attribute absent from all built HTML; feature is implemented but not activated in the host project's page layer (setting `sidebarResizer: true` exists but the call site is missing) |
| sidebar-filter | PASS (interactive DEFERRED) | `filterTree()` at line 125 of `sidebar-tree.tsx`; filter `<input>` rendered with `ref={filterRef}`; keyboard shortcut Cmd/Ctrl+/ binds to the input; `filteredNodes` computed via `useMemo`; code path verified; runtime filtering deferred |
| site-tree-nav | PASS | `pages/lib/_site-tree-nav.tsx` wraps `SiteTreeNavDemo` from `@zudo-doc/zudo-doc-v2/nav-indexing`; `src/components/site-tree-nav.tsx` provides the interactive collapsible tree; both registered in `pages/_mdx-components.ts`; MDX pages (e.g. `components/site-tree-nav.mdx`) use `<SiteTreeNav>` tag |
| category-nav | PASS | `pages/lib/_category-nav.tsx` wraps v2 `CategoryNav`; loads locale-aware docs, finds category node via `findNode()`, filters to `hasPage` children; wired via `createMdxComponents()` |
| category-tree-nav | PASS | `pages/lib/_category-tree-nav.tsx` wraps v2 `CategoryTreeNav`; builds full tree + `groupSatelliteNodes()`, finds target node; wired via `createMdxComponents()` |
| TOC island (desktop) | PASS (scroll spy DEFERRED) | `packages/zudo-doc-v2/src/toc/toc.tsx` exports `Toc`; `DocLayoutWithDefaults` wraps it in `Island({when:"load"})` when `!hideToc && headings.length > 0`; `data-zfb-island="Toc"` confirmed on normal pages, absent on hide-toc pages; `useActiveHeading` hook implements IntersectionObserver-based scroll spy — interactive verification deferred |
| mobile-toc island | PASS (interactive DEFERRED) | `packages/zudo-doc-v2/src/toc/mobile-toc.tsx` exports `MobileToc`; same condition as desktop TOC (`shouldRenderDefaultToc`); `data-zfb-island="MobileToc"` confirmed on normal pages, absent on hide-toc pages; toggle open/close deferred |
| breadcrumbs | PASS | `packages/zudo-doc-v2/src/breadcrumb/breadcrumb.tsx` + `buildBreadcrumbs()` in `src/utils/docs.ts`; `<nav aria-label="Breadcrumb">` confirmed in built HTML on every doc page (including hide-sidebar, hide-both, normal pages); `breadcrumbOverride={<Breadcrumb items={breadcrumbs} />}` in `pages/docs/[...slug].tsx` |
| category-collapse | PASS (interactive DEFERRED) | `SidebarTree` tracks open categories in `sessionStorage` key `zd-sidebar-open`; `getOpenSet()`/`saveOpenSet()` persist across navigations; `CategoryNode` renders a toggle chevron button with `aria-expanded`; expand/collapse deferred to browser |

---

## Summary

- **15 PASS** (7 fully verified by dist HTML, 8 code path confirmed, interactive behavior deferred)
- **1 PARTIAL** (sidebar-resizer code exists but initSidebarResizer() never called in host pages)
- **1 NOT WIRED** (DesktopSidebarToggle component defined in src/ but not imported by any page template)

### Key findings

1. **`sidebar-resizer` not activated**: `settings.sidebarResizer: true` is set but no page template calls `initSidebarResizer()` (from either `packages/zudo-doc-v2/src/sidebar-resizer/index.ts` or `src/scripts/sidebar-resizer.ts`). The `data-sidebar-resizer` drag handle never attaches. The feature is a `create-zudo-doc` feature-injection slot that requires an explicit call site in the doc layout — the host project page layer does not have it.
2. **`DesktopSidebarToggle` not mounted**: The component (`src/components/desktop-sidebar-toggle.tsx`) is complete and CSS is in place, but zero pages import or render it. Like the resizer, this is a `create-zudo-doc` injection-point feature. The `sidebarToggle` setting gates it in generated scaffolds but the host project's `pages/docs/[...slug].tsx` does not include it.
3. **No live `unlisted: true` page exists**: The frontmatter field is correctly implemented in `isNavVisible()` but cannot be end-to-end verified from dist because no content page actually uses it. The code path is correct.
4. **`hide_sidebar` uses `sr-only` (not DOM removal)**: The sidebar `<aside>` remains in HTML (accessible to mobile nav via JS) but is `sr-only`-classed on hide-sidebar and hide-both pages — correct behavior for mobile nav continuity.
5. **`hide_toc` correctly drops TOC islands**: The conditional `shouldRenderDefaultToc = !hideToc && headings.length > 0` in `DocLayoutWithDefaults` means TOC island markers are entirely absent from hide-toc and hide-both pages' HTML.

---

## Deferred (requires browser)

- Toggle/collapse animations (sidebar-toggle mobile slide-in, MobileToc open/close)
- Category collapse sessionStorage persistence across navigation
- TOC scroll spy `aria-current` on headings
- Sidebar filter live narrowing on keypress
- `sidebarToggle` localStorage persistence (when DesktopSidebarToggle is wired)
- `sidebarResizer` drag handle (when initSidebarResizer() is called)

---

## Follow-up issues

### Issue 1: sidebar-resizer not activated in host pages

**Signature:** `sidebarResizer: true` set; `initSidebarResizer()` never called  
**File:** `pages/docs/[...slug].tsx` (and locale variant) — missing `initSidebarResizer()` call-site or `afterSidebar` slot wiring; `src/scripts/sidebar-resizer.ts` and `packages/zudo-doc-v2/src/sidebar-resizer/index.ts` both exist but are dead code in the running site  
**Impact:** Sidebar drag-to-resize is completely non-functional in the host project despite `sidebarResizer: true`

### Issue 2: DesktopSidebarToggle not wired in host pages

**Signature:** `sidebarToggle: true` set; `DesktopSidebarToggle` component defined but never imported or rendered  
**File:** `src/components/desktop-sidebar-toggle.tsx` exists; `pages/docs/[...slug].tsx` has no import or `afterSidebar` slot usage; built HTML never contains `.zd-desktop-sidebar-toggle` button  
**Impact:** Desktop sidebar collapse/expand toggle button is absent from all pages; persistence via localStorage key `zudo-doc-sidebar-visible` is dead code
