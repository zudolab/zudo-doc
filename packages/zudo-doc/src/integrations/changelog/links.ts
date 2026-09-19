import { basename } from "node:path";
import type { ChangelogEntry } from "./types.js";

// Emit-time rewrite of relative `.md`/`.mdx` links inside changelog entry
// bodies. The authored MDX corpus links sibling release pages with relative
// paths (`./5.15.0.mdx`) because the doc-site resolver needs that form — but
// those links are dead once flattened into a single `CHANGELOG.md` (GitHub
// file view, npm tarball). This module rewrites same-directory `.md`/`.mdx`
// links that resolve to another emitted entry into an in-file anchor, and
// unlinks (keeps the label, drops the href) anything else that would be a
// dead relative doc link. Internal to the changelog integration — not
// exported from `./index.ts` (guarded by `public-api-snapshot.test.ts`).

/**
 * Heading text shared by the emitted `## [version] - date` line and the
 * anchor map, so the two cannot drift out of step with each other.
 */
export function formatChangelogEntryHeadingText(
  entry: Pick<ChangelogEntry, "version" | "date">,
): string {
  return entry.date ? `[${entry.version}] - ${entry.date}` : `[${entry.version}]`;
}

// GitHub's anchor slugger, reimplemented here on purpose: the package's own
// `slugify` (extract-headings/index.ts) is deliberately NOT GitHub-compatible
// (it turns `.` into `-`, which would collide `[5.15.0]` with `[5-15-0]` and
// also disagrees with GitHub's actual rendering), so reusing it would emit
// dead anchors. GitHub's algorithm: lowercase; drop every character that
// isn't a Unicode letter/number, `_`, `-`, or space; turn each remaining
// space into `-` (runs are NOT collapsed, so "] - " on a heading becomes
// "---").
const GITHUB_SLUG_ALLOWED_RE = /[\p{L}\p{N}_\- ]/u;

function githubSlugify(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) {
    if (GITHUB_SLUG_ALLOWED_RE.test(ch)) {
      out += ch === " " ? "-" : ch;
    }
  }
  return out;
}

/**
 * Per-document de-duplicating slug allocator, mirroring GitHub's anchor
 * behavior: the first occurrence of a slug is used as-is, later occurrences
 * get `-1`, `-2`, … appended. Unlike the package's own heading-id allocator
 * (extract-headings/index.ts), this is flat — GitHub does not nest anchors
 * under a parent heading's id.
 */
class GithubSlugAllocator {
  private readonly seen = new Map<string, number>();

  allocate(text: string): string {
    const slug = githubSlugify(text);
    const count = this.seen.get(slug) ?? 0;
    this.seen.set(slug, count + 1);
    return count === 0 ? slug : `${slug}-${count}`;
  }
}

/**
 * Walk every ATX heading (`#` through `######`, outside fenced code) in a
 * markdown body, in document order, returning each heading's raw text (an
 * optional closing `#`-sequence stripped). The text is intentionally left
 * otherwise unprocessed — `githubSlugify`'s character filter already strips
 * markdown punctuation (backticks, emphasis markers, brackets) the same way
 * GitHub's own renderer does when it computes an anchor from a heading.
 */
function stripInlineLinkSyntax(text: string): string {
  // GitHub slugs a heading from its RENDERED text, so a link's destination
  // never contributes. Reducing `[label](dest)` / `![alt](dest)` to the label
  // here also keeps the slug stable across this module's own rewrite, which
  // changes only the destination.
  return text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
}

function extractAtxHeadingTexts(content: string): string[] {
  const headings: string[] = [];
  let fenceChar: string | null = null;
  let fenceLen = 0;

  for (const line of content.split("\n")) {
    const trimmed = line.trimStart();
    const fenceMatch = /^([`~]{3,})/.exec(trimmed);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      if (fence === undefined) continue;
      if (fenceChar === null) {
        fenceChar = fence[0] ?? null;
        fenceLen = fence.length;
      } else if (fence[0] === fenceChar && fence.length >= fenceLen) {
        fenceChar = null;
      }
      continue;
    }
    if (fenceChar !== null) continue;

    const headingMatch = /^(#{1,6})[ \t]+(.+)$/.exec(line.trim());
    if (!headingMatch) continue;
    const rawText = headingMatch[2];
    if (rawText === undefined) continue;
    const text = stripInlineLinkSyntax(rawText.trim().replace(/\s+#+\s*$/, ""));
    headings.push(text);
  }

  return headings;
}

/**
 * Build the anchor map (exact source filename -> in-file anchor) for a full
 * generated changelog document. Anchors must reflect the WHOLE document's
 * heading order, not just the version headings: the `# <title>` line and any
 * `###` headings inside entry bodies consume slugs too, and an earlier
 * entry's body heading can shift a later entry's anchor via GitHub's `-1`,
 * `-2`, … de-duplication.
 */
export function buildChangelogAnchorMap(
  title: string,
  entries: readonly ChangelogEntry[],
): ReadonlyMap<string, string> {
  const allocator = new GithubSlugAllocator();
  allocator.allocate(title);

  const anchors = new Map<string, string>();
  for (const entry of entries) {
    const anchor = allocator.allocate(formatChangelogEntryHeadingText(entry));
    anchors.set(basename(entry.sourcePath), anchor);
    for (const headingText of extractAtxHeadingTexts(entry.content)) {
      allocator.allocate(headingText);
    }
  }

  return anchors;
}

// --- Code protection -------------------------------------------------------
//
// `sanitize.ts` only protects triple-backtick fences (it runs per entry,
// before MDX components are stripped). Link rewriting runs later, on
// already-sanitized CommonMark, but still must not rewrite link-shaped text
// that is actually code: fences of 3+ backticks, `~~~` fences, and inline
// code spans of any backtick-run length (`` `x` ``, `` ``x`` ``, ...).

const FENCE_PLACEHOLDER_PREFIX = "\u0000CHANGELOG_LINK_FENCE_";
const INLINE_CODE_PLACEHOLDER_PREFIX = "\u0000CHANGELOG_LINK_CODE_";
const PLACEHOLDER_SUFFIX = "\u0000";

function protectCode(content: string): { text: string; restore: (s: string) => string } {
  const stashed: string[] = [];
  const stash = (prefix: string, value: string): string => {
    const token = `${prefix}${stashed.length}${PLACEHOLDER_SUFFIX}`;
    stashed.push(value);
    return token;
  };

  // Fenced code blocks first (``` / ~~~ / longer runs), line-based so an
  // inline-code-span pass never looks inside one.
  const outLines: string[] = [];
  let fenceChar: string | null = null;
  let fenceLen = 0;
  let fenceBuf: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trimStart();
    const fenceMatch = /^([`~]{3,})/.exec(trimmed);
    if (fenceChar === null) {
      if (fenceMatch) {
        const fence = fenceMatch[1];
        if (fence !== undefined) {
          fenceChar = fence[0] ?? null;
          fenceLen = fence.length;
          fenceBuf = [line];
          continue;
        }
      }
      outLines.push(line);
    } else {
      fenceBuf.push(line);
      if (fenceMatch) {
        const fence = fenceMatch[1];
        if (fence !== undefined && fence[0] === fenceChar && fence.length >= fenceLen) {
          outLines.push(stash(FENCE_PLACEHOLDER_PREFIX, fenceBuf.join("\n")));
          fenceChar = null;
          fenceBuf = [];
        }
      }
    }
  }
  if (fenceChar !== null) {
    // Unterminated fence: the opener was almost certainly literal text rather
    // than a real fence (e.g. a ``` line sitting inside a 4-space indented
    // code block, which CommonMark renders verbatim). Emit the buffered lines
    // unprotected instead of stashing them — stashing would silently disable
    // link rewriting for the whole remainder of the entry, shipping every
    // relative doc link after that point dead.
    outLines.push(...fenceBuf);
  }

  let text = outLines.join("\n");

  // Inline code spans, any backtick-run length, outside the now-stashed
  // fences. Greedy opener + backreferenced closer + a "not followed by
  // another backtick" guard is the standard way to match CommonMark code
  // spans without a full parser.
  // The body may not cross a blank line: a CommonMark code span never does,
  // so without this guard a single unpaired backtick in prose swallows
  // everything up to the next backtick — including real links, which then
  // ship unrewritten.
  text = text.replace(/(`+)((?:(?!\n[ \t]*\n)[\s\S])*?)\1(?!`)/g, (whole) =>
    stash(INLINE_CODE_PLACEHOLDER_PREFIX, whole),
  );

  return {
    text,
    restore: (s: string): string => {
      let result = s;
      for (let i = 0; i < stashed.length; i += 1) {
        const value = stashed[i];
        if (value === undefined) continue;
        const fenceToken = `${FENCE_PLACEHOLDER_PREFIX}${i}${PLACEHOLDER_SUFFIX}`;
        const codeToken = `${INLINE_CODE_PLACEHOLDER_PREFIX}${i}${PLACEHOLDER_SUFFIX}`;
        result = result.split(fenceToken).join(value).split(codeToken).join(value);
      }
      return result;
    },
  };
}

// --- Link scanning -----------------------------------------------------
//
// Inline links only (`[label](dest)` / `[label](dest "title")`); reference
// links are untouched by construction (no matching `(` right after `]`).
// Brackets/parens in the label/dest are matched with a depth counter rather
// than a single regex, so a label with nested brackets (or a placeholder
// token standing in for protected inline code) is captured verbatim.

interface LinkMatch {
  start: number;
  end: number;
  label: string;
  dest: string;
  /** The authored title INCLUDING its surrounding quote characters. */
  title?: string;
  isImage: boolean;
}

function findMatchingDelimiter(text: string, start: number, open: string, close: string): number {
  let depth = 1;
  let j = start;
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return j;
    }
    j += 1;
  }
  return -1;
}

function parseLinkInner(inner: string): { dest: string; title?: string } | null {
  const trimmed = inner.trim();
  if (trimmed === "") return { dest: "" };

  let dest: string;
  let rest: string;
  if (trimmed.startsWith("<")) {
    const closeIdx = trimmed.indexOf(">");
    if (closeIdx === -1) return null;
    dest = trimmed.slice(1, closeIdx);
    rest = trimmed.slice(closeIdx + 1).trim();
  } else {
    const spaceIdx = trimmed.search(/\s/);
    if (spaceIdx === -1) {
      dest = trimmed;
      rest = "";
    } else {
      dest = trimmed.slice(0, spaceIdx);
      rest = trimmed.slice(spaceIdx).trim();
    }
  }

  // `title` keeps its surrounding quotes verbatim so it can be re-emitted
  // byte-identically. Re-quoting it ourselves would corrupt a single-quoted
  // title containing a double quote. The backreference also rejects mismatched
  // delimiters, leaving such a link untouched instead of rewriting it wrong.
  let title: string | undefined;
  if (rest !== "") {
    if (!/^(["'])[\s\S]*\1$/.test(rest)) return null;
    title = rest;
  }
  return { dest, title };
}

function scanLinks(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "[") {
      const isImage = i > 0 && text[i - 1] === "!";
      const labelStart = i + 1;
      const labelEnd = findMatchingDelimiter(text, labelStart, "[", "]");
      if (labelEnd !== -1 && text[labelEnd + 1] === "(") {
        const parenStart = labelEnd + 2;
        const parenEnd = findMatchingDelimiter(text, parenStart, "(", ")");
        if (parenEnd !== -1) {
          const parsed = parseLinkInner(text.slice(parenStart, parenEnd));
          if (parsed) {
            matches.push({
              start: isImage ? i - 1 : i,
              end: parenEnd + 1,
              label: text.slice(labelStart, labelEnd),
              dest: parsed.dest,
              title: parsed.title,
              isImage,
            });
            i = parenEnd + 1;
            continue;
          }
        }
      }
    }
    i += 1;
  }
  return matches;
}

// --- Relative .md/.mdx link classification -----------------------------

interface RelativeDocLink {
  /** True for `./name.mdx` or bare `name.mdx` (no further path segments). */
  sameDir: boolean;
  filename: string;
}

const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

function parseRelativeDocLink(dest: string): RelativeDocLink | null {
  const hashIdx = dest.indexOf("#");
  const withoutFragment = hashIdx === -1 ? dest : dest.slice(0, hashIdx);
  if (withoutFragment === "") return null; // pure `#fragment` (or empty dest)
  if (!/\.(?:mdx|md)$/i.test(withoutFragment)) return null;
  if (URL_SCHEME_RE.test(withoutFragment)) return null;
  if (withoutFragment.startsWith("//")) return null;
  if (withoutFragment.startsWith("/")) return null;

  const normalized = withoutFragment.startsWith("./")
    ? withoutFragment.slice(2)
    : withoutFragment;
  const sameDir = normalized.length > 0 && !normalized.includes("/");
  return { sameDir, filename: normalized };
}

/**
 * Rewrite one entry's already-sanitized markdown content: same-directory
 * `.md`/`.mdx` links to another emitted entry become an in-file anchor link
 * (`#<anchor>`, original `#fragment` dropped, title preserved); any other
 * relative `.md`/`.mdx` link is unlinked to its label text. Everything else
 * (absolute URLs, protocol-relative, root-absolute, pure fragments, images,
 * other extensions, reference-style links, and anything inside fenced or
 * inline code) passes through byte-unchanged.
 */
export function rewriteChangelogEntryLinks(
  content: string,
  anchorByFilename: ReadonlyMap<string, string>,
): string {
  const { text: protectedText, restore } = protectCode(content);

  const matches = scanLinks(protectedText);
  let rewritten = "";
  let cursor = 0;
  for (const match of matches) {
    rewritten += protectedText.slice(cursor, match.start);
    if (match.isImage) {
      rewritten += protectedText.slice(match.start, match.end);
      cursor = match.end;
      continue;
    }

    const parsed = parseRelativeDocLink(match.dest);
    if (!parsed) {
      rewritten += protectedText.slice(match.start, match.end);
      cursor = match.end;
      continue;
    }

    const anchor = parsed.sameDir ? anchorByFilename.get(parsed.filename) : undefined;
    if (anchor === undefined) {
      rewritten += match.label; // unlink: unknown target, or not same-directory
    } else {
      const titlePart = match.title !== undefined ? ` ${match.title}` : "";
      rewritten += `[${match.label}](#${anchor}${titlePart})`;
    }
    cursor = match.end;
  }
  rewritten += protectedText.slice(cursor);

  return restore(rewritten);
}
