export interface ResourceLocaleRouteOptions {
  /** Route slug below `/docs/`, without a locale prefix. */
  slug: string;
  /** Locale whose physical index would be emitted. */
  locale: string;
  /** Locale served from the unprefixed default docs root. */
  defaultLocale?: string;
  /** Default-locale-only route prefixes in their `/docs/.../` form. */
  defaultLocaleOnlyPrefixes?: readonly string[];
}

/**
 * Whether a generated resource index has a route in the requested locale.
 * Matching deliberately mirrors `url-helpers.isDefaultLocaleOnlyPath`: the
 * default-locale-shaped route gets a trailing slash and uses prefix matching.
 */
export function shouldEmitResourceLocaleRoute({
  slug,
  locale,
  defaultLocale = "en",
  defaultLocaleOnlyPrefixes = [],
}: ResourceLocaleRouteOptions): boolean {
  if (locale === defaultLocale) return true;

  const normalizedSlug = slug.replace(/^\/+|\/+$/g, "");
  const routePath = `/docs/${normalizedSlug}/`;
  return !defaultLocaleOnlyPrefixes.some((prefix) => routePath.startsWith(prefix));
}
