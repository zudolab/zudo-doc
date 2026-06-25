/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /docs/tags/[tag] — package-owned equivalent of
// pages/docs/tags/[tag].tsx (A1 #2361). One route per unique tag in the
// default-locale collection.

import type { JSX } from "preact";
import type { TagInfo } from "../tag-pages/index.js";
import { defaultLocale } from "./_context.js";
import { collectTagMapForLocale, TagDetailPageView } from "./_chrome.js";

export const frontmatter = { title: "Tag" };

export function paths(): Array<{ params: { tag: string }; props: { tagInfo: TagInfo } }> {
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
