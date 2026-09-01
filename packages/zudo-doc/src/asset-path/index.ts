/** Browser-safe canonical path and URL helpers for the asset viewer. */

export interface DecodedAssetHref {
  /** Normalized path relative to the configured public asset directory. */
  path: string;
  /** The authored fragment, including its leading `#`, when present. */
  fragment?: string;
}

export interface AssetViewerHrefOptions {
  base: string;
  routePrefix: string;
  path: string;
  /** Non-default locale segment. Omit for the unprefixed default locale. */
  locale?: string;
  /** A fragment with or without its leading `#`. */
  fragment?: string;
}

export interface AssetRawHrefOptions {
  base: string;
  dir: string;
  path: string;
}

export interface AssetViewerPathSettings {
  dir: string;
  routePrefix: string;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * Normalize a public asset path to NFC POSIX form.
 *
 * Paths are relative file paths, never URLs: empty segments, leading slashes,
 * dot segments, backslashes and control characters are rejected.
 */
export function normalizeAssetPath(path: string): string {
  if (path.length === 0) throw new Error("Asset path must not be empty");
  if (path.startsWith("/")) throw new Error(`Asset path must be relative: ${path}`);
  if (path.includes("\\")) throw new Error(`Asset path must use POSIX separators: ${path}`);
  if (CONTROL_CHARS.test(path)) throw new Error("Asset path must not contain control characters");

  const normalized = path.normalize("NFC");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new Error(`Asset path must not contain empty segments: ${path}`);
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Asset path must not contain dot segments: ${path}`);
  }
  return normalized;
}

/** Encode each path segment independently, retaining POSIX `/` separators. */
export function encodeAssetPathForUrl(path: string): string {
  return normalizeAssetPath(path).split("/").map(encodeURIComponent).join("/");
}

function normalizedBase(base: string): string {
  if (base === "" || base === "/") return "";
  const withLeadingSlash = base.startsWith("/") ? base : `/${base}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function withBase(base: string, path: string): string {
  const prefix = normalizedBase(base);
  return prefix + (path.startsWith("/") ? path : `/${path}`);
}

/**
 * Decode a root-relative authored href that points inside `/<dir>/`.
 *
 * Decoding happens exactly once. A literal query makes the href ineligible;
 * `%3F` remains a valid filename character. Fragments are preserved verbatim.
 */
export function decodeAuthoredHref(
  href: string,
  options: { base: string; dir: string },
): DecodedAssetHref | null {
  if (CONTROL_CHARS.test(href)) return null;

  const hashIndex = href.indexOf("#");
  const pathAndQuery = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? undefined : href.slice(hashIndex);
  if (pathAndQuery.includes("?")) return null;

  let dir: string;
  try {
    dir = normalizeSettingPath(options.dir, "dir");
  } catch {
    return null;
  }
  const prefix = `/${dir}/`;
  const base = normalizedBase(options.base);
  const candidates = [pathAndQuery];
  if (base !== "" && pathAndQuery.startsWith(`${base}/`)) {
    candidates.push(pathAndQuery.slice(base.length));
  }
  const pathname = candidates.find((candidate) => candidate.startsWith(prefix));
  if (pathname === undefined) return null;
  const encodedPath = pathname.slice(prefix.length);
  if (encodedPath.length === 0) return null;

  try {
    const decodedSegments = encodedPath.split("/").map((segment) => decodeURIComponent(segment));
    if (decodedSegments.some((segment) => segment.includes("/"))) return null;
    const path = normalizeAssetPath(decodedSegments.join("/"));
    return fragment === undefined ? { path } : { path, fragment };
  } catch {
    return null;
  }
}

/** Build the base-prefixed, trailing-slashed asset viewer route exactly once. */
export function assetViewerHref(options: AssetViewerHrefOptions): string {
  const routePrefix = normalizeSettingPath(options.routePrefix, "routePrefix");
  const localePrefix = options.locale === undefined
    ? ""
    : `/${encodeURIComponent(normalizeLocaleSegment(options.locale))}`;
  const href = withBase(
    options.base,
    `${localePrefix}/${routePrefix}/${encodeAssetPathForUrl(options.path)}/`,
  );
  if (options.fragment == null || options.fragment === "") return href;
  if (CONTROL_CHARS.test(options.fragment)) {
    throw new Error("Asset URL fragment must not contain control characters");
  }
  return href + (options.fragment.startsWith("#") ? options.fragment : `#${options.fragment}`);
}

function normalizeLocaleSegment(locale: string): string {
  if (locale.length === 0 || locale.includes("/") || locale.includes("\\")) {
    throw new Error("Asset viewer locale must be a non-empty URL segment");
  }
  if (locale === "." || locale === ".." || CONTROL_CHARS.test(locale)) {
    throw new Error("Asset viewer locale must be a safe URL segment");
  }
  return locale.normalize("NFC");
}

/** Build the base-prefixed URL for the raw public asset. */
export function assetRawHref(options: AssetRawHrefOptions): string {
  const dir = normalizeSettingPath(options.dir, "dir");
  return withBase(options.base, `/${dir}/${encodeAssetPathForUrl(options.path)}`);
}

function normalizeSettingPath(value: string, label: string): string {
  if (value.length === 0) throw new Error(`assetViewer.${label} must not be empty`);
  if (value.startsWith("/") || value.endsWith("/")) {
    throw new Error(`assetViewer.${label} must be relative with no leading or trailing slash`);
  }
  if (value.includes("\\") || CONTROL_CHARS.test(value)) {
    throw new Error(`assetViewer.${label} must be a safe POSIX path`);
  }
  const normalized = value.normalize("NFC");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`assetViewer.${label} must not contain empty or dot segments`);
  }
  return normalized;
}

/** Validate the two relative URL/disk namespaces used by the asset viewer. */
export function validateAssetViewerSettings(settings: AssetViewerPathSettings): void {
  const dir = normalizeSettingPath(settings.dir, "dir");
  const routePrefix = normalizeSettingPath(settings.routePrefix, "routePrefix");
  if (dir === routePrefix) {
    throw new Error("assetViewer.dir and assetViewer.routePrefix must be different");
  }
  if (dir === "assets/client" || routePrefix === "assets/client") {
    throw new Error('assetViewer.dir and assetViewer.routePrefix must not equal reserved "assets/client"');
  }
}

function escapeRegex(char: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char;
}

function globToRegex(glob: string): RegExp {
  let source = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index] ?? "";
    if (char === "*") {
      if (glob[index + 1] === "*") {
        index += 1;
        if (glob[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (char === "{") {
      const close = glob.indexOf("}", index + 1);
      if (close === -1) {
        source += "\\{";
      } else {
        const alternatives = glob.slice(index + 1, close).split(",");
        source += `(?:${alternatives.map((value) => [...value].map(escapeRegex).join("")).join("|")})`;
        index = close;
      }
    } else {
      source += escapeRegex(char);
    }
  }
  return new RegExp(`${source}$`);
}

/**
 * Match a normalized asset path against small, whole-path glob patterns.
 * `*` and `?` do not cross `/`; `**` does; `{a,b}` selects literal alternatives.
 */
export function matchExclude(path: string, globs: readonly string[]): boolean {
  const normalized = normalizeAssetPath(path);
  return globs.some((glob) => globToRegex(glob.normalize("NFC")).test(normalized));
}
