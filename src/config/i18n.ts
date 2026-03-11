import { settings } from "./settings";

/** Default locale code (always "en", served from docsDir). */
export const defaultLocale = "en" as const;

/** All supported locale codes, derived from settings. */
export const locales = [
  defaultLocale,
  ...Object.keys(settings.locales),
] as const;
export type Locale = (typeof locales)[number];

/** Get the content directory for a locale. */
export function getContentDir(locale: Locale | string): string {
  if (locale === defaultLocale) return settings.docsDir;
  return settings.locales[locale]?.dir ?? settings.docsDir;
}

/** Get the Astro content collection name for a locale. */
export function getCollectionName(locale: Locale | string): string {
  if (locale === defaultLocale) return "docs";
  return `docs-${locale}`;
}

/** Get the display label for a locale. */
export function getLocaleLabel(locale: Locale | string): string {
  if (locale === defaultLocale) return "EN";
  return settings.locales[locale]?.label ?? locale.toUpperCase();
}

/** Detect locale from a URL pathname (after base stripping). */
export function detectLocaleFromPath(path: string): Locale {
  for (const code of Object.keys(settings.locales)) {
    if (path.startsWith(`/${code}/`) || path === `/${code}`) {
      return code as Locale;
    }
  }
  return defaultLocale;
}

/** UI string translations */
const translations: Record<string, Record<string, string>> = {
  en: {
    "nav.previous": "Previous",
    "nav.next": "Next",
    "toc.title": "On this page",
    "docs.browseAll": "Browse all documentation sections.",
    "search.label": "Search",
    "code.copy": "Copy code",
    "code.copied": "Copied!",
    "code.wrapToggle": "Toggle word wrap",
    "doc.editPage": "Edit this page",
    "doc.tags": "Tags",
    "doc.taggedWith": "Pages tagged with",
    "doc.allTags": "All Tags",
    "doc.created": "Created",
    "doc.updated": "Updated",
    "doc.noTags": "No tags found.",
    "doc.pageCount": "{count} pages",
    "doc.pageCountSingle": "{count} page",
  },
  ja: {
    "nav.previous": "前へ",
    "nav.next": "次へ",
    "toc.title": "目次",
    "docs.browseAll": "すべてのドキュメントセクションを閲覧",
    "search.label": "検索",
    "code.copy": "コードをコピー",
    "code.copied": "コピーしました！",
    "code.wrapToggle": "折り返し切替",
    "doc.editPage": "このページを編集",
    "doc.tags": "タグ",
    "doc.taggedWith": "タグ付きページ",
    "doc.allTags": "すべてのタグ",
    "doc.created": "作成",
    "doc.updated": "更新",
    "doc.noTags": "タグが見つかりません。",
    "doc.pageCount": "{count}ページ",
    "doc.pageCountSingle": "{count}ページ",
  },
  de: {
    "nav.previous": "Zurück",
    "nav.next": "Weiter",
    "toc.title": "Auf dieser Seite",
    "docs.browseAll": "Alle Dokumentationsabschnitte durchsuchen.",
    "search.label": "Suche",
    "code.copy": "Code kopieren",
    "code.copied": "Kopiert!",
    "code.wrapToggle": "Zeilenumbruch umschalten",
    "doc.editPage": "Diese Seite bearbeiten",
    "doc.tags": "Tags",
    "doc.taggedWith": "Seiten mit Tag",
    "doc.allTags": "Alle Tags",
    "doc.created": "Erstellt",
    "doc.updated": "Aktualisiert",
    "doc.noTags": "Keine Tags gefunden.",
    "doc.pageCount": "{count} Seiten",
    "doc.pageCountSingle": "{count} Seite",
  },
};

/** Get a translated UI string */
export function t(key: string, locale: Locale | string = defaultLocale): string {
  return translations[locale]?.[key] ?? translations[defaultLocale]?.[key] ?? key;
}
