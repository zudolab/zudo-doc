import type { Settings } from "../settings.js";

export function resolveHomeIntro(
  settings: Pick<Settings, "home" | "locales">,
  locale: string,
  translatedSitemapHeading: string,
) {
  const localized = settings.locales[locale];
  return {
    introMarkdown: localized?.introMarkdown ?? settings.home?.introMarkdown ?? "",
    sitemapHeading:
      (localized?.sitemapHeading ?? settings.home?.sitemapHeading)?.trim() ||
      translatedSitemapHeading,
  };
}
