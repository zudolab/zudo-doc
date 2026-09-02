#!/usr/bin/env node

/**
 * check-links.js — Post-build broken link checker
 *
 * Mode 1: Scan built HTML in dist/ for broken internal links and anchors
 * Mode 2: Scan MDX source for absolute links and invalid fragment targets
 */

import { readFile, readdir, access, stat } from "node:fs/promises";
import { join, extname, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractHeadings,
  slugify,
} from "@takazudo/zudo-doc/extract-headings";

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// --- Utilities ---

const CLI_USAGE = `Usage: pnpm check:links -- [options]

Options:
  -h, --help           Show this help
  --strict-broken      Fail when broken links remain after the allowlist
  --strict-absolute    Fail when absolute MDX links remain after the allowlist
  --strict-anchors     Fail when invalid anchors remain after the allowlist
  --strict-trailing    Fail when trailing-slash warnings remain after the allowlist
  --allowlist=PATH     Exclude exact <file>:<line>:<href> entries from failure counts`;

class CliArgumentError extends Error {}

function parseCliArgs(argv) {
  const result = {
    help: false,
    strictBroken: false,
    strictAbsolute: false,
    strictAnchors: false,
    strictTrailing: false,
    allowlistPath: null,
  };

  for (const arg of argv) {
    // A package manager normally consumes its `--` separator. Accept it here
    // too so direct `node scripts/check-links.js -- ...` usage stays convenient.
    if (arg === "--") continue;
    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "--strict-broken") {
      result.strictBroken = true;
    } else if (arg === "--strict-absolute") {
      result.strictAbsolute = true;
    } else if (arg === "--strict-anchors") {
      result.strictAnchors = true;
    } else if (arg === "--strict-trailing") {
      result.strictTrailing = true;
    } else if (arg.startsWith("--allowlist=")) {
      const allowlistPath = arg.slice("--allowlist=".length);
      if (!allowlistPath) {
        throw new CliArgumentError("--allowlist requires a non-empty path");
      }
      result.allowlistPath = allowlistPath;
    } else {
      throw new CliArgumentError(`Unknown option: ${arg}\n\n${CLI_USAGE}`);
    }
  }

  return result;
}

export async function parseBasePath(settingsPath) {
  const content = await readFile(settingsPath, "utf-8");
  const match = content.match(/base:\s*["']([^"']*)["']/);
  return match ? match[1] : "/";
}

export async function parseTrailingSlash(settingsPath) {
  const content = await readFile(settingsPath, "utf-8");
  const match = content.match(/trailingSlash:\s*(true|false)/);
  return match ? match[1] === "true" : false;
}

export async function parseContentDirs(settingsPath) {
  const content = await readFile(settingsPath, "utf-8");

  // Extract docsDir
  const docsDirMatch = content.match(/docsDir:\s*["']([^"']*)["']/);
  const docsDir = docsDirMatch ? docsDirMatch[1] : "src/content/docs";

  // Extract locale keys and dirs from `locales: { ja: { dir: "..." } }` entries
  // (top-level and per-version). Locale keys (e.g. "ja", "de") are captured so
  // the MDX link scanner can build a dynamic alternation instead of hardcoding
  // a hard-coded locale alternation.
  const localeDirs = [];
  const localeKeys = [];
  // Match locale block entries: `  ja: { ... dir: "..." ... }` or `ja: { dir: "..." }`
  const localeBlockRegex = /\b([a-z]{2,5})\s*:\s*\{[^}]*\bdir:\s*["']([^"']*)["'][^}]*\}/g;
  let blockMatch;
  while ((blockMatch = localeBlockRegex.exec(content)) !== null) {
    const key = blockMatch[1];
    const dir = blockMatch[2];
    if (!dir || dir === docsDir) continue;
    if (!localeDirs.includes(dir)) localeDirs.push(dir);
    if (!localeKeys.includes(key)) localeKeys.push(key);
  }
  // Fallback: if block regex missed any dir: entries, capture them without keys
  const dirOnlyRegex = /\bdir:\s*["']([^"']*)["']/g;
  let dirMatch;
  while ((dirMatch = dirOnlyRegex.exec(content)) !== null) {
    const dir = dirMatch[1];
    if (dir && dir !== docsDir && !localeDirs.includes(dir)) {
      localeDirs.push(dir);
    }
  }

  return { docsDir, localeDirs, localeKeys };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function collectFiles(dir, extensions) {
  const results = [];

  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results.sort();
}

// --- HTML Link Extraction ---

const HTML_NAMED_CHARACTER_REFERENCES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

function decodeHtmlAttributeValue(value) {
  return value.replace(
    /&(?:#([0-9]+)|#x([0-9a-f]+)|(amp|apos|gt|lt|quot));/gi,
    (_reference, decimal, hexadecimal, named) => {
      if (named !== undefined) {
        return HTML_NAMED_CHARACTER_REFERENCES[named.toLowerCase()];
      }
      const codePoint = Number.parseInt(
        hexadecimal ?? decimal,
        hexadecimal === undefined ? 10 : 16,
      );
      if (
        codePoint === 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return "\uFFFD";
      }
      return String.fromCodePoint(codePoint);
    },
  );
}

export function extractHtmlLinks(html) {
  const links = [];
  const regex = /<a(?=\s)[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`\\]+))[^>]*>/gi;
  let match;
  let lastIndex = 0;
  let currentLine = 1;
  while ((match = regex.exec(html)) !== null) {
    const href = decodeHtmlAttributeValue(match[1] ?? match[2] ?? match[3]);
    if (/^https?:\/\//i.test(href)) continue;
    if (/^\/\//.test(href)) continue;
    if (/^mailto:/i.test(href)) continue;
    if (/^javascript:/i.test(href)) continue;
    if (/^data:/i.test(href)) continue;
    if (/^tel:/i.test(href)) continue;

    for (let i = lastIndex; i < match.index; i++) {
      if (html[i] === '\n') currentLine++;
    }
    lastIndex = match.index;
    links.push({ href, line: currentLine });
  }
  return links;
}

export function extractHtmlIds(html) {
  const ids = [];
  const regex = /<[A-Za-z][^>]*?\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`\\]+))[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    ids.push(decodeHtmlAttributeValue(match[1] ?? match[2] ?? match[3]));
  }
  return ids;
}

// --- Link Resolution ---

/**
 * Decode percent-encoding for build outputs that use decoded filesystem names.
 * Other zfb outputs preserve encoded route segments on disk, so dist resolution
 * tries the literal URL path first and this decoded form second. Malformed
 * sequences (stray "%") pass through unchanged.
 */
function safeDecodePath(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function parseHref(href) {
  const hashAt = href.indexOf("#");
  const beforeFragment = hashAt === -1 ? href : href.slice(0, hashAt);
  const queryAt = beforeFragment.indexOf("?");
  const rawPath = queryAt === -1
    ? beforeFragment
    : beforeFragment.slice(0, queryAt);
  const rawFragment = hashAt === -1 ? null : href.slice(hashAt + 1);

  if (rawFragment === null) {
    return {
      path: safeDecodePath(rawPath),
      rawPath,
      fragment: null,
      fragmentError: null,
    };
  }
  if (rawFragment === "") {
    return {
      path: safeDecodePath(rawPath),
      rawPath,
      fragment: "",
      fragmentError: "empty fragment",
    };
  }
  try {
    return {
      path: safeDecodePath(rawPath),
      rawPath,
      fragment: decodeURIComponent(rawFragment),
      fragmentError: null,
    };
  } catch {
    return {
      path: safeDecodePath(rawPath),
      rawPath,
      fragment: rawFragment,
      fragmentError: "malformed percent-encoding",
    };
  }
}

async function resolveBuiltPath(path, distDir, basePath, fileDir) {
  let absolute = path;
  if (!path.startsWith("/")) {
    const dirInDist = fileDir ? relative(distDir, fileDir) : "";
    absolute = "/" + join(dirInDist, path);
  }

  let stripped = absolute;
  if (basePath !== "/" && stripped.startsWith(basePath)) {
    stripped = "/" + stripped.slice(basePath.length);
  }

  const relPath = stripped.startsWith("/") ? stripped.slice(1) : stripped;
  if (!relPath) {
    return { type: "root", targetFile: join(distDir, "index.html") };
  }

  // A terminal slash is an explicit directory request, even when the
  // directory name contains a dot (for example, /files/demo/x.js/). Check it
  // before extname() so viewer pages can keep their trailing-slash route and
  // still receive fragment validation against index.html.
  if (relPath.endsWith("/")) {
    const indexFile = join(distDir, relPath, "index.html");
    return (await fileExists(indexFile))
      ? { type: "directoryIndex", targetFile: indexFile }
      : { type: "missing", targetFile: null };
  }

  if (extname(relPath)) {
    const targetFile = join(distDir, relPath);
    return (await fileExists(targetFile))
      ? { type: "file", targetFile }
      : { type: "missing", targetFile: null };
  }

  const indexFile = join(distDir, relPath, "index.html");
  if (await fileExists(indexFile)) {
    return { type: "directoryIndex", targetFile: indexFile };
  }
  const htmlFile = join(distDir, relPath + ".html");
  if (await fileExists(htmlFile)) {
    return { type: "file", targetFile: htmlFile };
  }
  return { type: "missing", targetFile: null };
}

async function resolveLinkTargetDetail(
  href,
  distDir,
  basePath = "/",
  fileDir = "",
  sourceFile = null,
) {
  const {
    path: decodedPath,
    rawPath,
    fragment,
    fragmentError,
  } = parseHref(href);
  if (!rawPath) {
    return {
      type: "root",
      targetFile: sourceFile ?? join(distDir, "index.html"),
      fragment,
      fragmentError,
    };
  }

  const pathCandidates = rawPath === decodedPath
    ? [rawPath]
    : [rawPath, decodedPath];
  for (const path of pathCandidates) {
    const detail = await resolveBuiltPath(path, distDir, basePath, fileDir);
    if (detail.type !== "missing") {
      return { ...detail, fragment, fragmentError };
    }
  }
  return { type: "missing", targetFile: null, fragment, fragmentError };
}

/**
 * Resolve a link and return its resolution type:
 *   'root'           — empty path or resolves to the site root (always valid)
 *   'file'           — resolved to a file with an extension or a .html file
 *   'directoryIndex' — resolved via dir/index.html (page link without trailing slash)
 *   'missing'        — target does not exist
 */
export async function resolveLinkDetail(href, distDir, basePath = "/", fileDir = "") {
  return (await resolveLinkTargetDetail(href, distDir, basePath, fileDir)).type;
}

export async function resolveLink(href, distDir, basePath = "/", fileDir = "") {
  const type = await resolveLinkDetail(href, distDir, basePath, fileDir);
  return type !== "missing";
}

// --- MDX Source Scan ---

/**
 * Strip inline-code spans from a line before running link regexes.
 * Handles double-backtick spans (``...``) and single-backtick spans (`...`).
 * Escaped backticks (\`) are ignored.
 */
export function stripInlineCode(line) {
  // Replace double-backtick spans first to avoid partial single-backtick matches
  let result = line.replace(/(?<!\\)``[^`]*(?:``|$)/g, (m) => " ".repeat(m.length));
  // Replace single-backtick spans
  result = result.replace(/(?<!\\)`[^`]*(?:`|$)/g, (m) => " ".repeat(m.length));
  return result;
}

function assertLocaleList(locales) {
  if (!Array.isArray(locales) || !locales.every((locale) => typeof locale === "string")) {
    throw new TypeError("locales must be passed explicitly as an array of locale keys");
  }
}

export function extractMdxAbsoluteLinks(content, locales) {
  assertLocaleList(locales);
  // Build a locale prefix alternation from the provided locale keys.
  // The alternation is escaped for use inside a regex, then wrapped in
  // `(?:<locale>/)?` so the pattern matches both bare `/docs/...` and every
  // configured locale path such as `/de/docs/...`.
  const localeAlternation = locales.length > 0
    ? `(?:${locales.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\/").join("|")})?`
    : "";
  // e.g. ["ja","de"] → "(?:ja\/|de\/)?" so the regex matches /ja/docs/... and /de/docs/...

  const issues = [];
  const lines = content.split("\n");
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^```/.test(line.trimStart())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const searchLine = stripInlineCode(line);

    // Markdown link syntax: [text](/docs/...) or [text](/<locale>/docs/...)
    const mdRegex = new RegExp(`\\]\\((\\/${localeAlternation}docs\\/[^)]*)\\)`, "g");
    let match;
    while ((match = mdRegex.exec(searchLine)) !== null) {
      issues.push({ href: match[1], line: i + 1 });
    }

    // JSX href attributes: href="/docs/..." or href="/<locale>/docs/..."
    const jsxRegex = new RegExp(`href="(\\/${localeAlternation}docs\\/[^"]*)"`, "g");
    while ((match = jsxRegex.exec(searchLine)) !== null) {
      issues.push({ href: match[1], line: i + 1 });
    }
  }

  return issues;
}

/** Extract internal MDX/Markdown links that carry a fragment. */
export function extractMdxFragmentLinks(content) {
  const links = [];
  const lines = content.split("\n");
  let codeFenceOpener = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^([`~]{3,})/.exec(line.trimStart())?.[1];
    if (fence !== undefined) {
      if (codeFenceOpener === null) codeFenceOpener = fence;
      else if (
        fence[0] === codeFenceOpener[0] &&
        fence.length >= codeFenceOpener.length
      ) {
        codeFenceOpener = null;
      }
      continue;
    }
    if (codeFenceOpener !== null) continue;

    const searchLine = stripInlineCode(line);
    let match;
    const markdownLink = /\]\(\s*([^\s)#]*#[^\s)]*)(?:\s+[^)]*)?\)/g;
    while ((match = markdownLink.exec(searchLine)) !== null) {
      const href = match[1];
      if (!/^(?:https?:|\/\/|mailto:|javascript:|data:|tel:)/i.test(href)) {
        links.push({ href, line: i + 1 });
      }
    }

    const jsxHref = /\bhref\s*=\s*(?:"([^"]*#[^"]*)"|'([^']*#[^']*)')/g;
    while ((match = jsxHref.exec(searchLine)) !== null) {
      const href = match[1] ?? match[2];
      if (!/^(?:https?:|\/\/|mailto:|javascript:|data:|tel:)/i.test(href)) {
        links.push({ href, line: i + 1 });
      }
    }
  }

  return links;
}

function headingText(raw) {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<![\w])__([^_]+)__(?![\w])/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(?<![\w])_([^_]+)_(?![\w])/g, "$1")
    .trim();
}

/** All-depth mirror of the renderer's hierarchical SlugAllocator. */
function allHierarchicalHeadingIds(body) {
  const ids = new Set(extractHeadings(body).map((heading) => heading.slug));
  const seen = new Map();
  const stack = [];
  let codeFenceOpener = null;

  for (const line of body.split("\n")) {
    const fence = /^([`~]{3,})/.exec(line.trimStart())?.[1];
    if (fence !== undefined) {
      if (codeFenceOpener === null) codeFenceOpener = fence;
      else if (
        fence[0] === codeFenceOpener[0] &&
        fence.length >= codeFenceOpener.length
      ) {
        codeFenceOpener = null;
      }
      continue;
    }
    if (codeFenceOpener !== null) continue;

    const match = /^(#{2,6})[ \t]+(.+)$/.exec(line.trim());
    if (match === null) continue;
    const depth = match[1].length;
    const base = slugify(headingText(match[2]));
    if (base === "") continue;

    while ((stack.at(-1)?.depth ?? -1) >= depth) stack.pop();
    const parent = stack.at(-1);
    const candidate = parent === undefined ? base : `${parent.id}-${base}`;
    const count = seen.get(candidate) ?? 0;
    seen.set(candidate, count + 1);
    const id = count === 0 ? candidate : `${candidate}-${count}`;
    stack.push({ depth, id });
    ids.add(id);
  }
  return ids;
}

function extractStaticMdxIds(body) {
  const ids = new Set();
  let codeFenceOpener = null;
  const visibleLines = [];
  for (const line of body.split("\n")) {
    const fence = /^([`~]{3,})/.exec(line.trimStart())?.[1];
    if (fence !== undefined) {
      if (codeFenceOpener === null) codeFenceOpener = fence;
      else if (
        fence[0] === codeFenceOpener[0] &&
        fence.length >= codeFenceOpener.length
      ) {
        codeFenceOpener = null;
      }
      visibleLines.push("");
      continue;
    }
    visibleLines.push(codeFenceOpener === null ? stripInlineCode(line) : "");
  }

  const elements = visibleLines.join("\n");
  const regex = /<[A-Za-z][^>]*\bid\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gs;
  let match;
  while ((match = regex.exec(elements)) !== null) {
    ids.add(match[1] ?? match[2]);
  }
  return ids;
}

async function resolveMdxTarget(sourceFile, href, contentDirs, locales, basePath) {
  const { path: decodedPath } = parseHref(href);
  let rawPath = decodedPath;
  if (basePath !== "/" && rawPath.startsWith(basePath)) {
    rawPath = "/" + rawPath.slice(basePath.length);
  }

  let target;
  if (rawPath === "") {
    target = sourceFile;
  } else if (rawPath.startsWith("/docs/")) {
    target = resolve(contentDirs[0], rawPath.slice("/docs/".length));
  } else {
    const locale = locales.find((key) => rawPath.startsWith(`/${key}/docs/`));
    if (locale !== undefined) {
      const localeIndex = locales.indexOf(locale);
      const localeDir = contentDirs[localeIndex + 1];
      if (localeDir === undefined) return null;
      target = resolve(localeDir, rawPath.slice(`/${locale}/docs/`.length));
    } else if (rawPath.startsWith("/")) {
      return null;
    } else {
      target = resolve(dirname(sourceFile), rawPath);
    }
  }

  const candidates = extname(target)
    ? [target]
    : [
        target,
        `${target}.mdx`,
        `${target}.md`,
        resolve(target, "index.mdx"),
        resolve(target, "index.md"),
      ];
  for (const candidate of candidates) {
    if (await fileExists(candidate) && (await stat(candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

export async function checkMdxAnchors(
  contentDirs,
  rootDir,
  basePath = "/",
  locales,
  excludePatterns = [],
) {
  assertLocaleList(locales);
  const anchors = [];
  const idCache = new Map();

  for (const dir of contentDirs) {
    if (!(await fileExists(dir))) continue;
    const files = await collectFiles(dir, [".mdx", ".md"]);
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      for (const { href, line } of extractMdxFragmentLinks(content)) {
        if (excludePatterns.some((pattern) => pattern.test(href))) continue;
        const parsed = parseHref(href);
        if (parsed.fragmentError !== null) {
          anchors.push({
            file: relative(rootDir, file),
            line,
            href,
            fragment: parsed.fragment,
            reason: parsed.fragmentError,
          });
          continue;
        }

        const target = await resolveMdxTarget(file, href, contentDirs, locales, basePath);
        if (target === null) continue;
        let ids = idCache.get(target);
        if (ids === undefined) {
          const targetBody = await readFile(target, "utf-8");
          ids = allHierarchicalHeadingIds(targetBody);
          for (const id of extractStaticMdxIds(targetBody)) ids.add(id);
          idCache.set(target, ids);
        }
        if (!ids.has(parsed.fragment)) {
          anchors.push({
            file: relative(rootDir, file),
            line,
            href,
            fragment: parsed.fragment,
            reason: "missing target id",
          });
        }
      }
    }
  }
  return anchors;
}

// --- Main Check Functions ---

/**
 * Single-pass dist walker: collects broken links and (optionally) trailing-
 * slash warnings in one read of every HTML file.
 *
 * When `checkTrailing` is false the trailing-slash warnings array is always
 * empty; callers that don't need it pay no extra cost.
 */
export async function checkHtmlLinksAndTrailing(
  distDir,
  rootDir,
  basePath = "/",
  excludePatterns = [],
  checkTrailing = false,
) {
  const broken = [];
  const anchors = [];
  const trailingSlash = [];
  const htmlFiles = await collectFiles(distDir, [".html"]);
  // One shared cache keyed by resolution type ("root"|"file"|"directoryIndex"|"missing").
  // Both checks read from the same resolved detail so each href is stat'd once.
  const cache = new Map();
  const idCache = new Map();
  const pages = [];
  const scanned = { links: 0, ids: 0 };

  for (const file of htmlFiles) {
    const content = await readFile(file, "utf-8");
    const links = extractHtmlLinks(content);
    const ids = extractHtmlIds(content);
    scanned.links += links.length;
    scanned.ids += ids.length;
    idCache.set(file, new Set(ids));
    pages.push({ file, links });
  }

  for (const { file, links } of pages) {
    const fileDir = dirname(file);
    const relFile = relative(rootDir, file);

    for (const { href, line } of links) {
      if (excludePatterns.some((p) => p.test(href))) continue;

      // Cache key: absolute links use href only; relative and local-fragment
      // links include their exact source file.
      const cacheKey = href.startsWith("/") ? href : `${file}:${href}`;
      let detail;
      if (cache.has(cacheKey)) {
        detail = cache.get(cacheKey);
      } else {
        detail = await resolveLinkTargetDetail(
          href,
          distDir,
          basePath,
          fileDir,
          file,
        );
        cache.set(cacheKey, detail);
      }
      const { type } = detail;

      // Broken-link check
      if (type === "missing") {
        broken.push({ file: relFile, line, href });
      }

      if (detail.fragment !== null) {
        let reason = detail.fragmentError;
        if (
          reason === null &&
          type !== "missing" &&
          detail.targetFile !== null &&
          extname(detail.targetFile) === ".html"
        ) {
          let ids = idCache.get(detail.targetFile);
          if (ids === undefined) {
            const targetHtml = await readFile(detail.targetFile, "utf-8");
            const targetIds = extractHtmlIds(targetHtml);
            scanned.ids += targetIds.length;
            ids = new Set(targetIds);
            idCache.set(detail.targetFile, ids);
          }
          if (!ids.has(detail.fragment)) reason = "missing target id";
        }
        if (reason !== null) {
          anchors.push({
            file: relFile,
            line,
            href,
            fragment: detail.fragment,
            reason,
          });
        }
      }

      // Trailing-slash check (opt-in)
      if (checkTrailing) {
        const pathPart = href.split("#")[0].split("?")[0];
        // Skip root-like paths, links already with trailing slash, and assets
        if (
          pathPart &&
          pathPart !== "/" &&
          pathPart !== "." &&
          pathPart !== "./" &&
          !pathPart.endsWith("/") &&
          !extname(pathPart) &&
          type === "directoryIndex"
        ) {
          trailingSlash.push({ file: relFile, line, href });
        }
      }
    }
  }

  return { broken, anchors, trailingSlash, scanned };
}

export async function checkMdxLinks(contentDirs, rootDir, distDir = null, basePath = "/", locales) {
  assertLocaleList(locales);
  const warnings = [];

  for (const dir of contentDirs) {
    if (!(await fileExists(dir))) continue;
    const files = await collectFiles(dir, [".mdx", ".md"]);

    for (const file of files) {
      const content = await readFile(file, "utf-8");
      const issues = extractMdxAbsoluteLinks(content, locales);

      for (const { href, line } of issues) {
        // If dist/ is available, drop warnings for hrefs that resolve to built routes
        if (distDir && (await resolveLink(href, distDir, basePath))) continue;
        warnings.push({ file: relative(rootDir, file), line, href });
      }
    }
  }

  return warnings;
}

// --- Report ---

export function formatReport(
  brokenLinks,
  mdxWarnings,
  trailingSlashWarnings = [],
  anchorWarnings = [],
) {
  const lines = [];

  if (brokenLinks.length > 0) {
    lines.push("=== Broken Links in Built HTML ===");
    for (const { file, line, href } of brokenLinks) {
      lines.push(`  ${file}:${line}  ${href}`);
    }
    lines.push("");
  }

  if (mdxWarnings.length > 0) {
    lines.push("=== Absolute Links Bypassing Base Path (MDX Source) ===");
    for (const { file, line, href } of mdxWarnings) {
      lines.push(`  ${file}:${line}  ${href}`);
    }
    lines.push("");
  }

  if (trailingSlashWarnings.length > 0) {
    lines.push("=== Links Missing Trailing Slash ===");
    for (const { file, line, href } of trailingSlashWarnings) {
      lines.push(`  ${file}:${line}  ${href}`);
    }
    lines.push("");
  }

  if (anchorWarnings.length > 0) {
    lines.push("=== Invalid Anchors ===");
    for (const { file, line, href, fragment, reason } of anchorWarnings) {
      lines.push(
        `  ${file}:${line}  ${href}  (fragment: #${fragment}; ${reason})`,
      );
    }
    lines.push("");
  }

  const total =
    brokenLinks.length +
    mdxWarnings.length +
    trailingSlashWarnings.length +
    anchorWarnings.length;
  if (total > 0) {
    const parts = [];
    if (brokenLinks.length > 0) {
      parts.push(
        `${brokenLinks.length} broken link${brokenLinks.length === 1 ? "" : "s"}`,
      );
    }
    if (mdxWarnings.length > 0) {
      parts.push(
        `${mdxWarnings.length} absolute path warning${mdxWarnings.length === 1 ? "" : "s"}`,
      );
    }
    if (trailingSlashWarnings.length > 0) {
      parts.push(
        `${trailingSlashWarnings.length} trailing slash warning${trailingSlashWarnings.length === 1 ? "" : "s"}`,
      );
    }
    if (anchorWarnings.length > 0) {
      parts.push(
        `${anchorWarnings.length} invalid anchor${anchorWarnings.length === 1 ? "" : "s"}`,
      );
    }
    lines.push(`✗ Found ${parts.join(" and ")}`);
  } else {
    lines.push("✓ No broken links, invalid anchors, or absolute path issues found");
  }

  return lines.join("\n");
}

// --- Allowlist ---

/**
 * Read the allowlist file (one entry per line; comment-only lines skipped).
 * Each non-blank line is a literal `<file>:<line>:<href>` exact match.
 * Returns a Set for O(1) lookup against `entryKey()` output below.
 */
export async function readAllowlist(allowlistPath) {
  if (!allowlistPath) return new Set();
  if (!(await fileExists(allowlistPath))) return new Set();
  const text = await readFile(allowlistPath, "utf-8");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("#"))
    .filter((l) => l.length > 0);
  return new Set(lines);
}

function entryKey(e) {
  return `${e.file}:${e.line}:${e.href}`;
}

// --- Main ---

async function main() {
  const {
    help,
    strictBroken,
    strictAbsolute,
    strictAnchors,
    strictTrailing,
    allowlistPath,
  } = parseCliArgs(process.argv.slice(2));
  if (help) {
    console.log(CLI_USAGE);
    return;
  }

  const rootDir = resolve(__dirname, "..");
  const settingsPath = join(rootDir, "src", "config", "settings.ts");
  const basePath = await parseBasePath(settingsPath);
  const trailingSlash = await parseTrailingSlash(settingsPath);
  const distDir = join(rootDir, "dist");

  console.log(`Checking links (base: ${basePath}, trailingSlash: ${trailingSlash})...\n`);

  if (!(await fileExists(distDir))) {
    console.error("Error: dist/ directory not found. Run 'pnpm build' first.");
    process.exit(1);
  }

  // Exclude versioned docs links — version content may be incomplete
  const excludePatterns = [/\/v\/[^/]+\//];

  const { docsDir, localeDirs, localeKeys } = await parseContentDirs(settingsPath);
  const contentDirs = [join(rootDir, docsDir), ...localeDirs.map((d) => join(rootDir, d))];

  // Single-pass dist walk: broken links + trailing-slash warnings in one read.
  const [
    {
      broken: brokenLinks,
      anchors: htmlAnchorWarnings,
      trailingSlash: trailingSlashWarnings,
      scanned,
    },
    mdxWarnings,
    mdxAnchorWarnings,
  ] =
    await Promise.all([
      checkHtmlLinksAndTrailing(distDir, rootDir, basePath, excludePatterns, trailingSlash),
      checkMdxLinks(contentDirs, rootDir, distDir, basePath, localeKeys),
      checkMdxAnchors(contentDirs, rootDir, basePath, localeKeys, excludePatterns),
    ]);
  const anchorWarnings = [...htmlAnchorWarnings, ...mdxAnchorWarnings];

  // --- Flag parsing ---
  //
  // Four strict knobs (separable so a deploy can fail on real 404s
  // without blocking on warn-only categories) plus an allowlist:
  //
  //   --strict-broken    fail when broken links > 0 (after allowlist)
  //   --strict-absolute  fail when absolute warnings > 0 (after allowlist)
  //   --strict-anchors   fail when invalid anchors > 0 (after allowlist)
  //   --strict-trailing  fail when trailing-slash warnings > 0 (after allowlist)
  //   --allowlist=PATH   skip entries listed in PATH (one
  //                      `<file>:<line>:<href>` per line, comment-only lines)
  const resolvedAllowlist = allowlistPath
    ? (allowlistPath.startsWith("/") ? allowlistPath : join(rootDir, allowlistPath))
    : null;
  const allowlist = await readAllowlist(resolvedAllowlist);

  // Filter out allowlisted entries before strict-mode decisions but
  // AFTER the printed report — so the report shows the full picture
  // and the strict gate counts only "real" entries.
  const filterOut = (entries) => entries.filter((e) => !allowlist.has(entryKey(e)));
  const realBroken = filterOut(brokenLinks);
  const realAbsolute = filterOut(mdxWarnings);
  const realAnchors = filterOut(anchorWarnings);
  const realTrailing = filterOut(trailingSlashWarnings);

  console.log(formatReport(
    brokenLinks,
    mdxWarnings,
    trailingSlashWarnings,
    anchorWarnings,
  ));
  console.log(
    `\nBuilt HTML scan: ${scanned.links} internal link${scanned.links === 1 ? "" : "s"} and ${scanned.ids} ID attribute${scanned.ids === 1 ? "" : "s"} inspected.`,
  );

  if (allowlist.size > 0) {
    const skipped =
      (brokenLinks.length - realBroken.length) +
      (mdxWarnings.length - realAbsolute.length) +
      (anchorWarnings.length - realAnchors.length) +
      (trailingSlashWarnings.length - realTrailing.length);
    if (skipped > 0) {
      console.log(
        `\nAllowlist: ${skipped} known exception${skipped === 1 ? "" : "s"} excluded from strict-mode counts (${resolvedAllowlist}).`,
      );
    }
  }

  const hasIssues =
    brokenLinks.length > 0 ||
    mdxWarnings.length > 0 ||
    anchorWarnings.length > 0 ||
    trailingSlashWarnings.length > 0;

  // Per-category strict failure (real counts). Combined into one exit
  // code so b4push only needs one invocation. Print which category
  // tripped before exiting so the diagnosis is obvious from the log.
  let failed = false;
  if (strictBroken && realBroken.length > 0) {
    console.log(`\n❌ STRICT FAIL: ${realBroken.length} broken link${realBroken.length === 1 ? "" : "s"} (after allowlist).`);
    failed = true;
  }
  if (strictAbsolute && realAbsolute.length > 0) {
    console.log(`\n❌ STRICT FAIL: ${realAbsolute.length} absolute MDX-source link${realAbsolute.length === 1 ? "" : "s"} (after allowlist).`);
    failed = true;
  }
  if (strictAnchors && realAnchors.length > 0) {
    console.log(`\n❌ STRICT FAIL: ${realAnchors.length} invalid anchor${realAnchors.length === 1 ? "" : "s"} (after allowlist).`);
    failed = true;
  }
  if (strictTrailing && realTrailing.length > 0) {
    console.log(`\n❌ STRICT FAIL: ${realTrailing.length} trailing-slash warning${realTrailing.length === 1 ? "" : "s"} (after allowlist).`);
    failed = true;
  }
  if (failed) {
    process.exit(1);
  }

  if (hasIssues && !strictBroken && !strictAbsolute && !strictAnchors && !strictTrailing) {
    console.log("\nNote: Issues found but running in non-strict mode (exit 0).");
    console.log(
      "Use --strict-broken / --strict-absolute / --strict-anchors / --strict-trailing to fail on selected issue categories.",
    );
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (isMain) {
  main().catch((err) => {
    console.error(err instanceof CliArgumentError ? err.message : err);
    process.exit(1);
  });
}
