/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /[locale]/docs/tags/[tag] — package-owned
// equivalent of pages/[locale]/docs/tags/[tag].tsx (A1 #2361). One route per
// (non-default locale, tag) pair.

import type { JSX } from "preact";
import type { TagInfo } from "../tag-pages/index.js";
import { settings } from "./_context.js";
import { collectTagMapForLocale, TagDetailPageView } from "./_chrome.js";

export const frontmatter = { title: "Tag" };

export function paths(): Array<{
  params: { locale: string; tag: string };
  props: { tagInfo: TagInfo };
}> {
  const result: Array<{
    params: { locale: string; tag: string };
    props: { tagInfo: TagInfo };
  }> = [];

  for (const locale of Object.keys(settings.locales)) {
    const tagMap = collectTagMapForLocale(locale);
    for (const [tag, tagInfo] of tagMap.entries()) {
      result.push({ params: { locale, tag }, props: { tagInfo } });
    }
  }
  return result;
}

interface PageProps {
  params: { locale: string; tag: string };
  tagInfo: TagInfo;
}

export default function LocaleDocTagPage({ params, tagInfo }: PageProps): JSX.Element {
  return <TagDetailPageView locale={params.locale} tag={params.tag} tagInfo={tagInfo} />;
}
