/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the default-locale per-tag detail route.
//
// Default-locale per-tag detail page. paths() enumerates one route per
// unique tag in the "docs" collection and passes the resolved TagInfo as a
// prop so the component has zero extra collection reads at render time.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { tag: string }
//   props:  { tagInfo: TagInfo }
//
// Tag collection + rendering are shared with the locale-prefixed route via
// pages/lib/_tag-pages.tsx (#2010) — this file owns only the param shape.

import { defaultLocale } from "@/config/i18n";
import type { TagInfo } from "@/utils/tags";
import type { JSX } from "preact";
import { collectTagMapForLocale, TagDetailPageView } from "../../lib/_tag-pages";

export const frontmatter = { title: "Tag" };

/** One entry per unique tag in the default-locale collection. */
export function paths(): Array<{
  params: { tag: string };
  props: { tagInfo: TagInfo };
}> {
  const tagMap = collectTagMapForLocale(defaultLocale);

  return [...tagMap.entries()].map(([tag, tagInfo]) => ({
    params: { tag },
    props: { tagInfo },
  }));
}

interface PageProps {
  params: { tag: string };
  tagInfo: TagInfo;
}

export default function DocTagPage({ params, tagInfo }: PageProps): JSX.Element {
  return <TagDetailPageView locale={defaultLocale} tag={params.tag} tagInfo={tagInfo} />;
}
