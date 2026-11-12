// Dependency-free so config validation can share it without a JSX graph.

/**
 * True for a canonical document slug as written in `home.sections` or MDX:
 * non-empty, no surrounding slash, no whitespace, no URL scheme, query or
 * hash, no backslash, and no empty, "." or ".." path segment.
 */
export function isCanonicalDocSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    !/\s/.test(value) &&
    !value.includes("://") &&
    !value.includes("?") &&
    !value.includes("#") &&
    !value.includes("\\") &&
    value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}
