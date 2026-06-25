/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /[locale]/docs/[[...slug]] — package-owned
// equivalent of pages/[locale]/docs/[[...slug]].tsx (A1 #2361).
//
// Non-default-locale catch-all docs route. The dynamic `[locale]` pattern is
// injected ONCE; `paths()` enumerates one route per (non-default locale, slug)
// with the locale-first + base-EN-fallback merge — reconstructed via `_context`.

import type { JSX } from "preact";
import type { DocPageEntryProps, DocPageAutoIndexProps } from "../doc-page-props/index.js";
import { settings, getLocaleConfig, resolveNavSource, buildDocRouteEntries } from "./_context.js";
import { renderDocPage } from "./_chrome.js";

export const frontmatter = { title: "Docs" };

interface LocaleDocPageExtra {
  contentDir: string;
  isFallback: boolean;
}

type DocPageProps =
  | (DocPageEntryProps & LocaleDocPageExtra)
  | (DocPageAutoIndexProps & LocaleDocPageExtra);

export function paths(): Array<{
  params: { locale: string; slug: string[] };
  props: DocPageProps;
}> {
  const result: Array<{
    params: { locale: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const locale of Object.keys(settings.locales)) {
    const contentDir = getLocaleConfig(locale)?.dir ?? settings.docsDir;
    const source = resolveNavSource(locale, undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });

    for (const item of buildDocRouteEntries({
      source,
      locale,
      routeSig: `locale-docs;${locale}`,
    })) {
      const extra: LocaleDocPageExtra = {
        contentDir: item.isFallback ? settings.docsDir : contentDir,
        isFallback: item.isFallback,
      };
      result.push({
        params: { locale, slug: item.slugParams },
        props: { ...(item.props as DocPageProps), ...extra },
      });
    }
  }

  return result;
}

type PageArgs = DocPageProps & { params: { locale: string; slug: string[] } };

export default function LocaleDocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: props.params.locale,
    isFallback: props.isFallback,
    docHistoryContentDir: props.contentDir,
  });
}
