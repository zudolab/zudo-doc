# Port the package routes and the public type surface (chrome bindings, header types, factory context, barrel, API.md types)

Owner: [#4465](https://github.com/zudolab/zudo-doc/issues/4465). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/chrome-bindings.ts` | `SearchWidgetSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `BodyEndIslandsSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `DocHistorySlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `DesignTokenPanelBootstrapSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `FooterTagEntry` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `FrontmatterRendererSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `HeaderSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `FooterSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `SidebarSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `TocSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `BreadcrumbSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `DocPagerSlotProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `ChromeBindingsInput` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/chrome-bindings.ts` | `defineChromeBindings` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `FactoryI18n` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `FactoryComponents` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `FactoryComponent` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `NavSource` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `FactoryContext` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `TagInfo` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `RouteHrefBuilder` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `RouteContext` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `ChromeHostBindings` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/factory-context/index.ts` | `ChromeContext` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/right-items.ts` | `HeaderRightItemFlags` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/right-items.ts` | `filterHeaderRightItems` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `Locale` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderNavChildItem` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderNavItem` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightBuiltinComponentName` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightComponentName` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightTriggerName` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightComponentItem` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightComponentProps` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightComponentRegistry` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightTriggerItem` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightLinkItem` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightHtmlItem` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/header/types.ts` | `HeaderRightItem` | Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/404.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/404.tsx` | `NotFoundPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_chrome.tsx` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_context.ts` | `ctx` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_context.ts` | `settings` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_context.ts` | `colorSchemes` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_context.ts` | `themePackRegistry` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_context.ts` | `assetManifest` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_docs-helpers.ts` | `snapshotAnchor` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_docs-helpers.ts` | `buildDocs` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_docs-helpers.ts` | `stableDocs` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/_virtual.d.ts` | `module / template` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/api-ai-chat.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/api-ai-chat.tsx` | `prerender` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/api-ai-chat.tsx` | `jsonResponse` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/api-ai-chat.tsx` | `AiChatHandler` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-slug.tsx` | `frontmatter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-slug.tsx` | `paths` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-slug.tsx` | `DocsPage` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-tags-index.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-tags-index.tsx` | `DocsTagsIndexPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-tags-tag.tsx` | `frontmatter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-tags-tag.tsx` | `paths` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-tags-tag.tsx` | `DocTagPage` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-versions.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/docs-versions.tsx` | `VersionsPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/files-path.tsx` | `frontmatter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/files-path.tsx` | `paths` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/files-path.tsx` | `FilesPathPage` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/index.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/index.tsx` | `IndexPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-slug.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-slug.tsx` | `paths` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-slug.tsx` | `LocaleDocsPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-tags-index.tsx` | `frontmatter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-tags-index.tsx` | `paths` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-tags-index.tsx` | `LocaleTagsIndexPage` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-tags-tag.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-tags-tag.tsx` | `paths` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-tags-tag.tsx` | `LocaleDocTagPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-versions.tsx` | `frontmatter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-versions.tsx` | `paths` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-docs-versions.tsx` | `LocaleVersionsPage` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-files-path.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-files-path.tsx` | `paths` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-files-path.tsx` | `LocaleFilesPathPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-index.tsx` | `frontmatter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-index.tsx` | `paths` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/locale-index.tsx` | `LocaleIndexPage` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/robots.txt.tsx` | `contentType` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/sitemap.xml.tsx` | `frontmatter` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/sitemap.xml.tsx` | `contentType` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/sitemap.xml.tsx` | `escapeXml` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/sitemap.xml.tsx` | `Sitemap` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/v-docs-slug.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/v-docs-slug.tsx` | `paths` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/v-docs-slug.tsx` | `VersionedDocsPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/v-locale-docs-slug.tsx` | `frontmatter` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/v-locale-docs-slug.tsx` | `paths` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/routes/v-locale-docs-slug.tsx` | `VersionedLocaleDocsPage` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | pending scan confirmation |

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
