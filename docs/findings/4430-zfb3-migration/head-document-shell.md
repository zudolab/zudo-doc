# Port the head and document shell (head, doclayout incl. its persist wrapper, theme providers, prepaint scripts, page loading, sidebar resizer)

Owner: [#4458](https://github.com/zudolab/zudo-doc/issues/4458). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/doclayout/anchors.ts` | `DocLayoutAnchorId` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/anchors.ts` | `DocLayoutAnchorKind` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/anchors.ts` | `DocLayoutAnchor` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/anchors.ts` | `DOC_LAYOUT_ANCHORS` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/anchors.ts` | `anchorComment` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/anchors.ts` | `allAnchorComments` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/anchors.ts` | `DOC_LAYOUT_ANCHOR_IDS` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/doc-layout-with-defaults.tsx` | `DocLayoutWithDefaultsProps` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/doc-layout-with-defaults.tsx` | `DocLayoutWithDefaults` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/doc-layout.tsx` | `DocLayoutHtmlAttrs` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/doc-layout.tsx` | `DocLayoutProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/doc-layout.tsx` | `DESKTOP_SIDEBAR_ID` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/doc-layout.tsx` | `DocLayout` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doclayout/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head-with-defaults/index.tsx` | `HeadWithDefaultsProps` | raw injection → reviewed rawHtml; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head-with-defaults/index.tsx` | `HeadWithDefaultsSettings` | raw injection → reviewed rawHtml; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head-with-defaults/index.tsx` | `faviconType` | raw injection → reviewed rawHtml; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head-with-defaults/index.tsx` | `faviconHref` | raw injection → reviewed rawHtml; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head-with-defaults/index.tsx` | `resolveFaviconLinks` | raw injection → reviewed rawHtml; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head-with-defaults/index.tsx` | `createHeadWithDefaults` | raw injection → reviewed rawHtml; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/doc-head.tsx` | `DocHead` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/og-tags.tsx` | `OgTags` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/og-tags.tsx` | `OgInputs` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/twitter-card.tsx` | `TwitterCard` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/types.ts` | `HeadProps` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/types.ts` | `HeadStylesheet` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/types.ts` | `HeadPreconnect` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/types.ts` | `HeadPreload` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/types.ts` | `HeadMeta` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/types.ts` | `HeadAlternateLink` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx` | `PAGE_LOADING_OVERLAY_ID` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx` | `PageLoadingOverlayProps` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx` | `buildPageLoadingOverlayBootstrap` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx` | `show` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx` | `hide` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx` | `setPending` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx` | `clearPending` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx` | `PageLoadingOverlay` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx` | `SidebarPrepaintProps` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx` | `SidebarPrepaintSettings` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx` | `sidebarPrepaintActive` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx` | `SIDEBAR_VISIBILITY_PREPAINT_SCRIPT` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx` | `createSidebarVisibilityPrepaint` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx` | `createSidebarPrepaint` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-resizer/index.ts` | `initSidebarResizer` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx` | `SIDEBAR_RESIZER_INIT_SCRIPT` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx` | `SidebarResizerInit` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx` | `SIDEBAR_RESIZER_RESTORE_SCRIPT` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx` | `SidebarResizerRestore` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx` | `ColorSchemeProviderColorMode` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx` | `ColorSchemeProviderProps` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx` | `buildColorModeBootstrap` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx` | `applyTheme` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx` | `onNavigate` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx` | `onMediaChange` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx` | `ColorSchemeProvider` | raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `THEME_PACK_LOADING_ATTR` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `THEME_PACK_LOAD_WATCHDOG_MS` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `THEME_PACK_LATCH_CSS` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `ThemePackProviderProps` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `themePackVersionMap` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `resolveThemePackSsrSlug` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `buildThemePackBootstrap` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `resolveSlug` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `packHref` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `hasPackLink` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx` | `ThemePackProvider` | raw injection → reviewed rawHtml | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/toc-prepaint/index.tsx` | `TocPrepaintProps` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/toc-prepaint/index.tsx` | `TocPrepaintSettings` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/toc-prepaint/index.tsx` | `tocPrepaintActive` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/toc-prepaint/index.tsx` | `TOC_VISIBILITY_PREPAINT_SCRIPT` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/toc-prepaint/index.tsx` | `createTocVisibilityPrepaint` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/toc-prepaint/index.tsx` | `createTocPrepaint` | raw injection → reviewed rawHtml; Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/head/serialize-static-head.ts` (new) | `bounded static-head serializer` | temporary #3359 rawHtml escape/ordering shim; release blocked | pending; pinned contract and locked spec |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| `packages/zudo-doc/src/doclayout/doc-layout-with-defaults.tsx:437` | `<script dangerouslySetInnerHTML={{ __html: VERSION_SWITCHER_INIT_SCRIPT }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/doclayout/doc-layout.tsx:233` | `* Scripts / inline \`<script>\` islands rendered last in \`</body>\`.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/head-with-defaults/index.tsx:299` | `note, #2822). Emits the anti-FOUC latch <style>, then the pre-paint` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/head-with-defaults/index.tsx:318` | `{settings.sidebarResizer && <script dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_RESTORE_SCRIPT }} />}` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/head-with-defaults/index.tsx:375` | `dangerouslySetInnerHTML={{` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx:11` | `//   2. A \`<style>\` block that owns the overlay + spinner CSS plus the` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx:13` | `//      \`dangerouslySetInnerHTML\` (matching the ColorSchemeProvider` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx:15` | `//   3. A small \`<script>\` that toggles the \`data-visible\` attribute on` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx:80` | `* inline \`<style>\` block here — a \`<style>\` inside \`<body>\` violates HTML5` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx:96` | `<script` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/page-loading/page-loading-overlay.tsx:97` | `dangerouslySetInnerHTML={{` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx:7` | `//   1. createSidebarVisibilityPrepaint — the pre-paint inline \`<script>\` that` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx:50` | `* Shared gate for BOTH sidebar-prepaint factories: the head pre-paint \`<script>\`` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx:85` | `* Returns the pre-paint \`<script>\` (for the page \`<head>\`) when` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx:100` | `<script` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx:101` | `dangerouslySetInnerHTML={{ __html: SIDEBAR_VISIBILITY_PREPAINT_SCRIPT }}` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-prepaint/index.tsx:124` | `* visibility-restore \`<script>\` is NOT emitted here — it is hoisted into the` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx:5` | `// a JSX component that emits the full init logic as a dangerouslySetInnerHTML` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx:6` | `// <script> so the body-end script slot gets self-contained browser code that` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx:36` | `// \`<script>\` intended for \`<head>\` that reads \`zudo-doc-sidebar-width\`,` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx:48` | `// string so it can be injected via dangerouslySetInnerHTML.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx:197` | `* \`dangerouslySetInnerHTML\` script so it runs without a module import.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx:206` | `<script dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_INIT_SCRIPT }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx:243` | `<script` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx:244` | `dangerouslySetInnerHTML={{ __html: SIDEBAR_RESIZER_RESTORE_SCRIPT }}` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx:6` | `// hydration: it just emits a <style> + <script> pair the engine streams` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx:8` | `// \`define:vars\`; the JSX equivalent is \`dangerouslySetInnerHTML\` with the` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx:46` | `* the \`<style>\` body for us — this component just emits it.` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx:120` | `<style dangerouslySetInnerHTML={{ __html: cssText }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/color-scheme-provider.tsx:121` | `{bootstrap !== null && <script dangerouslySetInnerHTML={{ __html: bootstrap }} />}` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx:10` | `//   1. A build-static anti-FOUC latch \`<style>\` (\`THEME_PACK_LATCH_CSS\`) —` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx:15` | `//   2. An inline \`<script>\` that resolves the active pack slug` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx:44` | `//     on \`<html>\`, which the latch \`<style>\` turns into a hidden body — but` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx:177` | `* The latch rule, emitted as a build-static \`<style>\` BEFORE the bootstrap` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx:308` | `* Server-rendered head fragment: the anti-FOUC latch \`<style>\`, the pre-paint` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx:309` | `* bootstrap \`<script>\`, and the \`<noscript>\` configured-pack fallback. No` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx:328` | `<style dangerouslySetInnerHTML={{ __html: THEME_PACK_LATCH_CSS }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme/theme-pack-provider.tsx:329` | `<script dangerouslySetInnerHTML={{ __html: bootstrap }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/toc-prepaint/index.tsx:8` | `//   1. createTocVisibilityPrepaint — the pre-paint inline \`<script>\` that` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/toc-prepaint/index.tsx:53` | `* Shared gate for BOTH toc-prepaint factories: the head pre-paint \`<script>\`` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/toc-prepaint/index.tsx:91` | `* Returns the pre-paint \`<script>\` (for the page \`<head>\`) when` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/toc-prepaint/index.tsx:106` | `<script` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/toc-prepaint/index.tsx:107` | `dangerouslySetInnerHTML={{ __html: TOC_VISIBILITY_PREPAINT_SCRIPT }}` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/toc-prepaint/index.tsx:129` | `* \`undefined\` otherwise. The pre-paint visibility-restore \`<script>\` is NOT` | pending per-site review; R-RAW; identify producer/trust and disposal |

The locked #3359/#3360 workaround introduces additional opaque markup; enumerate its serializer and call sites here, including escaping tests and the removal gate.

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/doclayout/doc-layout.tsx` | `h-[calc(100vh-3.5rem)]` | #4435 canonical underscore-space operators; preserve mathematical value | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/doclayout/doc-layout.tsx` | `min-h-[calc(100vh-3.5rem)]` | #4435 canonical underscore-space operators; preserve mathematical value | pending owner/existing #4435 proof |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/doclayout/__tests__/doc-layout-client-router-gating.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doclayout/__tests__/doc-layout-preserve-html-attrs.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doclayout/__tests__/doc-layout-theme-pack.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doclayout/__tests__/doc-layout-with-defaults-toc-gating.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/head-with-defaults/__tests__/head-with-defaults.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/head-with-defaults/__tests__/theme-pack-head.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/head/__tests__/doc-head.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/page-loading/__tests__/page-loading-css.test.ts` — pending port/run result.
- `packages/zudo-doc/src/page-loading/__tests__/page-loading-overlay.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/sidebar-prepaint/__tests__/sidebar-prepaint-ssg.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/sidebar-resizer/__tests__/geometry-parity.test.ts` — pending port/run result.
- `packages/zudo-doc/src/toc-prepaint/__tests__/toc-prepaint-ssg.test.tsx` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
