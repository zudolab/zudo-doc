// Thin stub — route-enumerators moved to the package (epic #2344, S6).
// Calls `createRouteEnumerators(ctx)` from @takazudo/zudo-doc/route-enumerators
// with the host singletons injected, then re-exports the resulting enumeration
// functions so all existing call sites continue to work unchanged.

import { createRouteEnumerators } from "@takazudo/zudo-doc/route-enumerators";
import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import { docsUrl, versionedDocsUrl, withBase, isDefaultLocaleOnlyPath } from "@/utils/base";
import { buildNavTree, collectAutoIndexNodes } from "@/utils/docs";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { loadDocs } from "../_data";
import { resolveNavSource, resolveVersionedLocaleSource } from "./_nav-source-docs";
import { mergeLocaleDocs } from "./locale-merge";

export const {
  enumerateDocsRoutes,
  enumerateTagsRoutes,
  enumerateVersionedRoutes,
  enumerateAllRoutes,
} = createRouteEnumerators({
  defaultLocale,
  getLocaleKeys: () => Object.keys(settings.locales),
  getVersions: () => settings.versions,
  getDocTags: () => settings.docTags,
  docsUrl,
  versionedDocsUrl,
  withBase,
  loadDocs,
  isDefaultLocaleOnlyPath,
  collectTags,
  toRouteSlug,
  buildNavTree,
  collectAutoIndexNodes,
  resolveNavSource,
  resolveVersionedLocaleSource,
  mergeLocaleDocs,
});
