/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /[locale] — package-owned equivalent of
// pages/[locale]/index.tsx (A1 #2361). One route per non-default locale; the
// locale-prefixed site index (site-map grid + optional tag count).
//
// Thin consumer of `HomePageView` (S3 #2502): this file's only job is
// `paths()` (a locale-routing concern) and handing `routeCtx` + the resolved
// locale param to the shared `prepareHomeData` factory (#2519), which now
// owns the locale-specific data prep — `resolveNavSource` with the
// locale-home filter options, `loadCategoryMeta`, and the locale-config
// guard. The prepared tree / tag count are handed to the shared home body
// factory, same as the default-locale route.

import type { JSX } from "preact";
import { settings, routeCtx } from "./_context.js";
import { prepareHomeData } from "../home-page/prepare-home-data.js";
import { HomePageView } from "./_chrome.js";

export const frontmatter = { title: "Home" };

export function paths(): Array<{ params: { locale: string }; props: { locale: string } }> {
  return Object.keys(settings.locales).map((locale) => ({
    params: { locale },
    props: { locale },
  }));
}

interface PageArgs {
  params: { locale: string };
  props: { locale: string };
}

export default function LocaleIndexPage({ params }: PageArgs): JSX.Element {
  const locale = params.locale;

  const { tree, categoryOrder, tags } = prepareHomeData(routeCtx, locale);

  return (
    <HomePageView
      locale={locale}
      tree={tree}
      categoryOrder={categoryOrder}
      tags={tags}
      wide={settings.home?.wide ?? false}
    />
  );
}
