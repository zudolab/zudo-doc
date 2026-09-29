# Port the doc-page composition layer (chrome incl. derive.tsx, doc-page-shell, renderer, metainfo, pager, body-end islands, sidebar-with-defaults)

Owner: [#4464](https://github.com/zudolab/zudo-doc/issues/4464). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/chrome/assert-chrome-context.ts` | `assertChromeContext` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `DEFAULT_SCHEME` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `DocHistoryStub` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `IslandPassthrough` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveDateFormats` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveComposeMetaTitle` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `resolveHostScheme` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveColorSchemeGenerators` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveNavDataPrep` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveSearchWidgetSlot` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveThemePackSwitcherProps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `skipsPackageDefaultDesignTokenPanel` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveBodyEndIslands` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveDocHistorySlot` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveGetUnavailableVersions` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveInlineVersionSwitcher` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/derive.tsx` | `deriveMdxComponents` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/index.tsx` | `createChrome` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/index.tsx` | `Chrome` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/primary-slots.tsx` | `resolvePrimarySlot` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome/primary-slots.tsx` | `derivePrimaryChromeSlots` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/index.tsx` | `BodyEndIslandsSettings` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/index.tsx` | `BodyEndIslandsDeps` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/index.tsx` | `BodyEndIslandsProps` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/index.tsx` | `createBodyEndIslands` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/theme-pack-switcher-island.tsx` | `ThemePackSwitcherIslandDeps` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end-islands/theme-pack-switcher-island.tsx` | `createThemePackSwitcherIsland` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end/index.tsx` | `DocBodyEndSettings` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-body-end/index.tsx` | `createDocBodyEnd` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-content-header/index.tsx` | `DocContentHeaderDeps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-content-header/index.tsx` | `createDocContentHeader` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-metainfo-area/index.tsx` | `DocHistoryMetaEntry` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-metainfo-area/index.tsx` | `DocMetainfoAreaSettings` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-metainfo-area/index.tsx` | `DocMetainfoAreaProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-metainfo-area/index.tsx` | `createDocMetainfoArea` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-renderer/index.tsx` | `RenderDocPageVersionConfig` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-renderer/index.tsx` | `RenderDocPageOptions` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-renderer/index.tsx` | `DocPageRendererDeps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-renderer/index.tsx` | `createRenderDocPage` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-shell/index.tsx` | `DocPageHeading` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-shell/index.tsx` | `DocPageBreadcrumbItem` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-shell/index.tsx` | `DocPageNavNode` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-shell/index.tsx` | `DocPageShellProps` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-shell/index.tsx` | `DocPageShellSettings` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-shell/index.tsx` | `DocPageShellDeps` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-page-shell/index.tsx` | `createDocPageShell` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-pager/index.tsx` | `DocPagerProps` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-pager/index.tsx` | `createDocPager` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-metainfo.tsx` | `DocMetainfoProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-metainfo.tsx` | `DEFAULT_CREATED_LABEL` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-metainfo.tsx` | `DEFAULT_UPDATED_LABEL` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-metainfo.tsx` | `ClockIcon` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-metainfo.tsx` | `RefreshIcon` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-metainfo.tsx` | `UserIcon` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-metainfo.tsx` | `DocMetainfo` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-tags.tsx` | `ResolvedTag` | Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-tags.tsx` | `TagPlacement` | Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-tags.tsx` | `DocTagsProps` | Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-tags.tsx` | `DEFAULT_TAGS_LABEL` | Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-tags.tsx` | `DEFAULT_TAGGED_WITH_LABEL` | Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/doc-tags.tsx` | `DocTags` | Preact child types → Child/Description; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/frontmatter-preview.tsx` | `FrontmatterCellRendererProps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/frontmatter-preview.tsx` | `FrontmatterCellRenderer` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/frontmatter-preview.tsx` | `FrontmatterPreviewProps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/frontmatter-preview.tsx` | `DEFAULT_FRONTMATTER_PREVIEW_TITLE` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/frontmatter-preview.tsx` | `DEFAULT_KEY_COL_LABEL` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/frontmatter-preview.tsx` | `DEFAULT_VALUE_COL_LABEL` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/frontmatter-preview.tsx` | `renderValue` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/frontmatter-preview.tsx` | `FrontmatterPreview` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/metainfo/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-with-defaults/index.tsx` | `SidebarWithDefaultsProps` | Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-with-defaults/index.tsx` | `createSidebarWithDefaults` | Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | pending scan confirmation |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/__tests__/fixtures/doc-history-dates-only/src/chrome-bindings.tsx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/doc-history-dates-only/src/config/settings.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/doc-history-dates-only/src/content/docs/getting-started/index.mdx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/doc-history-dates-only/tsconfig.json` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/doc-history-dates-only/zfb-shim.d.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/doc-history-dates-only/zfb.config.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/fake-chrome-context.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/resolution-chain/tsconfig.json` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/resolution-chain/zfb.config.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection-i18n/src/chrome-bindings.tsx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection-i18n/src/config/settings.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection-i18n/src/content/docs-ja/getting-started/index.mdx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection-i18n/src/content/docs/getting-started/index.mdx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection-i18n/tsconfig.json` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection-i18n/zfb-shim.d.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection-i18n/zfb.config.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/pages-stubs/404.tsx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/chrome-bindings-host-panel.tsx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/chrome-bindings.tsx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/config/settings.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/content/docs/getting-started/coverage.mdx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/content/docs/getting-started/index.mdx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/design-token-panel-config.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/src/host-panel-bootstrap-island.tsx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/tsconfig.json` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/zfb-shim.d.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/route-injection/zfb.config.ts` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/CLAUDE.md` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/package.json` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/pages/docs/[[...slug]].tsx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/pages/index.tsx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/src/content/docs/getting-started/index.mdx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/src/content/docs/getting-started/installation.mdx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/src/content/docs/getting-started/introduction.mdx` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/src/styles/global.css` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/tsconfig.json` — pending port/run result.
- `packages/zudo-doc/src/__tests__/fixtures/target-manifest/zfb.config.ts` — pending port/run result.
- `packages/zudo-doc/src/chrome/__tests__/assert-chrome-context.test.ts` — pending port/run result.
- `packages/zudo-doc/src/chrome/__tests__/asset-components.test.ts` — pending port/run result.
- `packages/zudo-doc/src/chrome/__tests__/date-format-wiring.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/chrome/__tests__/html-preview-components.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/chrome/__tests__/locale-wiring.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/chrome/__tests__/nav-versioned.test.ts` — pending port/run result.
- `packages/zudo-doc/src/chrome/__tests__/primary-slots.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-body-end-islands/__tests__/body-end-islands.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-content-header/__tests__/date-line.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-content-header/__tests__/doc-content-header.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-metainfo-area/__tests__/doc-metainfo-area.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-page-renderer/__tests__/doc-page-renderer.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-page-shell/__tests__/data-doc-description.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-page-shell/__tests__/toc-toggle.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-page-shell/__tests__/unavailable-versions-attr.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-pager/__tests__/doc-pager.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/metainfo/__tests__/doc-metainfo.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/metainfo/__tests__/doc-tags.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/metainfo/__tests__/frontmatter-preview.test.tsx` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
