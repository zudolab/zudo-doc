import { realpathSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";

/** Severity used by the raw image-source check. */
export type ImgSrcCheckSeverity = "warn" | "error" | "ignore";

/** Logger surface needed by the scanner's reporting phase. */
export interface ImgSrcCheckLogger {
  warn(message: string): void;
}

/** One raw image reference that could not be resolved to a file. */
export interface BrokenImgSrc {
  /** HTML page path relative to the build output directory. */
  pagePath: string;
  /** The decoded attribute value as authored in the rendered HTML. */
  src: string;
  /** Why the reference was considered broken. */
  reason: string;
}

/** Result returned by the filesystem scanner before reporting. */
export interface ImgSrcCheckResult {
  /** Number of HTML files visited under `outDir`. */
  htmlFileCount: number;
  /** Number of site-absolute `src` attributes inspected. */
  imageCount: number;
  /** Every broken occurrence, including duplicate references. */
  broken: BrokenImgSrc[];
}

/** Options for scanning and reporting built HTML. */
export interface ImgSrcCheckOptions {
  /** Absolute or relative build output directory. */
  outDir: string;
  /** URL base configured for the build (for example `/docs/`). */
  base?: string;
  /** Broken-reference behavior. Defaults to `warn`. */
  onBroken?: ImgSrcCheckSeverity;
  /** zfb's logger. A missing logger makes the scan quiet. */
  logger?: ImgSrcCheckLogger;
}

type HtmlNode = DefaultTreeAdapterMap["childNode"];
type HtmlElement = DefaultTreeAdapterMap["element"];
type HtmlTemplate = DefaultTreeAdapterMap["template"];

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

/**
 * Parse rendered HTML and return the `src` values on real `<img>` elements.
 *
 * parse5 performs HTML tokenisation (including comment/script handling) and
 * decodes character references in attribute values. Walking its element tree
 * therefore avoids false positives from comments, script bodies, and escaped
 * code examples without trying to emulate an HTML parser with regular
 * expressions.
 */
export function extractImgSrcs(html: string): string[] {
  const document = parse(html);
  const srcs: string[] = [];

  const visit = (node: HtmlNode): void => {
    if (!("tagName" in node)) return;

    const element = node as HtmlElement;
    if (element.tagName.toLowerCase() === "img" && element.namespaceURI === HTML_NAMESPACE) {
      const src = element.attrs.find((attribute) => attribute.name.toLowerCase() === "src")?.value;
      if (src !== undefined) srcs.push(src);
    }

    for (const child of element.childNodes) visit(child);

    // Template contents are held in a separate document fragment by parse5.
    // They are still real HTML elements and should be checked if a generated
    // page embeds an image in a template.
    if (element.nodeName === "template") {
      const template = element as HtmlTemplate;
      for (const child of template.content.childNodes) visit(child);
    }
  };

  for (const child of document.childNodes) visit(child);
  return srcs;
}

/** Normalize a zfb base to a slash-delimited URL prefix. */
export function normalizeImgSrcBase(base: string | undefined): string {
  if (!base || base === "/") return "/";
  const withLeadingSlash = base.startsWith("/") ? base : `/${base}`;
  const segments = withLeadingSlash.split("/").filter(Boolean);
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep));
}

function stripQueryAndFragment(src: string): string {
  const query = src.indexOf("?");
  const fragment = src.indexOf("#");
  const end = [query, fragment].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return end === undefined ? src : src.slice(0, end);
}

type ResolvedSrc =
  | { kind: "skip" }
  | { kind: "broken"; reason: string }
  | { kind: "path"; path: string };

function resolveImgSrc(
  src: string,
  outDir: string,
  base: string,
  canonicalOutDir: string,
): ResolvedSrc {
  const value = src.trim();

  // Site-absolute URLs are the only references this check owns. Check the
  // protocol-relative form first because it also starts with a slash.
  if (!value.startsWith("/") || value.startsWith("//") || SCHEME_RE.test(value)) {
    return { kind: "skip" };
  }

  const pathPart = stripQueryAndFragment(value);
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathPart);
  } catch {
    return { kind: "broken", reason: "malformed percent escape" };
  }
  if (decodedPath.includes("\0")) {
    return { kind: "broken", reason: "invalid path" };
  }

  let relativeUrlPath: string;
  if (base === "/") {
    relativeUrlPath = decodedPath.slice(1).replace(/^\/+/, "");
  } else {
    const baseWithoutTrailingSlash = base.slice(0, -1);
    if (decodedPath === baseWithoutTrailingSlash || decodedPath.startsWith(base)) {
      relativeUrlPath = decodedPath.slice(base.length).replace(/^\/+/, "");
    } else {
      return { kind: "broken", reason: `outside configured base ${base}` };
    }
  }

  const candidate = resolve(outDir, relativeUrlPath);
  if (!isWithin(outDir, candidate)) {
    return { kind: "broken", reason: "resolves outside the build output directory" };
  }

  let stat;
  try {
    stat = statSync(candidate);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { kind: "broken", reason: "file does not exist" };
    }
    throw error;
  }
  if (!stat.isFile()) return { kind: "broken", reason: "path is not a file" };

  // `statSync` follows symlinks. Check the canonical target as well as the
  // lexical path so an in-output symlink cannot make an outside file appear
  // to satisfy the URL (the output containment contract is about the actual
  // file served).
  try {
    if (!isWithin(canonicalOutDir, realpathSync(candidate))) {
      return { kind: "broken", reason: "resolves outside the build output directory" };
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { kind: "broken", reason: "file does not exist" };
    }
    throw error;
  }
  return { kind: "path", path: candidate };
}

function listHtmlFiles(outDir: string): string[] {
  const files: string[] = [];
  if (!statSync(outDir).isDirectory()) return files;

  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const filePath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(filePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
        files.push(filePath);
      }
    }
  };

  walk(outDir);
  return files;
}

/**
 * Walk every built HTML file and validate its site-absolute image sources.
 *
 * This is intentionally synchronous: zfb's postBuild hook is async-compatible
 * but the operation is a deterministic local filesystem walk, and a sync
 * implementation keeps result ordering stable for warnings and tests.
 */
export function scanImgSrcs(options: ImgSrcCheckOptions): ImgSrcCheckResult {
  const outDir = resolve(options.outDir);
  let canonicalOutDir: string;
  try {
    canonicalOutDir = realpathSync(outDir);
  } catch (error) {
    // A missing output directory has no HTML to inspect. This also keeps the
    // scanner safe when a caller probes an output path before the first build.
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { htmlFileCount: 0, imageCount: 0, broken: [] };
    }
    throw error;
  }
  const base = normalizeImgSrcBase(options.base);
  const htmlFiles = listHtmlFiles(outDir);
  const broken: BrokenImgSrc[] = [];
  let imageCount = 0;

  for (const htmlFile of htmlFiles) {
    const pagePath = relative(outDir, htmlFile).split(sep).join("/");
    const html = readFileSync(htmlFile, "utf8");
    // Avoid invoking the full HTML parser for the common page with no image
    // markup. This is only a positive prefilter; parse5 remains authoritative
    // whenever a possible `<img>` token occurs, including in comments/scripts.
    if (!/<img\b/iu.test(html)) continue;
    for (const src of extractImgSrcs(html)) {
      const resolved = resolveImgSrc(src, outDir, base, canonicalOutDir);
      if (resolved.kind === "skip") continue;
      imageCount += 1;
      if (resolved.kind === "broken") {
        broken.push({ pagePath, src, reason: resolved.reason });
      }
    }
  }

  return { htmlFileCount: htmlFiles.length, imageCount, broken };
}

/** Format one warning in a stable, page-first form suitable for zfb output. */
export function formatBrokenImgSrc(reference: BrokenImgSrc): string {
  return `[img-src-check] Broken image source in ${reference.pagePath}: ${reference.src} (${reference.reason})`;
}

/**
 * Run the scanner and report every broken occurrence. Error mode reports the
 * complete set first, then throws so zfb fails the build with all diagnostics.
 */
export function checkImgSrcs(options: ImgSrcCheckOptions): ImgSrcCheckResult {
  const severity = options.onBroken ?? "warn";
  if (severity === "ignore") {
    return { htmlFileCount: 0, imageCount: 0, broken: [] };
  }

  const result = scanImgSrcs(options);
  if (result.broken.length === 0) return result;

  if (options.logger) {
    for (const reference of result.broken) options.logger.warn(formatBrokenImgSrc(reference));
    options.logger.warn(
      `[img-src-check] Found ${result.broken.length} broken image source${result.broken.length === 1 ? "" : "s"} in ${result.htmlFileCount} HTML file${result.htmlFileCount === 1 ? "" : "s"}.`,
    );
  }

  if (severity === "error") {
    throw new Error(
      `[img-src-check] Build contains ${result.broken.length} broken image source${result.broken.length === 1 ? "" : "s"}.`,
    );
  }
  return result;
}

// Descriptive aliases keep the internal scanner convenient for callers that
// refer to the feature as "image sources" rather than its short plugin name.
export const extractImageSources = extractImgSrcs;
export const scanImageSources = scanImgSrcs;
export const checkImageSources = checkImgSrcs;
