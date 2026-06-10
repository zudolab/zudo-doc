/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the locale-prefixed "All Tags" index route.
//
// Non-default-locale "All Tags" index page. paths() emits one route per
// locale defined in settings.locales (the default locale has no prefix — it
// is handled by pages/docs/tags/index.tsx). The component recomputes the tag
// map at render time using a locale-doc + base-doc fallback strategy
// (see pages/lib/locale-merge.ts for the merge logic).
//
// Tag collection + rendering are shared with the default-locale route via
// pages/lib/_tag-pages.tsx (#2010).
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string }
//   props:  (none — tag map computed at render time)

import { settings } from "@/config/settings";
import type { JSX } from "preact";
import { TagsIndexPageView } from "../../../lib/_tag-pages";

export const frontmatter = { title: "All Tags" };

/** One route per non-default locale (prefixDefaultLocale: false). */
export function paths(): Array<{ params: { locale: string } }> {
  return Object.keys(settings.locales).map((locale) => ({
    params: { locale },
  }));
}

interface PageProps {
  params: { locale: string };
}

export default function LocaleTagsIndexPage({
  params,
}: PageProps): JSX.Element {
  return <TagsIndexPageView locale={params.locale} />;
}
