// theme-cli/config-scanner — a small, purpose-built text scanner for the
// canonical `zfb.config.ts` shape (ADR docs/adr/theme-packs.md, "Active-pack
// detection" + issue #2824's config-rewrite safety contract).
//
// This is intentionally NOT a general JS/TS parser and does not depend on
// `typescript` (that package is only a devDependency of THIS package — see
// package.json — so it is never installed in a consumer's node_modules and
// cannot be required by the installed CLI at runtime; mirrors the eject
// module's own choice of plain regex/text scanning over an AST rewrite,
// `src/eject/index.ts`'s `rewireImports`/`rewireHostCallSites`).
//
// It understands exactly enough syntax to safely locate a `zudoDoc({ ... })`
// call's top-level properties: line/block comments, single/double-quoted
// strings, and non-interpolated template literals are skipped as opaque
// spans so stray `{`/`}`/`,` characters inside them are never mistaken for
// structure. Anything it cannot confidently handle (unterminated tokens,
// `${...}` interpolation) throws `ConfigSyntaxError` — callers turn that into
// a clean refusal rather than a corrupted rewrite.

/** Thrown when the scanner hits config-file syntax it cannot safely reason
 *  about. Callers MUST catch this and refuse cleanly (never proceed with a
 *  partial/guessed rewrite). */
export class ConfigSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigSyntaxError";
  }
}

const IDENT_START_RE = /[A-Za-z_$]/;
const IDENT_PART_RE = /[A-Za-z0-9_$]/;

function isWhitespace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function skipLineComment(source: string, i: number): number {
  let j = i + 2;
  while (j < source.length && source[j] !== "\n") j++;
  return j;
}

function skipBlockComment(source: string, i: number): number {
  const end = source.indexOf("*/", i + 2);
  if (end === -1) {
    throw new ConfigSyntaxError("unterminated block comment (/* ... */) in zfb.config.ts");
  }
  return end + 2;
}

/** Skip a single/double-quoted string literal starting at `i`. Throws on an
 *  unterminated string (including one broken by a literal, unescaped
 *  newline — invalid in JS/TS for these quote kinds). */
export function skipStringLiteral(source: string, i: number): number {
  const quote = source[i];
  let j = i + 1;
  while (j < source.length) {
    const c = source[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === quote) return j + 1;
    if (c === "\n") break;
    j++;
  }
  throw new ConfigSyntaxError(`unterminated string literal (${quote}...) in zfb.config.ts`);
}

/**
 * Skip a backtick template literal starting at `i`. Only NON-interpolated
 * template literals (no `${...}`) are supported — this is a deliberate
 * scope limit (see file header): a canonical generated config never emits
 * one in a value position, and safely re-balancing arbitrary `${ ... }`
 * expression code is out of scope for this scanner. Throws
 * `ConfigSyntaxError` on interpolation or an unterminated literal so the
 * caller refuses cleanly instead of guessing.
 */
function skipSimpleTemplateLiteral(source: string, i: number): number {
  let j = i + 1;
  while (j < source.length) {
    const c = source[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === "`") return j + 1;
    if (c === "$" && source[j + 1] === "{") {
      throw new ConfigSyntaxError(
        "template literal interpolation (`${...}`) in zfb.config.ts is not supported by the theme CLI's config parser",
      );
    }
    j++;
  }
  throw new ConfigSyntaxError("unterminated template literal (`...`) in zfb.config.ts");
}

/**
 * If `source[i]` starts a comment, string, or simple template literal,
 * returns the index just past it. Otherwise returns `null` — the caller
 * should treat `source[i]` as an ordinary character.
 */
function trySkipToken(source: string, i: number): number | null {
  const c = source[i];
  const c2 = source[i + 1];
  if (c === "/" && c2 === "/") return skipLineComment(source, i);
  if (c === "/" && c2 === "*") return skipBlockComment(source, i);
  if (c === '"' || c === "'") return skipStringLiteral(source, i);
  if (c === "`") return skipSimpleTemplateLiteral(source, i);
  return null;
}

/** Skip whitespace and comments starting at `i`, stopping at the first
 *  "real" character (or `source.length`). */
export function skipWhitespaceAndComments(source: string, i: number): number {
  let pos = i;
  while (pos < source.length) {
    const c = source[pos];
    if (isWhitespace(c)) {
      pos++;
      continue;
    }
    if (c === "/" && source[pos + 1] === "/") {
      pos = skipLineComment(source, pos);
      continue;
    }
    if (c === "/" && source[pos + 1] === "*") {
      pos = skipBlockComment(source, pos);
      continue;
    }
    break;
  }
  return pos;
}

function hasSignificantContent(source: string, start: number, end: number): boolean {
  return skipWhitespaceAndComments(source, start) < end;
}

/**
 * Find every top-level `zudoDoc(` call site (outside strings/comments),
 * returning the index of each call's opening `(`. An identifier match
 * requires an exact `zudoDoc` token (not a substring of a longer
 * identifier) immediately followed — modulo whitespace/comments — by `(`.
 */
export function findZudoDocCallParens(source: string): number[] {
  const result: number[] = [];
  let i = 0;
  while (i < source.length) {
    const skip = trySkipToken(source, i);
    if (skip !== null) {
      i = skip;
      continue;
    }
    const c = source[i]!;
    if (IDENT_START_RE.test(c)) {
      let j = i + 1;
      while (j < source.length && IDENT_PART_RE.test(source[j]!)) j++;
      if (source.slice(i, j) === "zudoDoc") {
        const parenIdx = skipWhitespaceAndComments(source, j);
        if (source[parenIdx] === "(") result.push(parenIdx);
      }
      i = j;
      continue;
    }
    i++;
  }
  return result;
}

/**
 * Find the index of the `}` matching the `{` at `openIndex`, skipping
 * strings/comments/template literals so their content can never be mistaken
 * for structure. Throws `ConfigSyntaxError` if unterminated.
 */
export function findMatchingBrace(source: string, openIndex: number): number {
  if (source[openIndex] !== "{") {
    throw new ConfigSyntaxError("internal error: findMatchingBrace called at a non-'{' position");
  }
  let depth = 1;
  let i = openIndex + 1;
  while (i < source.length) {
    const skip = trySkipToken(source, i);
    if (skip !== null) {
      i = skip;
      continue;
    }
    const c = source[i];
    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  throw new ConfigSyntaxError(
    'unterminated object literal — missing closing "}" for the zudoDoc({...}) call',
  );
}

/** One top-level member of an object literal body (a `key: value` property
 *  or a `...spread` element). `key`/`valueStart`/`valueEnd` are `null` when
 *  the member's shape is not a simple `key: value` this scanner recognizes
 *  (e.g. a computed key, shorthand property) — such members are safe to
 *  leave untouched but cannot be used as a rewrite target or anchor. */
export interface TopLevelMember {
  /** Start of this member's raw span (right after the previous comma, or
   *  the object body's start). */
  memberStart: number;
  /** End of this member's raw span, trimmed of trailing whitespace (right
   *  before its separating comma, or the object body's end). */
  memberEnd: number;
  /** Index of the comma separating this member from the next, or `null` if
   *  this is the last member and has no trailing comma. */
  commaIndex: number | null;
  isSpread: boolean;
  key: string | null;
  keyStart: number | null;
  keyEnd: number | null;
  colonIndex: number | null;
  /** Trimmed start/end of the value expression (after the colon). */
  valueStart: number | null;
  valueEnd: number | null;
}

function unquoteSimple(literal: string): string {
  if (literal.length < 2) return literal;
  const quote = literal[0];
  if (quote !== '"' && quote !== "'") return literal;
  const inner = literal.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\") {
      const next = inner[i + 1];
      switch (next) {
        case "n":
          out += "\n";
          break;
        case "t":
          out += "\t";
          break;
        case "r":
          out += "\r";
          break;
        case "b":
          out += "\b";
          break;
        case "f":
          out += "\f";
          break;
        case "v":
          out += "\v";
          break;
        case "0":
          // Only the standalone NUL escape; \0 followed by a digit is a legacy
          // octal escape, which is illegal in the strict-mode modules we scan.
          if (!/[0-9]/.test(inner[i + 2] ?? "")) {
            out += "\0";
            break;
          }
          out += next;
          break;
        case "x": {
          const hex = inner.slice(i + 2, i + 4);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 2;
            break;
          }
          out += next;
          break;
        }
        case "u": {
          if (inner[i + 2] === "{") {
            const close = inner.indexOf("}", i + 3);
            const hex = close === -1 ? "" : inner.slice(i + 3, close);
            // \u{XXXXX} — code points above 0x10FFFF are a syntax error in JS,
            // so treat them as un-decodable rather than throwing.
            if (/^[0-9a-fA-F]{1,6}$/.test(hex) && parseInt(hex, 16) <= 0x10ffff) {
              out += String.fromCodePoint(parseInt(hex, 16));
              i = close - 1;
              break;
            }
            out += next;
            break;
          }
          const hex = inner.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 4;
            break;
          }
          out += next;
          break;
        }
        default:
          out += next ?? "";
      }
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

function parseMember(
  source: string,
  rawStart: number,
  rawEnd: number,
  commaIndex: number | null,
): TopLevelMember {
  const base: Omit<TopLevelMember, "memberEnd"> = {
    memberStart: rawStart,
    commaIndex,
    isSpread: false,
    key: null,
    keyStart: null,
    keyEnd: null,
    colonIndex: null,
    valueStart: null,
    valueEnd: null,
  };

  // Trim trailing whitespace from rawEnd (leading ws/comments are skipped below).
  let trimmedEnd = rawEnd;
  while (trimmedEnd > rawStart && isWhitespace(source[trimmedEnd - 1])) trimmedEnd--;

  const i0 = skipWhitespaceAndComments(source, rawStart);
  if (i0 >= trimmedEnd) {
    return { ...base, memberEnd: trimmedEnd };
  }

  if (source.slice(i0, i0 + 3) === "...") {
    return { ...base, memberEnd: trimmedEnd, isSpread: true };
  }

  const c = source[i0]!;
  let key: string | null = null;
  let keyStart: number | null = null;
  let keyEnd: number | null = null;
  let i = i0;

  if (c === '"' || c === "'") {
    keyStart = i;
    keyEnd = skipStringLiteral(source, i);
    key = unquoteSimple(source.slice(keyStart, keyEnd));
    i = keyEnd;
  } else if (IDENT_START_RE.test(c)) {
    keyStart = i;
    let j = i + 1;
    while (j < trimmedEnd && IDENT_PART_RE.test(source[j]!)) j++;
    keyEnd = j;
    key = source.slice(keyStart, keyEnd);
    i = j;
  } else {
    // Computed key ([expr]) or another shape this scanner does not parse.
    return { ...base, memberEnd: trimmedEnd };
  }

  const afterKey = skipWhitespaceAndComments(source, i);
  if (source[afterKey] !== ":") {
    // Shorthand property / method shorthand — recognized key, no value.
    return { ...base, memberEnd: trimmedEnd, key, keyStart, keyEnd };
  }
  const colonIndex = afterKey;
  const valueStart = skipWhitespaceAndComments(source, colonIndex + 1);

  return {
    ...base,
    memberEnd: trimmedEnd,
    key,
    keyStart,
    keyEnd,
    colonIndex,
    valueStart,
    valueEnd: trimmedEnd,
  };
}

/**
 * Split an object literal's body (the span strictly between its `{`/`}`)
 * into top-level members — commas nested inside arrays/objects/calls do not
 * split. Throws `ConfigSyntaxError` on unbalanced brackets or unsupported
 * syntax within the body.
 */
export function splitTopLevelMembers(
  source: string,
  bodyStart: number,
  bodyEnd: number,
): TopLevelMember[] {
  const members: TopLevelMember[] = [];
  let memberStart = bodyStart;
  let depth = 0;
  let i = bodyStart;

  while (i < bodyEnd) {
    const skip = trySkipToken(source, i);
    if (skip !== null) {
      i = Math.min(skip, bodyEnd);
      continue;
    }
    const c = source[i];
    if (c === "{" || c === "[" || c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === "}" || c === "]" || c === ")") {
      depth--;
      if (depth < 0) {
        throw new ConfigSyntaxError(
          "unbalanced brackets while scanning the zudoDoc({...}) object body",
        );
      }
      i++;
      continue;
    }
    if (c === "," && depth === 0) {
      members.push(parseMember(source, memberStart, i, i));
      i++;
      memberStart = i;
      continue;
    }
    i++;
  }

  if (hasSignificantContent(source, memberStart, bodyEnd)) {
    members.push(parseMember(source, memberStart, bodyEnd, null));
  }

  return members;
}

/** True iff `source[start..end)` is EXACTLY one single/double-quoted string
 *  literal (no surrounding characters). Used to confirm a field's existing
 *  value is safe to replace wholesale. */
export function isPlainStringLiteralSpan(source: string, start: number, end: number): boolean {
  if (start >= end) return false;
  const quote = source[start];
  if (quote !== '"' && quote !== "'") return false;
  try {
    return skipStringLiteral(source, start) === end;
  } catch {
    return false;
  }
}

/** Unquote a `"..."`/`'...'` string literal span into its raw string value. */
export function unquoteStringLiteralSpan(source: string, start: number, end: number): string {
  return unquoteSimple(source.slice(start, end));
}
