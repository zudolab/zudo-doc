/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the locale-prefixed versions index route.
//
// Non-default-locale versions page. paths() emits one route per locale in
// settings.locales. Locale string is passed as a prop to drive label
// translation in the component.
//
// Rendering is shared with the default-locale route via
// pages/lib/_versions-page.tsx (#2010).
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string }
//   props:  { locale }

import { settings } from "@/config/settings";
import type { JSX } from "preact";
import { VersionsPageView } from "../../lib/_versions-page";

export const frontmatter = { title: "Versions" };

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/** One route per non-default locale. */
export function paths(): Array<{
  params: { locale: string };
  props: { locale: string };
}> {
  return Object.keys(settings.locales).map((locale) => ({
    params: { locale },
    props: { locale },
  }));
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface PageArgs {
  params: { locale: string };
  props: { locale: string };
}

export default function LocaleVersionsPage({ params }: PageArgs): JSX.Element {
  return <VersionsPageView locale={params.locale} />;
}
