/**
 * Locale-to-TOC-title mapping for the v2 package.
 *
 * Mirrors the `toc.title` key values from `src/config/i18n.ts` (and the
 * create-zudo-doc template equivalent). This copy lives inside the v2
 * package so `DocLayoutWithDefaults` can derive the correct default title
 * from the `lang` HTML attribute without importing the host project's i18n
 * module — keeping the package self-contained and host-agnostic.
 *
 * When adding a new locale to zudo-doc's supported set, add the
 * corresponding entry here too.
 */
const TOC_TITLES: Record<string, string> = {
  en: "On this page",
  ja: "目次",
  de: "Auf dieser Seite",
};

const DEFAULT_TOC_TITLE = "On this page";

/**
 * Return the TOC section label for the given BCP-47 language tag.
 *
 * Accepts full tags ("en-US", "ja-JP") by checking the primary subtag
 * first, then falls back to the full tag, then falls back to the English
 * default so callers always receive a non-empty string.
 */
export function getTocTitle(lang?: string): string {
  if (!lang) return DEFAULT_TOC_TITLE;
  // "en-US" → try "en" first, then "en-US", then fallback
  const primary = lang.split("-")[0]!;
  return TOC_TITLES[primary] ?? TOC_TITLES[lang] ?? DEFAULT_TOC_TITLE;
}
