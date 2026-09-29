# v2-safe CSS prep: fix build-breaking utility candidates and move v1-unsupported utilities to authored CSS, verified on v2

Owner: [#4435](https://github.com/zudolab/zudo-doc/issues/4435). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/content.css` | `module / template` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/features.css` | `module / template` | Tailwind directives → authored properties/wind manifest; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/styles/global.css` | `module / template` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/content.css` | Authored cascade / reset / custom properties | W-CASCADE and locked reset; every utility overlap gets winner-before/after evidence | pending computed-style proof |
| `packages/zudo-doc/src/features.css` | Authored cascade / reset / custom properties | W-CASCADE and locked reset; every utility overlap gets winner-before/after evidence | pending computed-style proof |
| `src/styles/global.css` | Authored cascade / reset / custom properties | W-CASCADE and locked reset; every utility overlap gets winner-before/after evidence | pending computed-style proof |

## Tests and completion evidence

No colocated test file in the initial selected-source inventory. Use the issue acceptance tests and add a focused test only for the relevant behavior.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |

## Complete planning gap-token assignment

| Original candidate | Exact mapped files | Locked treatment |
| --- | --- | --- |
| `py-[calc(var(--spacing-vsp-xs)+0.15rem)]` | packages/zudo-doc/src/sidebar-tree-island/index.tsx×1, packages/zudo-doc/src/site-tree-nav-island/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `[&_a]:underline` | packages/zudo-doc/src/footer/footer.tsx×2 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `[&_a:hover]:text-accent` | packages/zudo-doc/src/footer/footer.tsx×2 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `[&_a:focus-visible]:text-accent` | packages/zudo-doc/src/footer/footer.tsx×2 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `ring-2` | packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `ring-accent` | packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `h-[calc(100vh-3.5rem)]` | packages/zudo-doc/src/doclayout/doc-layout.tsx×1, packages/zudo-doc/src/sidebar-toggle-island/index.tsx×1, packages/zudo-doc/src/toc/toc.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `leading-none` | packages/zudo-doc/src/nav-indexing/note-tray-index-parts/index-list.tsx×2, packages/zudo-doc/src/nav-indexing/note-tray-index-parts/timeline.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `wrap-anywhere` | packages/zudo-doc/src/home-page/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `decoration-muted` | packages/zudo-doc/src/search-widget-script/generated-script.ts×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `shadow-md` | packages/zudo-doc/src/find-in-page/find-bar.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `max-w-sm` | packages/zudo-doc/src/theme-pack-dialog/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `rounded-md` | packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `py-hsp-3xs` | packages/zudo-doc/src/theme-pack-dialog/theme-pack-card.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `2xl:w-[24px]` | packages/zudo-doc/src/site-tree-nav-island/index.tsx×2 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `ease-in-out` | packages/zudo-doc/src/asset-page/components.tsx×1, packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx×1, packages/zudo-doc/src/desktop-toc-toggle-island/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `animate-spin` | packages/zudo-doc/src/doc-history/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `animate-pulse` | packages/zudo-doc/src/theme-pack-dialog/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `[&_li]:mb-0` | packages/zudo-doc/src/nav-indexing/note-tray-index-parts/index-list.tsx×1, packages/zudo-doc/src/nav-indexing/note-tray-index-parts/timeline.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `[&::-webkit-details-marker]:hidden` | packages/zudo-doc/src/nav-indexing/docs-sitemap.tsx×1, packages/zudo-doc/src/nav-indexing/site-tree-nav-demo.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `[&_nav]:mb-0` | packages/zudo-doc/src/breadcrumb/breadcrumb.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `[&_a]:pointer-events-auto` | packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `w-[calc(100vw-2rem)]` | packages/zudo-doc/src/theme-pack-dialog/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `max-w-[calc(100vw-2rem)]` | packages/zudo-doc/src/theme-pack-switcher/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `max-w-[calc(100vw-var(--spacing-hsp-xl))]` | packages/zudo-doc/src/i18n-version/language-switcher.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `min-h-[calc(100vh-3.5rem)]` | packages/zudo-doc/src/doclayout/doc-layout.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `h-[calc(100%-3rem)]` | packages/zudo-doc/src/doc-history/index.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `ml-[calc(var(--spacing-hsp-xl)+1px)]` | packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `mr-[calc(var(--spacing-hsp-xl)+1px)]` | packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
| `shadow-[0_1px_3px_color-mix(in_srgb,var(--color-fg)_8%,transparent)]` | packages/zudo-doc/src/html-preview-wrapper/preview-base.tsx×1 | Apply #4435 spec and normative W-CATALOG classification; record exact before/after computed result |
