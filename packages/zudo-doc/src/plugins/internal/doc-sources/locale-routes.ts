/**
 * Whether a generated index has a route in the requested locale. Matching
 * mirrors `url-helpers.isDefaultLocaleOnlyPath`: the default-locale-shaped
 * route gets a trailing slash and uses prefix matching.
 */
export function shouldEmitLocaleRoute(
  routeDir: string,
  locale: string,
  defaultLocale: string,
  defaultLocaleOnlyPrefixes: readonly string[],
): boolean {
  if (locale === defaultLocale) return true;
  const routePath = `/docs/${routeDir.replace(/^\/+|\/+$/g, "")}/`;
  return !defaultLocaleOnlyPrefixes.some((prefix) => routePath.startsWith(prefix));
}
