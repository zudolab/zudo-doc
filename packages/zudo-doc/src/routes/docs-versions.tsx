/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /docs/versions — package-owned equivalent of
// pages/docs/versions.tsx (A1 #2361). Default-locale versions index; rendered
// by the package `VersionsPageView` (`_chrome`).

import type { JSX } from "preact";
import { defaultLocale } from "./_context.js";
import { VersionsPageView } from "./_chrome.js";

export const frontmatter = { title: "Versions" };

export default function VersionsPage(): JSX.Element {
  return <VersionsPageView locale={defaultLocale} />;
}
