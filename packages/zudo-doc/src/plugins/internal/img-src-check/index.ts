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
  /** The individual URL value as authored in the rendered HTML. */
  src: string;
  /** The element and attribute that supplied `src` (for example `img[src]`). */
  element?: string;
  /** Why the reference was considered broken. */
  reason: string;
}

/** Result returned by the filesystem scanner before reporting. */
export interface ImgSrcCheckResult {
  /** Number of HTML files visited under `outDir`. */
  htmlFileCount: number;
  /** Number of local media/asset references inspected. */
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
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
// The origin is never exposed to generated HTML. It gives URL the absolute
// URL context it needs while allowing us to distinguish local from external
// references after applying a document's <base> element.
const SCANNER_ORIGIN = "https://zudo-doc-img-src-check.invalid";

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

type ResolvedSrc =
  | { kind: "skip" }
  | { kind: "broken"; reason: string }
  | { kind: "path"; path: string };

interface AssetReference {
  src: string;
  element: string;
}

interface ParsedAssetDocument {
  references: AssetReference[];
  baseHrefs: string[];
}

function attributeValue(element: HtmlElement, name: string): string | undefined {
  return element.attrs.find((attribute) => {
    const qualifiedName = attribute.prefix
      ? `${attribute.prefix}:${attribute.name}`
      : attribute.name;
    return qualifiedName.toLowerCase() === name;
  })?.value;
}

function addAssetReference(
  references: AssetReference[],
  element: string,
  attribute: string,
  value: string | undefined,
): void {
  if (value !== undefined) references.push({ src: value, element: `${element}[${attribute}]` });
}

function isHtmlElement(element: HtmlElement, tagName: string): boolean {
  return element.namespaceURI === HTML_NAMESPACE && element.tagName.toLowerCase() === tagName;
}

function isSvgElement(element: HtmlElement, tagName: string): boolean {
  return element.namespaceURI === SVG_NAMESPACE && element.tagName.toLowerCase() === tagName;
}

/**
 * Parse a `srcset` value into its image candidate URLs.
 *
 * This follows the HTML image-candidate parser closely. In particular, the
 * URL token is collected until ASCII whitespace, not by splitting on commas;
 * commas are therefore retained when they are part of a URL and only trailing
 * commas (the candidate separator) are removed. Invalid descriptors discard
 * that candidate, matching browser source-set construction.
 */
function parseSrcsetCandidates(value: string): string[] {
  const candidates: string[] = [];
  let position = 0;

  const isAsciiWhitespace = (character: string | undefined): boolean =>
    character === " " || character === "\t" || character === "\n" || character === "\f" || character === "\r";

  const skipSplittingWhitespaceAndCommas = (): void => {
    while (position < value.length) {
      const character = value[position];
      if (!isAsciiWhitespace(character) && character !== ",") break;
      position += 1;
    }
  };

  const parseDescriptors = (descriptors: string[]): boolean => {
    let width: number | undefined;
    let density: number | undefined;
    let futureCompatH = false;

    for (const descriptor of descriptors) {
      // A valid non-negative integer is an ASCII digit sequence. The width
      // parser rejects zero after conversion, as required by srcset.
      if (/^\d+w$/u.test(descriptor)) {
        if (width !== undefined || density !== undefined) return false;
        const parsed = Number.parseInt(descriptor.slice(0, -1), 10);
        if (!Number.isFinite(parsed) || parsed === 0) return false;
        width = parsed;
        continue;
      }

      // HTML's valid floating-point number grammar permits an optional minus,
      // a decimal point with digits on at least one side, and an optional
      // exponent. A density below zero is invalid; the current HTML algorithm
      // intentionally permits 0x.
      if (/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[Ee][+-]?\d+)?x$/u.test(descriptor)) {
        if (width !== undefined || density !== undefined || futureCompatH) return false;
        const parsed = Number.parseFloat(descriptor.slice(0, -1));
        if (!Number.isFinite(parsed) || parsed < 0) return false;
        density = parsed;
        continue;
      }

      // The parser reserves an `h` descriptor for future compatibility, but
      // it is invalid unless paired with a width descriptor. We do not accept
      // it as a real image candidate because browsers currently discard it.
      if (/^\d+h$/u.test(descriptor)) {
        if (futureCompatH || density !== undefined) return false;
        const parsed = Number.parseInt(descriptor.slice(0, -1), 10);
        if (!Number.isFinite(parsed) || parsed === 0) return false;
        futureCompatH = true;
        continue;
      }

      return false;
    }

    return !futureCompatH || width !== undefined;
  };

  while (position < value.length) {
    skipSplittingWhitespaceAndCommas();
    if (position >= value.length) break;

    const urlStart = position;
    while (position < value.length && !isAsciiWhitespace(value[position])) position += 1;
    let url = value.slice(urlStart, position);
    const hadTrailingComma = url.endsWith(",");
    if (hadTrailingComma) url = url.replace(/,+$/u, "");

    if (url.length === 0) {
      // A comma-only candidate is a parse error, but the splitting loop can
      // still recover and inspect the following candidate.
      continue;
    }

    const descriptors: string[] = [];
    if (!hadTrailingComma) {
      let current = "";
      let inParens = false;
      let descriptorDone = false;

      while (!descriptorDone) {
        const character = value[position];
        if (inParens) {
          if (character === undefined) {
            if (current) descriptors.push(current);
            descriptorDone = true;
          } else {
            current += character;
            position += 1;
            if (character === ")") inParens = false;
          }
          continue;
        }

        if (isAsciiWhitespace(character)) {
          if (current) {
            descriptors.push(current);
            current = "";
          }
          while (isAsciiWhitespace(value[position])) position += 1;
          // A non-whitespace token starts another descriptor. A comma or EOF
          // completes this candidate in the descriptor parser.
          if (value[position] === "," || position >= value.length) {
            descriptorDone = true;
          }
          continue;
        }
        if (character === ",") {
          position += 1;
          if (current) descriptors.push(current);
          descriptorDone = true;
          continue;
        }
        if (character === undefined) {
          if (current) descriptors.push(current);
          descriptorDone = true;
          continue;
        }
        current += character;
        position += 1;
        if (character === "(") inParens = true;
      }
    }

    if (parseDescriptors(descriptors)) candidates.push(url);
  }

  return candidates;
}

function extractAssetReferences(document: DefaultTreeAdapterMap["document"]): ParsedAssetDocument {
  const references: AssetReference[] = [];
  const baseHrefs: string[] = [];

  const visit = (node: HtmlNode, insideTemplate: boolean): void => {
    if (!("tagName" in node)) return;

    const element = node as HtmlElement;

    // A <base> in template content is inert; all other supported references
    // inside a template are still real URLs once the template is activated.
    if (!insideTemplate && isHtmlElement(element, "base")) {
      const href = attributeValue(element, "href");
      if (href !== undefined) baseHrefs.push(href);
    }

    if (isHtmlElement(element, "img")) {
      addAssetReference(references, "img", "src", attributeValue(element, "src"));
      const srcset = attributeValue(element, "srcset");
      if (srcset !== undefined) {
        for (const candidate of parseSrcsetCandidates(srcset)) {
          addAssetReference(references, "img", "srcset", candidate);
        }
      }
    } else if (isHtmlElement(element, "source")) {
      addAssetReference(references, "source", "src", attributeValue(element, "src"));
      const srcset = attributeValue(element, "srcset");
      if (srcset !== undefined) {
        for (const candidate of parseSrcsetCandidates(srcset)) {
          addAssetReference(references, "source", "srcset", candidate);
        }
      }
    } else if (isHtmlElement(element, "video")) {
      addAssetReference(references, "video", "src", attributeValue(element, "src"));
      addAssetReference(references, "video", "poster", attributeValue(element, "poster"));
    } else if (isHtmlElement(element, "audio")) {
      addAssetReference(references, "audio", "src", attributeValue(element, "src"));
    } else if (isHtmlElement(element, "track")) {
      addAssetReference(references, "track", "src", attributeValue(element, "src"));
    } else if (isHtmlElement(element, "input")) {
      const type = attributeValue(element, "type");
      if (type?.trim().toLowerCase() === "image") {
        addAssetReference(references, "input", "src", attributeValue(element, "src"));
      }
    } else if (isSvgElement(element, "image")) {
      addAssetReference(references, "image", "href", attributeValue(element, "href"));
      addAssetReference(references, "image", "xlink:href", attributeValue(element, "xlink:href"));
    }

    for (const child of element.childNodes) visit(child, insideTemplate);

    // Template contents are held in a separate document fragment by parse5.
    if (element.nodeName === "template") {
      const template = element as HtmlTemplate;
      for (const child of template.content.childNodes) visit(child, true);
    }
  };

  for (const child of document.childNodes) visit(child, false);
  return { references, baseHrefs };
}

function makePageUrl(pagePath: string, base: string): URL {
  const pageName = /(?:^|\/)index\.html$/iu.test(pagePath)
    ? pagePath.slice(0, -"index.html".length)
    : pagePath;
  const pathname = `${base}${pageName}`;
  const pageUrl = new URL(SCANNER_ORIGIN);
  // Assigning pathname (rather than concatenating into the URL string) keeps
  // literal `#` and `?` characters in filesystem page names as path data. URL's
  // pathname setter preserves `%`, so escape it explicitly to keep filesystem
  // names such as `100%guide` and `guide%20topic` literal through one decode.
  const filePathname = (pathname.startsWith("/") ? pathname : `/${pathname}`).replaceAll(
    "%",
    "%25",
  );
  pageUrl.pathname = filePathname;
  return pageUrl;
}

function effectiveDocumentBase(pageUrl: URL, hrefs: string[]): URL {
  for (const href of hrefs) {
    const value = href.trim();
    try {
      return new URL(value, pageUrl);
    } catch {
      // Invalid base URLs do not take effect; continue to the next base.
    }
  }
  return pageUrl;
}

function hasAbsolutePathTraversal(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;

  // URL normalisation intentionally removes dot segments. Preserve the
  // existing output-containment guarantee by checking whether the authored
  // absolute path would pop above its URL root before handing it to URL.
  const pathPart = value.split(/[?#]/u, 1)[0] ?? value;
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathPart);
  } catch {
    // The regular URL/path decoder reports malformed escapes separately.
    return false;
  }

  const stack: string[] = [];
  for (const segment of decodedPath.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return true;
      stack.pop();
    } else {
      stack.push(segment);
    }
  }
  return false;
}

function resolveImgSrc(
  src: string,
  outDir: string,
  base: string,
  canonicalOutDir: string,
  documentBase: URL,
): ResolvedSrc {
  const value = src.trim();

  // Check the protocol-relative form before URL parsing because it is also a
  // path beginning with a slash. Fragment-only references never fetch media.
  if (!value || value.startsWith("#") || value.startsWith("//") || SCHEME_RE.test(value)) {
    return { kind: "skip" };
  }
  // A non-hierarchical or cross-origin <base> makes every otherwise-relative
  // reference external. This early check also avoids treating values that
  // cannot be resolved against `data:`/`mailto:` bases as malformed locals.
  if (documentBase.origin !== SCANNER_ORIGIN) return { kind: "skip" };

  let resolvedUrl: URL;
  try {
    resolvedUrl = new URL(value, documentBase);
  } catch {
    return { kind: "broken", reason: "invalid URL" };
  }
  if (resolvedUrl.origin !== SCANNER_ORIGIN) return { kind: "skip" };
  if (hasAbsolutePathTraversal(value)) {
    return { kind: "broken", reason: "resolves outside the build output directory" };
  }

  let decodedPath: string;
  try {
    // URL.pathname has already removed query and fragment components. Decode
    // afterwards so `%3F`/`%23` remain valid literal filename characters.
    decodedPath = decodeURIComponent(resolvedUrl.pathname);
  } catch {
    return { kind: "broken", reason: "malformed percent escape" };
  }
  if (decodedPath.includes("\0")) {
    return { kind: "broken", reason: "invalid path" };
  }
  // URL treats backslashes as separators for special (HTTP) URLs. Normalize
  // them here as well so encoded backslashes cannot bypass POSIX containment.
  decodedPath = decodedPath.replaceAll("\\", "/");

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
 * Walk every built HTML file and validate its local media/asset references.
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
    // Avoid invoking the full HTML parser for the common page with no media
    // markup. This is only a positive prefilter; parse5 remains authoritative
    // whenever a possible media token occurs, including in comments/scripts.
    if (!/<(?:img|source|video|audio|track|input|image)\b/iu.test(html)) continue;
    const document = parse(html);
    const parsed = extractAssetReferences(document);
    const documentBase = effectiveDocumentBase(makePageUrl(pagePath, base), parsed.baseHrefs);
    for (const reference of parsed.references) {
      const resolved = resolveImgSrc(reference.src, outDir, base, canonicalOutDir, documentBase);
      if (resolved.kind === "skip") continue;
      imageCount += 1;
      if (resolved.kind === "broken") {
        broken.push({ pagePath, src: reference.src, element: reference.element, reason: resolved.reason });
      }
    }
  }

  return { htmlFileCount: htmlFiles.length, imageCount, broken };
}

/** Format one warning in a stable, page-first form suitable for zfb output. */
export function formatBrokenImgSrc(reference: BrokenImgSrc): string {
  const element = reference.element ? `${reference.element} ` : "";
  return `[img-src-check] Broken image source in ${reference.pagePath}: ${element}${reference.src} (${reference.reason})`;
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
