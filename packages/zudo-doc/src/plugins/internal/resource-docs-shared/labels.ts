export type ResourceTranslations = Record<string, Record<string, string>>;

export interface ResolveResourceLabelOptions {
  /** UI-string translation table, keyed by locale then translation key. */
  translations?: ResourceTranslations;
  /** Locale for the page currently being generated. */
  locale: string;
  /** Configured default locale, if one was supplied by the caller. */
  defaultLocale?: string;
  /** Translation key to resolve. */
  key: string;
  /** English literal emitted by the pre-i18n generator. */
  fallbackLiteral: string;
}

/**
 * Resolve a generated-resource label with the same fallback order as `t()`.
 *
 * The caller must provide the English literal that the generator used before
 * localization. Keeping that literal as the final fallback prevents a
 * missing translation from leaking an implementation key such as
 * `resource.claude.title` into frontmatter or page output.
 */
export function resolveResourceLabel({
  translations,
  locale,
  defaultLocale,
  key,
  fallbackLiteral,
}: ResolveResourceLabelOptions): string {
  return (
    translations?.[locale]?.[key] ??
    (defaultLocale === undefined ? undefined : translations?.[defaultLocale]?.[key]) ??
    translations?.en?.[key] ??
    fallbackLiteral
  );
}

/** Short alias for callers that already work in the resource-docs namespace. */
export const resolveLabel = resolveResourceLabel;
