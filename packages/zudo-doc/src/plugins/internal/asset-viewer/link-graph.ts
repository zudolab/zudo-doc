import { decodeAuthoredHref } from "../../../asset-path/index.js";
import {
  collectMdFiles,
  isExcluded,
  parseMarkdownFile,
} from "../../../md-utils/index.js";
import { toTitleCase } from "../../../slug/index.js";

export interface LinkRef {
  href: string;
  title: string;
  crumb: string;
  context: string;
  locale?: string;
  version?: string;
}

export interface AssetExcerptRequest {
  path: string;
  /** First requested line, one-based and inclusive. */
  start: number;
  /** Last requested line, one-based and inclusive. Omitted for `a-`. */
  end?: number;
}

export interface AssetLinkContentRoot {
  dir: string;
  locale?: string;
  version?: string;
  /** Build the canonical page URL for an effective route slug. */
  urlFor: (slug: string) => string;
}

export interface CollectAssetLinksRequest {
  contentRoots: readonly AssetLinkContentRoot[];
  /** Configured public asset directory, relative to `public/`. */
  dir: string;
  base: string;
  trailingSlash: boolean;
}

export interface AssetLinkGraph {
  linkedFrom: Map<string, LinkRef[]>;
  excerptRequests: AssetExcerptRequest[];
}

interface AuthoredAssetMatch {
  href: string;
  index: number;
  end: number;
}

const MAX_CONTEXT_LENGTH = 160;
const VERSION_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function blank(value: string): string {
  return value.replace(/[^\r\n]/g, " ");
}

/**
 * Hide fenced and inline code while retaining every source offset. Keeping
 * offsets stable lets matches in the masked text select context from the
 * original authoring source.
 */
function maskCode(content: string): string {
  const lines = content.match(/.*(?:\n|$)/g) ?? [];
  let opener: { char: string; length: number } | undefined;

  return lines
    .map((line) => {
      const fence = /^([`~]{3,})/.exec(line.trimStart())?.[1];
      if (fence) {
        if (!opener) {
          opener = { char: fence[0]!, length: fence.length };
        } else if (fence[0] === opener.char && fence.length >= opener.length) {
          opener = undefined;
        }
        return blank(line);
      }
      if (opener) return blank(line);

      // Match the check-links scanner: double-backtick spans are removed
      // before single-backtick spans, and escaped backticks remain authored
      // text. Replacing with spaces preserves match/context offsets.
      return line
        .replace(/(?<!\\)``[^`]*(?:``|$)/g, blank)
        .replace(/(?<!\\)`[^`]*(?:`|$)/g, blank);
    })
    .join("");
}

function collectAuthoredAssetMatches(content: string): AuthoredAssetMatch[] {
  const matches: AuthoredAssetMatch[] = [];
  const markdownLink = /\]\(\s*(\/[^\s)]+)(?:\s+["'][^)]*["'])?\)/g;
  const jsxAttribute = /\b(?:src|href)\s*=\s*["'](\/[^"']+)["']/g;

  for (const pattern of [markdownLink, jsxAttribute]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const href = match[1];
      if (!href) continue;
      const relativeIndex = match[0].indexOf(href);
      const index = match.index + relativeIndex;
      matches.push({ href, index, end: index + href.length });
    }
  }

  return matches.sort((a, b) => a.index - b.index);
}

function parseLines(value: string): { start: number; end?: number } | null {
  const match = /^(\d+)(?:-(\d*))?$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  if (!Number.isSafeInteger(start) || start < 1) return null;

  if (match[2] === undefined) return { start, end: start };
  if (match[2] === "") return { start };

  const end = Number(match[2]);
  if (!Number.isSafeInteger(end) || end < 1) return null;
  return { start, end };
}

function collectExcerptRequests(
  content: string,
  base: string,
  dir: string,
): AssetExcerptRequest[] {
  const requests: AssetExcerptRequest[] = [];
  const assetCode = /<AssetCode\b[\s\S]*?>/g;
  let tag: RegExpExecArray | null;

  while ((tag = assetCode.exec(content)) !== null) {
    const src = /\bsrc\s*=\s*["'](\/[^"']+)["']/.exec(tag[0])?.[1];
    const lines = /\blines\s*=\s*["']([^"']+)["']/.exec(tag[0])?.[1];
    if (!src || !lines) continue;

    const range = parseLines(lines);
    if (!range) continue;

    let decoded: ReturnType<typeof decodeAuthoredHref>;
    try {
      decoded = decodeAuthoredHref(src, { base, dir });
    } catch {
      continue;
    }
    if (!decoded) continue;
    requests.push({ path: decoded.path, ...range });
  }

  return requests;
}

function nearestSentenceEnd(content: string, from: number): number {
  const candidates = [
    content.indexOf(".", from),
    content.indexOf("。", from),
    content.indexOf("\n", from),
  ].filter((index) => index >= 0);
  return candidates.length === 0 ? content.length : Math.min(...candidates) + 1;
}

function contextForMatch(
  content: string,
  matchStart: number,
  matchEnd: number,
): string {
  const start =
    Math.max(
      content.lastIndexOf(".", matchStart - 1),
      content.lastIndexOf("。", matchStart - 1),
      content.lastIndexOf("\n", matchStart - 1),
    ) + 1;
  const end = nearestSentenceEnd(content, matchEnd);
  const raw = content.slice(start, end);
  const context = raw.trim().replace(/\s+/g, " ");
  if (context.length <= MAX_CONTEXT_LENGTH) return context;

  const matchOffset = content
    .slice(start, matchStart)
    .trimStart()
    .replace(/\s+/g, " ").length;
  const available = MAX_CONTEXT_LENGTH - 2;
  const windowStart = Math.max(
    0,
    Math.min(matchOffset - Math.floor(available / 2), context.length - available),
  );
  const windowEnd = windowStart + available;
  return `${windowStart > 0 ? "…" : ""}${context.slice(windowStart, windowEnd)}${
    windowEnd < context.length ? "…" : ""
  }`;
}

function decodeSlugSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function buildCrumb(slug: string, title: string): string {
  const segments = slug.split("/").filter(Boolean);
  const categories = segments
    .slice(0, -1)
    .map((segment) => toTitleCase(decodeSlugSegment(segment)));
  return [...categories, title].filter(Boolean).join(" › ");
}

function compareOptionalDefaultFirst(a?: string, b?: string): number {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return VERSION_COLLATOR.compare(a, b);
}

function compareRefs(a: LinkRef, b: LinkRef): number {
  const locale = compareOptionalDefaultFirst(a.locale, b.locale);
  if (locale !== 0) return locale;

  // An unversioned root represents the latest docs. Named versions then sort
  // naturally in descending order (`v10` before `v2`).
  if (a.version !== b.version) {
    if (a.version === undefined) return -1;
    if (b.version === undefined) return 1;
    const version = VERSION_COLLATOR.compare(b.version, a.version);
    if (version !== 0) return version;
  }
  return VERSION_COLLATOR.compare(a.title, b.title);
}

export function collectAssetLinks({
  contentRoots,
  dir,
  base,
}: CollectAssetLinksRequest): AssetLinkGraph {
  const linkedFrom = new Map<string, LinkRef[]>();
  const excerptRequests: AssetExcerptRequest[] = [];
  const excerptKeys = new Set<string>();

  for (const root of contentRoots) {
    for (const { filePath, slug: fileSlug } of collectMdFiles(root.dir)) {
      const parsed = parseMarkdownFile(filePath);
      if (!parsed || isExcluded(parsed.data)) continue;

      const slug = parsed.data.slug ?? fileSlug;
      const title = parsed.data.title ?? fileSlug;
      const maskedContent = maskCode(parsed.content);
      const seenOnPage = new Set<string>();

      for (const match of collectAuthoredAssetMatches(maskedContent)) {
        let decoded: ReturnType<typeof decodeAuthoredHref>;
        try {
          decoded = decodeAuthoredHref(match.href, { base, dir });
        } catch {
          continue;
        }
        if (!decoded || seenOnPage.has(decoded.path)) continue;
        seenOnPage.add(decoded.path);

        const refs = linkedFrom.get(decoded.path) ?? [];
        refs.push({
          href: root.urlFor(slug),
          title,
          crumb: buildCrumb(slug, title),
          context: contextForMatch(parsed.content, match.index, match.end),
          ...(root.locale === undefined ? {} : { locale: root.locale }),
          ...(root.version === undefined ? {} : { version: root.version }),
        });
        linkedFrom.set(decoded.path, refs);
      }

      for (const request of collectExcerptRequests(maskedContent, base, dir)) {
        const key = `${request.path}\0${request.start}\0${request.end ?? ""}`;
        if (excerptKeys.has(key)) continue;
        excerptKeys.add(key);
        excerptRequests.push(request);
      }
    }
  }

  for (const refs of linkedFrom.values()) refs.sort(compareRefs);
  return { linkedFrom, excerptRequests };
}
