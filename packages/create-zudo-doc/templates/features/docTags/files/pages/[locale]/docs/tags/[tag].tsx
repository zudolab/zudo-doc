/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the locale-prefixed per-tag detail route.
//
// Non-default-locale per-tag detail page. paths() enumerates every
// (locale, tag) combination across all non-default locales defined in
// settings.locales, using the same locale-first + base-fallback merge
// strategy as the Astro original.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string; tag: string }
//   props:  { tagInfo: TagInfo }
//
// Tag collection + rendering are shared with the default-locale route via
// pages/lib/_tag-pages.tsx (#2010) — this file owns only the param shape.
// Fallback strategy: see pages/lib/locale-merge.ts for full details.

import { settings } from "@/config/settings";
import type { TagInfo } from "@/utils/tags";
import type { JSX } from "preact";
import { collectTagMapForLocale, TagDetailPageView } from "../../../lib/_tag-pages";

export const frontmatter = { title: "Tag" };

/** One route per (non-default locale, tag) pair. */
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
      result.push({
        params: { locale, tag },
        props: { tagInfo },
      });
    }
  }

  return result;
}

interface PageProps {
  params: { locale: string; tag: string };
  tagInfo: TagInfo;
}

export default function LocaleDocTagPage({
  params,
  tagInfo,
}: PageProps): JSX.Element {
  return <TagDetailPageView locale={params.locale} tag={params.tag} tagInfo={tagInfo} />;
}
