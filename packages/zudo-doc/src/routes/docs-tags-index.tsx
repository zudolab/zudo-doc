/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /docs/tags — package-owned equivalent of
// pages/docs/tags/index.tsx (A1 #2361). Default-locale "All Tags" index.

import type { JSX } from "preact";
import { defaultLocale } from "./_context.js";
import { TagsIndexPageView } from "./_chrome.js";

export const frontmatter = { title: "All Tags" };

export default function DocsTagsIndexPage(): JSX.Element {
  return <TagsIndexPageView locale={defaultLocale} />;
}
