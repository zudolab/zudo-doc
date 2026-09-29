# Port the server-side navigation layer (nav-indexing, category navs, site-tree-nav, note-tray-index, tag and versions pages) and rewrite the VNode-walker tests

Owner: [#4460](https://github.com/zudolab/zudo-doc/issues/4460). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/category-nav/index.tsx` | `CategoryNavNode` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-nav/index.tsx` | `CategoryNavSource` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-nav/index.tsx` | `CategoryNavWrapperProps` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-nav/index.tsx` | `CategoryNavDeps` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-nav/index.tsx` | `createCategoryNavWrapper` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-tree-nav/index.tsx` | `CategoryTreeNavNode` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-tree-nav/index.tsx` | `CategoryTreeNavSource` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-tree-nav/index.tsx` | `CategoryTreeNavWrapperProps` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-tree-nav/index.tsx` | `CategoryTreeNavDeps` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/category-tree-nav/index.tsx` | `createCategoryTreeNavWrapper` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-tags-area/index.tsx` | `DocTagsAreaSettings` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-tags-area/index.tsx` | `DocTagsAreaProps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-tags-area/index.tsx` | `createDocTagsArea` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/category-nav.tsx` | `CategoryNavProps` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/category-nav.tsx` | `ArrowIcon` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/category-nav.tsx` | `CategoryNav` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/category-tree-nav.tsx` | `CategoryTreeNavProps` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/category-tree-nav.tsx` | `NodeItem` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/category-tree-nav.tsx` | `CategoryTreeNav` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/doc-card-grid.tsx` | `DocCardItem` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/doc-card-grid.tsx` | `DocCardGridProps` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/doc-card-grid.tsx` | `ArrowIcon` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/doc-card-grid.tsx` | `DocCardGrid` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/docs-sitemap.tsx` | `DocsSitemapProps` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/docs-sitemap.tsx` | `flattenTree` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/docs-sitemap.tsx` | `SitemapSection` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/docs-sitemap.tsx` | `DocsSitemap` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/index.ts` | `module / template` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/nav-card-grid.tsx` | `NavCardGridProps` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/nav-card-grid.tsx` | `ArrowIcon` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/nav-card-grid.tsx` | `NavCardGrid` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx` | `CardBody` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx` | `DateStamp` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx` | `CardList` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/date-line.tsx` | `DateLine` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/date-line.tsx` | `ItemTags` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/index-list.tsx` | `IndexList` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/timeline.tsx` | `Timeline` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index.tsx` | `NoteTrayIndexStyle` | style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index.tsx` | `NoteTrayIndexItem` | style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index.tsx` | `NoteTrayIndexProps` | style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/note-tray-index.tsx` | `NoteTrayIndex` | style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/site-tree-nav-demo.tsx` | `SiteTreeNavDemoProps` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/site-tree-nav-demo.tsx` | `flattenTree` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/site-tree-nav-demo.tsx` | `reorder` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/site-tree-nav-demo.tsx` | `Section` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/site-tree-nav-demo.tsx` | `SiteTreeNavDemo` | map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/tag-nav.tsx` | `TagNavAllProps` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/tag-nav.tsx` | `TagNavPageProps` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/tag-nav.tsx` | `TagNavProps` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/tag-nav.tsx` | `AllTagChip` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/tag-nav.tsx` | `PageTagChip` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/tag-nav.tsx` | `TagNav` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/types.ts` | `NavNode` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/types.ts` | `TagItem` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/types.ts` | `TagLink` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/types.ts` | `TagNavLabels` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/types.ts` | `VersionPageEntry` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/types.ts` | `VersionsPageLabels` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/versions-page-content.tsx` | `VersionsPageContentProps` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/nav-indexing/versions-page-content.tsx` | `VersionsPageContent` | className → intrinsic class; preserve custom props except locked exceptions; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/note-tray-index/index.tsx` | `NoteTrayIndexNode` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/note-tray-index/index.tsx` | `NoteTrayIndexDoc` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/note-tray-index/index.tsx` | `NoteTrayIndexSource` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/note-tray-index/index.tsx` | `NoteTrayIndexWrapperProps` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/note-tray-index/index.tsx` | `NoteTrayIndexDeps` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/note-tray-index/index.tsx` | `createNoteTrayIndexWrapper` | style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/site-tree-nav/index.tsx` | `SiteTreeNavSource` | Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/site-tree-nav/index.tsx` | `SiteTreeNavWrapperProps` | Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/site-tree-nav/index.tsx` | `SiteTreeNavDeps` | Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/site-tree-nav/index.tsx` | `createSiteTreeNavWrapper` | Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tag-pages/index.tsx` | `TagPagesDocsEntry` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tag-pages/index.tsx` | `TagInfo` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tag-pages/index.tsx` | `TagPagesSettings` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tag-pages/index.tsx` | `TagPagesComponents` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tag-pages/index.tsx` | `TagPagesDeps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tag-pages/index.tsx` | `TagPagesAPI` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tag-pages/index.tsx` | `createTagPages` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/versions-page/index.tsx` | `VersionsPageVersionEntry` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/versions-page/index.tsx` | `VersionsPageSettings` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/versions-page/index.tsx` | `VersionsPageComponents` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/versions-page/index.tsx` | `VersionsPageDeps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/versions-page/index.tsx` | `VersionsPageViewProps` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/versions-page/index.tsx` | `createVersionsPageView` | Preact child types → Child/Description; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/nav-indexing/docs-sitemap.tsx` | `[&::-webkit-details-marker]:hidden` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx` | `[&_a]:pointer-events-auto` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx` | `ml-[calc(var(--spacing-hsp-xl)+1px)]` | #4435 canonical underscore-space operators; preserve mathematical value | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/card-list.tsx` | `mr-[calc(var(--spacing-hsp-xl)+1px)]` | #4435 canonical underscore-space operators; preserve mathematical value | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/index-list.tsx` | `leading-none` | Keep utility; #4439 supplies explicit token | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/index-list.tsx` | `[&_li]:mb-0` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/timeline.tsx` | `leading-none` | Keep utility; #4439 supplies explicit token | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/nav-indexing/note-tray-index-parts/timeline.tsx` | `[&_li]:mb-0` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/nav-indexing/site-tree-nav-demo.tsx` | `[&::-webkit-details-marker]:hidden` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/category-nav/__tests__/category-nav-factory.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/category-tree-nav/__tests__/category-tree-nav-factory.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/category-nav.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/category-tree-nav.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/doc-card-grid.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/docs-sitemap.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/helpers.ts` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/nav-card-grid.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/note-tray-card-list.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/note-tray-index-list.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/note-tray-index.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/note-tray-test-helpers.ts` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/note-tray-timeline.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/tag-nav.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/nav-indexing/__tests__/versions-page-content.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/note-tray-index/__tests__/note-tray-index-factory.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/site-tree-nav/__tests__/site-tree-nav-factory.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/tag-pages/__tests__/tag-pages-factory.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/versions-page/__tests__/entry-doc-slug.test.tsx` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
