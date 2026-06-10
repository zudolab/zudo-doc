/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the default-locale versions index route.
//
// Default-locale documentation versions page. Static route — no paths()
// export needed. Lists the latest version and any past versions configured
// in settings.versions.
//
// Rendering is shared with the locale-prefixed route via
// pages/lib/_versions-page.tsx (#2010).

import { defaultLocale } from "@/config/i18n";
import type { JSX } from "preact";
import { VersionsPageView } from "../lib/_versions-page";

export const frontmatter = { title: "Versions" };

export default function VersionsPage(): JSX.Element {
  return <VersionsPageView locale={defaultLocale} />;
}
