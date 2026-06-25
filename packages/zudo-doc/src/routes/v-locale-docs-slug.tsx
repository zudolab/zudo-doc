/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /v/[version]/[locale]/docs/[[...slug]] —
// package-owned equivalent of pages/v/[version]/[locale]/docs/[[...slug]].tsx
// (A1 #2361).
//
// Versioned non-default-locale docs route. The dynamic `[version]`/`[locale]`
// patterns are injected ONCE; `paths()` cross-products versions × non-default
// locales with a locale-first merge over the version's EN base.

import type { JSX } from "preact";
import type { VersionConfig } from "../settings.js";
import type { DocPageEntryProps, DocPageAutoIndexProps } from "../doc-page-props/index.js";
import { settings, resolveVersionedLocaleSource, versionedDocsUrl, buildDocRouteEntries } from "./_context.js";
import { renderDocPage } from "./_chrome.js";

export const frontmatter = { title: "Docs" };

interface VersionedLocaleDocPageExtra {
  version: VersionConfig;
  contentDir: string;
  isFallback: boolean;
}

type DocPageProps =
  | (DocPageEntryProps & VersionedLocaleDocPageExtra)
  | (DocPageAutoIndexProps & VersionedLocaleDocPageExtra);

export function paths(): Array<{
  params: { version: string; locale: string; slug: string[] };
  props: DocPageProps;
}> {
  if (!settings.versions) return [];

  const result: Array<{
    params: { version: string; locale: string; slug: string[] };
    props: DocPageProps;
  }> = [];

  for (const version of settings.versions) {
    for (const locale of Object.keys(settings.locales)) {
      const localeDir = version.locales?.[locale]?.dir;
      const source = resolveVersionedLocaleSource(
        version.slug,
        version.docsDir,
        locale,
        localeDir,
        { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
      );
      const urlFor = (s: string): string => versionedDocsUrl(s, version.slug, locale);

      for (const item of buildDocRouteEntries({
        source,
        locale,
        routeSig: `v-locale-docs;${version.slug};${locale}`,
        urlFor,
      })) {
        const extra: VersionedLocaleDocPageExtra = {
          version,
          contentDir: item.isFallback ? version.docsDir : (localeDir ?? version.docsDir),
          isFallback: item.isFallback,
        };
        result.push({
          params: { version: version.slug, locale, slug: item.slugParams },
          props: { ...(item.props as DocPageProps), ...extra },
        });
      }
    }
  }

  return result;
}

type PageArgs = DocPageProps & {
  params: { version: string; locale: string; slug: string[] };
};

export default function VersionedLocaleDocsPage(props: PageArgs): JSX.Element {
  return renderDocPage(props, {
    locale: props.params.locale,
    version: props.version,
    isFallback: props.isFallback,
    docHistoryContentDir: props.contentDir,
  });
}
