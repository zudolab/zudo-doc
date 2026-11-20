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

const PLACEHOLDER = "\u0000DSCODE_";

function protectCode(content: string): { text: string; restore: (s: string) => string } {
  const saved: string[] = [];
  const keep = (match: string) => {
    saved.push(match);
    return `${PLACEHOLDER}${saved.length - 1}\u0000`;
  };
  let text = content.replace(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n {0,3}\2[`~]*[ \t]*(?=\n|(?![\s\S]))|(?![\s\S]))/gm, keep);
  text = text.replace(/(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g, keep);
  return {
    text,
    restore: (s) => s.replace(new RegExp(`${PLACEHOLDER}(\\d+)\u0000`, "g"), (_, i: string) => saved[Number(i)] ?? ""),
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

const INLINE_LINK =
  /(!?)\[((?:[^[\]\n]|\[[^\]\n]*\])*)\]\(\s*(<[^>\n]*>|[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)/g;
const REFERENCE_DEFINITION = /^( {0,3})\[([^\]\n]+)\]:[ \t]*(<[^>\n]*>|\S+)([^\n]*)$/gm;
const HTML_ATTRIBUTE = /(<(?:a|img|source)\b[^>]*?\s)(href|src)=("([^"]*)"|'([^']*)')/gi;

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

  out = out.replace(INLINE_LINK, (match, _bang: string, label: string, rawDest: string, title: string | undefined) => {
    const url = unwrapDestination(rawDest);
    const resolution = resolveDestination(url);
    if (resolution.kind === "keep") return match;
    if (resolution.kind === "unmapped") return readableReference(label, url);
    const prefix = match.slice(0, match.indexOf("](") + 2);
    return `${prefix}${formatDestination(resolution.url)}${title ?? ""})`;
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
