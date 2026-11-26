// Markdown link rewriting for mapped documents. Literal examples inside
// fenced or inline code are never touched. Inline links, images,
// reference-style definitions/usages and HTML `href`/`src` attributes all go
// through the same resolver, so presets and custom mappings share one policy.

export type LinkResolution =
  | { kind: "keep" }
  | { kind: "rewrite"; url: string }
  | { kind: "unmapped" };

export type LinkResolver = (url: string) => LinkResolution;

/** Whether a destination refers to a sibling file rather than a site URL. */
export function isRelativeReference(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === "") return false;
  if (trimmed.startsWith("#")) return false;
  if (trimmed.startsWith("/")) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;
  return true;
}

const FENCE_PLACEHOLDER = "\u0000DSFENCE_";
const SPAN_PLACEHOLDER = "\u0000DSCODE_";
const BLOCK_BREAK = String.raw`[ \t]*(?:(?:>[ \t]*)*\r?\n|\u0000DSFENCE_|#{1,6}(?:[ \t]|\r?$)|(?:[-+*]|1[.)])[ \t]|(?:=+|-+|\*{3,}|_{3,})[ \t]*\r?$)`;
const BLOCK_START = new RegExp(`^${BLOCK_BREAK}`);

function quotePrefix(line: string, limit = Infinity): { depth: number; rest: string } {
  let depth = 0;
  while (depth < limit) {
    const prefix = /^ {0,3}>[ \t]?/.exec(line);
    if (!prefix) break;
    line = line.slice(prefix[0].length);
    depth += 1;
  }
  return { depth, rest: line };
}

function protectFences(content: string, keep: (match: string) => string): string {
  const lines = content.split(/(?<=\n)/);
  const parts: string[] = [];
  let fence: { start: number; depth: number; indent: number; inList: boolean; delimiter: string } | undefined;
  const finish = (end: number) => {
    if (!fence) return;
    const body = lines.slice(fence.start, end).join("");
    const ending = /\r?\n$/.exec(body)?.[0] ?? "";
    parts.push(keep(body.slice(0, body.length - ending.length)), ending);
    fence = undefined;
  };

  for (const [index, line] of lines.entries()) {
    if (fence) {
      const quote = quotePrefix(line, fence.depth);
      const indent = /^[ \t]*/.exec(quote.rest)![0].length;
      const dedented = (fence.inList || fence.indent > 3) && indent < fence.indent && quote.rest.trim();
      if (quote.depth < fence.depth || dedented) {
        finish(index);
      } else {
        const closing = /^[ \t]*(`{3,}|~{3,})[ \t]*\r?\n?$/.exec(quote.rest)?.[1];
        const closingIndent = fence.inList || fence.indent > 3 ? fence.indent + 3 : 3;
        if (closing?.startsWith(fence.delimiter) && indent <= closingIndent) finish(index + 1);
        continue;
      }
    }

    const { depth, rest } = quotePrefix(line);
    const open = /^([ \t]*)((?:[-+*]|\d{1,9}[.)])[ \t]+)?(`{3,}|~{3,})([^\r\n]*)/.exec(rest);
    if (open && (open[3]![0] === "~" || !open[4]!.includes("`"))) {
      fence = { start: index, depth, indent: open[1]!.length + (open[2]?.length ?? 0), inList: !!open[2], delimiter: open[3]! };
    } else {
      parts.push(line);
    }
  }
  finish(lines.length);
  return parts.join("");
}

function protectCode(content: string): { text: string; restore: (s: string) => string } {
  const saved: string[] = [];
  const keep = (prefix: string) => (match: string) => {
    saved.push(match);
    return `${prefix}${saved.length - 1}\u0000`;
  };
  const text = protectFences(content, keep(FENCE_PLACEHOLDER)).replace(
    new RegExp(String.raw`(\x60+)(?!\x60)((?:(?!\r?\n${BLOCK_BREAK}|\u0000DSFENCE_)[\s\S])*?[^\x60])\1(?!\x60)`, "gm"),
    keep(SPAN_PLACEHOLDER),
  );
  return {
    text,
    restore: (s) => s.replace(/\u0000DS(?:CODE|FENCE)_(\d+)\u0000/g, (_, i: string) => saved[Number(i)] ?? ""),
  };
}

function codeSpan(value: string): string {
  const longest = (value.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = "`".repeat(longest + 1);
  return /^`|`$/.test(value) ? `${fence} ${value} ${fence}` : `${fence}${value}${fence}`;
}

/** Readable stand-in for a reference that is not published. */
export function readableReference(text: string, url: string): string {
  const label = text.trim();
  return label === "" || label === url ? codeSpan(url) : `${label} (${codeSpan(url)})`;
}

function unwrapDestination(raw: string): string {
  return raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw;
}

// Emitted destinations are percent-encoded rather than wrapped in `<…>`, so
// the later MDX escaping pass never sees them as tags.
function formatDestination(url: string): string {
  return url.replace(/[\s()<>]/g, (char) => encodeURIComponent(char));
}

// A wrapped label can contain line breaks but must stay within one block.
const LABEL_BREAK = String.raw`\r?\n(?!${BLOCK_BREAK})`;
const LABEL_BACKSLASH = String.raw`\\(?:[^\r\n]|(?=\r?\n))`;
const NESTED_LABEL = String.raw`\[(?:[^\]\\\r\n]|${LABEL_BACKSLASH}|${LABEL_BREAK})*\]`;
const INLINE_LINK =
  new RegExp(String.raw`(!?)\[((?:[^[\]\\\r\n]|${LABEL_BACKSLASH}|${LABEL_BREAK}|(?<=!)${NESTED_LABEL}|(?<!!)${NESTED_LABEL}(?!\())*)\]\(\s*(<[^>\n]*>|[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)`, "gm");
const REFERENCE_DEFINITION = /^( {0,3})\[([^\]\n]+)\]:[ \t]*(<[^>\n]*>|\S+)([^\n]*)$/gm;
const HTML_ATTRIBUTE = /(<(?:a|img|source)\b[^>]*?\s)(href|src)=("([^"]*)"|'([^']*)')/gi;

function crossesContainerBoundary(label: string, openingLine: string): boolean {
  const container = quotePrefix(openingLine);
  const ordered = /^([ \t]*)\d{1,9}[.)][ \t]/.exec(container.rest);
  return label.split(/\r?\n/).slice(1).some((line, index, lines) => {
    // The last label line is followed by the closing bracket in the source.
    const quote = quotePrefix(index === lines.length - 1 ? `${line}]` : line);
    if (quote.depth > container.depth || (quote.depth > 0 && (!quote.rest.trim() || BLOCK_START.test(quote.rest)))) return true;
    const item = /^([ \t]*)\d{1,9}[.)][ \t]/.exec(quote.rest);
    return !!(ordered && item && item[1]!.length <= ordered[1]!.length);
  });
}

function isEscaped(input: string, offset: number): boolean {
  let start = offset;
  while (input[start - 1] === "\\") start -= 1;
  return (offset - start) % 2 === 1;
}

export interface RewriteResult {
  content: string;
  unmapped: string[];
}

export function rewriteLinks(content: string, resolve: LinkResolver): RewriteResult {
  const unmapped: string[] = [];
  const resolveDestination = (url: string): LinkResolution => {
    if (!isRelativeReference(url)) return { kind: "keep" };
    const resolution = resolve(url);
    if (resolution.kind === "unmapped") unmapped.push(url);
    return resolution;
  };

  const { text, restore } = protectCode(content);

  // Reference definitions first, so usages of unmapped ids can be degraded.
  const unmappedRefs = new Map<string, string>();
  let out = text.replace(REFERENCE_DEFINITION, (match, indent: string, id: string, rawDest: string, rest: string) => {
    const url = unwrapDestination(rawDest);
    const resolution = resolveDestination(url);
    if (resolution.kind === "keep") return match;
    if (resolution.kind === "rewrite") {
      return `${indent}[${id}]: ${formatDestination(resolution.url)}${rest}`;
    }
    unmappedRefs.set(id.trim().toLowerCase(), url);
    return "";
  });
  if (unmappedRefs.size > 0) {
    out = out.replace(/(!?)\[([^[\]\n]+)\](?:\[([^[\]\n]*)\])?(?![(:[])/g, (match, _bang: string, text: string, ref: string | undefined) => {
      const id = (ref === undefined || ref === "" ? text : ref).trim().toLowerCase();
      const url = unmappedRefs.get(id);
      return url === undefined ? match : readableReference(text, url);
    });
  }

  out = out.replace(INLINE_LINK, (match, bang: string, label: string, rawDest: string, title: string | undefined, offset: number, input: string) => {
    if (label.includes("\n")) {
      const openingLine = input.slice(input.lastIndexOf("\n", offset - 1) + 1, offset);
      if (isEscaped(input, offset + bang.length) || crossesContainerBoundary(label, openingLine)) return match;
    }
    const url = unwrapDestination(rawDest);
    const resolution = resolveDestination(url);
    if (resolution.kind === "keep") return match;
    if (resolution.kind === "unmapped") {
      const literalBang = bang && isEscaped(input, offset) ? bang : "";
      return `${literalBang}${readableReference(label, url)}`;
    }
    return `${bang}[${label}](${formatDestination(resolution.url)}${title ?? ""})`;
  });

  out = out.replace(HTML_ATTRIBUTE, (match, head: string, attr: string, _quoted: string, dq: string | undefined, sq: string | undefined) => {
    const url = dq ?? sq ?? "";
    const resolution = resolveDestination(url);
    if (resolution.kind === "keep") return match;
    if (resolution.kind === "rewrite") return `${head}${attr}="${resolution.url.replace(/"/g, "&quot;")}"`;
    return `${head}data-source-${attr.toLowerCase()}="${url.replace(/"/g, "&quot;")}"`;
  });

  return { content: restore(out), unmapped };
}

/** Split a destination into its path, query and fragment parts. */
export function splitDestination(url: string): { pathPart: string; query: string; fragment: string } {
  const hashIndex = url.indexOf("#");
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : url.slice(hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  return {
    pathPart: queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex),
    query: queryIndex === -1 ? "" : beforeHash.slice(queryIndex),
    fragment,
  };
}

export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
