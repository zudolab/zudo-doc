/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Thin stub — tag-pages moved to the package (epic #2344, S8).
// Calls `createTagPages(deps)` from @takazudo/zudo-doc/tag-pages with host
// singletons injected, then re-exports the resulting functions so all existing
// call sites continue to work unchanged.

import { createTagPages } from "@takazudo/zudo-doc/tag-pages";
import type { TagInfo } from "@takazudo/zudo-doc/tag-pages";
import { collectTags } from "@/utils/tags";
import { defaultLocale, t } from "@/config/i18n";
import { settings } from "@/config/settings";
import { withBase, docsUrl } from "@/utils/base";
import { isDefaultLocaleOnlyPath } from "@/utils/base";
import { FooterWithDefaults } from "./_footer-with-defaults";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { HeadWithDefaults } from "./_head-with-defaults";
import { composeMetaTitle } from "./_compose-meta-title";
import { DocHistoryArea } from "./_doc-history-area";
import { BodyEndIslands } from "./_body-end-islands";
import { stableDocs } from "./_nav-source-cache";

export type { TagInfo };

const { collectTagMapForLocale, TagDetailPageView, TagsIndexPageView } = createTagPages({
  settings,
  defaultLocale,
  t,
  withBase,
  docsUrl,
  composeMetaTitle,
  collectTags: collectTags as (
    entries: import("@takazudo/zudo-doc/tag-pages").TagPagesDocsEntry[],
    slugFn: (id: string, data: { slug?: string }) => string,
  ) => Map<string, TagInfo>,
  stableDocs: stableDocs as (collectionName: string) => import("@takazudo/zudo-doc/tag-pages").TagPagesDocsEntry[],
  isDefaultLocaleOnlyPath,
  components: {
    HeadWithDefaults,
    HeaderWithDefaults,
    FooterWithDefaults,
    BodyEndIslands,
    DocHistoryArea,
  },
});

export { collectTagMapForLocale, TagDetailPageView, TagsIndexPageView };
