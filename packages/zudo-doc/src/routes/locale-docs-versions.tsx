/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /[locale]/docs/versions — package-owned equivalent
// of pages/[locale]/docs/versions.tsx (A1 #2361). One route per non-default
// locale; rendered by the shared package `VersionsPageView`.

import type { JSX } from "preact";
import { settings } from "./_context.js";
import { VersionsPageView } from "./_chrome.js";

export const frontmatter = { title: "Versions" };

export function paths(): Array<{ params: { locale: string } }> {
  return Object.keys(settings.locales).map((locale) => ({ params: { locale } }));
}

interface PageProps {
  params: { locale: string };
}

export default function LocaleVersionsPage({ params }: PageProps): JSX.Element {
  return <VersionsPageView locale={params.locale} />;
}
