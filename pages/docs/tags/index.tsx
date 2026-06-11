/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the default-locale "All Tags" index route.
//
// Default-locale "All Tags" index page. Collects every tag across the
// "docs" collection, sorts them alphabetically, and renders a full tag cloud
// via the v2 TagNav component. No dynamic params — single static route.
//
// Tag collection + rendering are shared with the locale-prefixed route via
// pages/lib/_tag-pages.tsx (#2010).

import { defaultLocale } from "@/config/i18n";
import type { JSX } from "preact";
import { TagsIndexPageView } from "../../lib/_tag-pages";

export const frontmatter = { title: "All Tags" };

export default function DocsTagsIndexPage(): JSX.Element {
  return <TagsIndexPageView locale={defaultLocale} />;
}
