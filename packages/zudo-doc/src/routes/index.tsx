/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: / — package-owned equivalent of pages/index.tsx
// (A1 #2361). Default-locale (EN) site index: site-map grid + optional tag
// count, rendered through the package chrome (`_chrome`). Static route — no
// paths() export.
//
// Thin consumer of `HomePageView` (S3 #2502): this file's only job is
// resolving the default locale and handing `routeCtx` to the shared
// `prepareHomeData` factory (#2519) for the data-prep sequence, then handing
// the result to the shared home body factory.

import type { JSX } from "preact";
import { defaultLocale, routeCtx, settings } from "./_context.js";
import { prepareHomeData } from "../home-page/prepare-home-data.js";
import { HomePageView } from "./_chrome.js";

export const frontmatter = { title: "Home" };

export default function IndexPage(): JSX.Element {
  const locale = defaultLocale;

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
