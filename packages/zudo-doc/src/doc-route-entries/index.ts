// doc-route-entries — the zfb-typed binding of the shared route-entry builder
// (epic #2344, S6; relocated by #3395).
//
// The builder itself now lives in `../site-schema/doc-route-entries.js`, where
// it is generic over the entry shape and free of any `@takazudo/zfb`
// declaration edge. This module re-exports it and pins every type parameter to
// the zfb-typed `DocPageEntry`, so `./doc-route-entries` consumers — the route
// entrypoints, `route-context`, `factory-context` — see exactly the types they
// saw before the split, including `props.entry.Content`.
//
// Prefer `@takazudo/zudo-doc/site-schema` when you do not need the zfb entry:
// same function, browser-safe graph.

import type { DocPageEntry, DocNavNode, AutoIndexNode, DocPageBaseProps } from "../doc-page-props/index.js";
import type { NavSourceDocs } from "../nav-source-docs/index.js";
import type { BreadcrumbItem } from "../breadcrumb/types.js";
import type { HeadingItem } from "../extract-headings/index.js";
import type {
  BuildDocRouteEntriesArgs as BuildDocRouteEntriesArgsGeneric,
  DocRouteEntriesAPI as DocRouteEntriesAPIGeneric,
  DocRouteEntriesContext as DocRouteEntriesContextGeneric,
  DocRouteEntry as DocRouteEntryGeneric,
} from "../site-schema/doc-route-entries.js";

export { createDocRouteEntries } from "../site-schema/doc-route-entries.js";

export type { DocPageEntry, DocNavNode, AutoIndexNode, DocPageBaseProps, NavSourceDocs };
export type { BreadcrumbItem, HeadingItem };

/** One enumerated doc route, carrying a zfb collection entry. */
export type DocRouteEntry = DocRouteEntryGeneric<DocPageEntry>;

/** Arguments to `buildDocRouteEntries` for one (locale, version) context. */
export type BuildDocRouteEntriesArgs = BuildDocRouteEntriesArgsGeneric<DocPageEntry>;

/** The context slice `createDocRouteEntries` derives its bag from. */
export type DocRouteEntriesContext = DocRouteEntriesContextGeneric<DocPageEntry>;

/** The functions `createDocRouteEntries` returns. */
export type DocRouteEntriesAPI = DocRouteEntriesAPIGeneric<DocPageEntry>;
