# v2-safe CSS prep: fix build-breaking utility candidates and move v1-unsupported utilities to authored CSS, verified on v2

Owner: [#4435](https://github.com/zudolab/zudo-doc/issues/4435). Status: **implemented; manager-run browser parity passed before the focused preview shadow correction, with final parity rerun pending**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

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
| Manager-run #4435 browser/static computed-style parity | 789-page parent/topic builds passed; 65-state browser comparison had zero differences. Focused preview iframe probe found one computed `box-shadow` mismatch, corrected in this recovery. Final manager parity rerun pending. |
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

## #4435 implementation and verification (2026-09-30)

The v2 package build and targeted tests pass. The rebuilt `packages/zudo-doc/dist/compiled.css` is tracked and committed; its pre-change counterpart in the main checkout provided the selector/property comparison below. The manager ran the browser and scripted-state capture after the initial topic implementation, then isolated one preview iframe shadow mismatch with a focused probe. The authored correction below awaits the manager's final parity rerun.

| Mapped construct | Final class / rule and v2 CSS evidence | Cascade and state review |
| --- | --- | --- |
| Nine calc tokens in DocLayout, DocHistory, SidebarToggle/Tree, SiteTreeNav, ThemePackDialog/Switcher, LanguageSwitcher and CardList; plus TOC | Operators use `_+_` or `_-_`. The local v2 compiled CSS contains the expected spaced `calc(...)` declarations; all nine distinct tokens returned `resolved utility` from scratch zfb 3.0.0 `wind explain`. | Utility remains unlayered; its winner and specificity are unchanged. The manager's 65-state browser comparison covered the mapped breakpoint states and found zero differences. |
| Footer arbitrary descendant variants | `zd-footer-copyright-links` in `features.css` emits static underline and accent on link hover/focus-visible. | Old selector was `.\[&_a...\]... a` (class + descendant; hover/focus adds a pseudo-class); new selector has the same specificity and remains unlayered. The old hover selector had no `(hover: hover)` media wrapper, so the authored hover preserves its interaction behavior. Manager browser hover/focus states had zero differences. |
| List, breadcrumb, card-link and summary arbitrary selectors | `zd-list-items-no-margin`, `zd-breadcrumb-nav-no-margin`, `zd-card-links-interactive`, `zd-hide-details-marker`. | The old relation selectors were class + descendant (or class + pseudo-element); the new selectors preserve that specificity and are unlayered. Their declarations are `margin-bottom: 0`, `pointer-events: auto`, and marker `display: none`. The prior zero used `var(--spacing-0)`, defined as zero. Manager browser states covering these selectors had zero differences. |
| Ring, wrapping, preview shadow, search excerpt decoration | `zd-theme-pack-active-ring`, `zd-wrap-anywhere`, `zd-preview-shadow`, `zd-search-excerpt-decoration`. | The frozen v2 full site CSS and package compiled CSS include `.ring-2` and `.ring-accent`, which compose a 2px accent `box-shadow`; the authored rule gives the same value on the selected button. `wrap-anywhere` and `decoration-muted` declarations are copied. The preview shadow retains both the old non-color-mix `var(--color-fg)` fallback and the same `@supports (color: color-mix(in lab, red, red))` color-mix branch. The manager's focused computed probe then found that the old Tailwind declaration also included four transparent 0px shadow layers before the colored layer. Both authored branches now preserve those layers; the public `features.css` export is copied verbatim, and the package compiled CSS is rebuilt. The manager's 65-state browser pass found zero differences; the focused iframe correction awaits its final parity rerun. |
| `animate-spin`, `animate-pulse` | Removed as dead utilities. | The frozen v2 full site CSS (all 31 files) has no `.animate-spin`, `.animate-pulse`, `@keyframes spin`, or `@keyframes pulse`, so the baseline computed animation name is `none` in spinner and dialog loading states. Adding authored keyframes would violate the replicate-v2 gate. Any animation is a separate future feature/fix, not part of this migration. |
| Dead utilities | Removed `2xl:w-[24px]`, `max-w-sm`, `shadow-md`, `rounded-md`, and `py-hsp-3xs`. | None has a matching rule in baseline v2 compiled CSS; removing class tokens changes no CSS declarations. `w-[18px]` remains on the site-tree icon at all breakpoints. |

The new unlayered authored rules are appended to `features.css` after its existing rules. Utilities in the v2 compiled sheet precede imported authored feature rules, so a same-property authored rule is the winner. For relation selectors, specificity is retained. No `content.css` or showcase `global.css` addition was needed. This follows `architecture/mdx-component-architecture.mdx`, `architecture/cascade-layers.mdx`, and `states-and-transitions/hover-focus-active-states.mdx` in zudo-css-wisdom. No raw HTML site was added or changed.

Additional call-site files from the measured CSS-wind map: `packages/zudo-doc/src/toc/toc.tsx` and `packages/zudo-doc/src/find-in-page/find-bar.tsx`. The manager also authorized `packages/zudo-doc/scripts/gen-search-widget-script.mjs` for the frozen script source and six assertion-only test files. The script was regenerated and its pinned CSP hash changed to `sha256-bZZerp93WLjx9nweghnPDSFYOUZEhrBxSQ0oDGWM2qQ=`.

Checks before the recovery: `pnpm check` passed; six targeted package test files passed (93 tests); `pnpm check:search-widget-drift` passed after staging the generated artifact; `pnpm --filter @takazudo/zudo-doc build` passed; `git diff --check` passed. Scratch zfb 3.0.0 `wind explain` returned `resolved utility` for all nine distinct changed calc spellings (`/tmp/zudo-doc-4435-wind/results.tsv`). The manager ran `pnpm test` on the topic: all 3397 package tests passed.

Manager parity evidence at topic `86c555978228131fc05a83570061986de9f2c6c1`: guarded parent and topic site builds each produced 789 pages. The static report (`/home/takazudo/.cache/zudo-doc-zfb3-parity/4435-css-prep/parent-to-topic.json`) records 787 DOM differences, each the one-line inline search script replacement (`decoration-muted` → `zd-search-excerpt-decoration`); 787 class-set differences from the mapped rewrites; one CSS selector-inventory difference; and zero route or island differences. The 65-state browser report (`parent-to-topic-browser.json` in the same directory) found zero computed-style or state differences. A separate focused probe (`parent/computed-probe.json` and `topic/computed-probe.json`) found exactly one mismatch: the HtmlPreview iframe's parent computed `box-shadow` had four transparent 0px layers before `color(srgb 0.0795106 0.0715583 0.0642659 / 0.08) 0px 1px 3px 0px`, while the topic had only the colored layer. This recovery restores the four transparent layers in both authored branches. Final manager browser/static parity after this correction remains pending.

The guarded package slow suite has `verdict=FAIL` on both exact parent `523b6db86325377a796dbb0e1382a6ca8c6d236f` and topic `86c555978228131fc05a83570061986de9f2c6c1`: the same three A2 no-stub normalized-HTML SHA snapshots fail, while the other 125 tests pass. The received hashes differ because this topic intentionally changes class strings and the inline search script. The parent and topic logs are `/tmp/zudo-doc-4435-parent-slow.log` and `/tmp/zudo-doc-4435-slow.log`. This satisfies the issue's corrected no-new-failures baseline, not a green slow-suite claim; #4470 owns the A2 snapshot rebaseline after v3 parity.
