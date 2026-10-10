/** @jsxRuntime automatic */
// Package route entrypoint: /[locale]/docs/tags — package-owned equivalent of
// pages/[locale]/docs/tags/index.tsx (A1 #2361). One route per non-default
// locale; the tag map is computed at render time (locale-first + base merge).

import type { Child } from "@takazudo/zfb/zudo-react";
import { settings } from "./_context.js";
import { TagsIndexPageView } from "./_chrome.js";

export const frontmatter = { title: "All Tags" };

export function paths(): Array<{ params: { locale: string } }> {
  return Object.keys(settings.locales).map((locale) => ({ params: { locale } }));
}

interface PageProps {
  params: { locale: string };
}

export default function LocaleTagsIndexPage({ params }: PageProps): Child {
  return <TagsIndexPageView locale={params.locale} />;
}
