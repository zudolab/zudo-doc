/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /docs/[[...slug]] — package-owned equivalent of
// pages/docs/[[...slug]].tsx (epic Package-First Finale #2356, A1 #2361).
//
// Default-locale (EN) catch-all docs route. `paths()` enumerates every page in
// the "docs" collection plus auto-generated category index pages — the
// load-bearing route-injection seam, reconstructed entirely from the package
// factories via `_context` (no `@/` imports). Rendering is via the package
// `renderDocPage` chrome (`_chrome`). Dormant unless `settings.packageOwnedRoutes`
// is on; even then dropped if the user keeps a `pages/docs/[[...slug]].tsx`
// stub (Decision 6).

import type { JSX } from "preact";
import type { DocPageEntryProps, DocPageAutoIndexProps } from "../doc-page-props/index.js";
import { settings, defaultLocale, resolveNavSource, buildDocRouteEntries } from "./_context.js";
import { renderDocPage } from "./_chrome.js";

export const frontmatter = { title: "Docs" };

type DocPageProps = DocPageEntryProps | DocPageAutoIndexProps;

export function paths(): Array<{ params: { slug: string[] }; props: DocPageProps }> {
  const locale = defaultLocale;
  const source = resolveNavSource(locale, undefined);
  return buildDocRouteEntries({
    source,
    locale,
    routeSig: `docs;${locale}`,
  }).map((item) => ({
    params: { slug: item.slugParams },
    props: item.props as DocPageProps,
  }));
}

type PageArgs = DocPageProps & { params: { slug: string[] } };

export default function DocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: defaultLocale,
    docHistoryContentDir: settings.docsDir,
  });
}
