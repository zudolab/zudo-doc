/**
 * Frontmatter splitter — the package-owned replacement for `gray-matter`
 * (zudolab/zudo-doc#3729).
 *
 * WHY THIS EXISTS: `gray-matter@4` parses YAML through `js-yaml@3`'s
 * `safeLoad`, an API js-yaml 4 removed. That pinned every downstream consumer
 * of this package to the 3.x line and forced them to carry a
 * `js-yaml: ^3.15.1` override — narrow enough to keep gray-matter working,
 * but a compatibility-constrained way to stay ahead of the advisories against
 * older 3.x releases. Splitting the delimiters here and parsing the block with
 * the maintained `yaml` package removes both from the dependency graph, so
 * consumers can drop that override.
 *
 * Delimiter handling below is deliberately byte-for-byte gray-matter's, so
 * existing content keeps parsing identically; each divergence is called out
 * where it happens.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const OPEN = "---";
/** Closing fence, newline included — gray-matter searches for `\n---`, which
 *  is NOT line-anchored: `\n---foo` closes the block just as `\n---` does. */
const CLOSE = "\n---";
const BOM = "\uFEFF";

/**
 * gray-matter's emptiness probe. A block holding only YAML comments counts as
 * empty and is never handed to the parser — note this strips comments for the
 * *test* only; the parser still receives the raw block.
 */
const COMMENT_LINES = /^\s*#[^\n]+/gm;

export interface ParsedFrontmatter {
  /**
   * The parsed frontmatter block, `{}` when there is none.
   *
   * Typed as a record to match gray-matter's own declaration, but a YAML
   * document whose root is a scalar or array passes through unchanged, exactly
   * as gray-matter did — call sites that care guard with an `isRecord` check.
   */
  data: Record<string, unknown>;
  /** Everything after the closing fence, with one leading CRLF/LF removed. */
  content: string;
}

/**
 * Split `input` into frontmatter data and body content.
 *
 * Throws when the block is present but unparseable, which is gray-matter's
 * behavior too — callers that tolerate malformed files already wrap this.
 */
export function matter(input: string): ParsedFrontmatter {
  const raw = input.startsWith(BOM) ? input.slice(BOM.length) : input;

  // An opening fence must sit at offset 0, and a fourth dash makes the line a
  // horizontal rule rather than a fence.
  if (!raw.startsWith(OPEN) || raw.charAt(OPEN.length) === "-") {
    return { data: {}, content: raw };
  }

  let body = raw.slice(OPEN.length);

  // A language tag may follow the opening fence (`---yaml`, `---json`).
  const firstBreak = body.search(/\r?\n/);
  const rawLanguage = firstBreak === -1 ? body : body.slice(0, firstBreak);
  const language = rawLanguage.trim().toLowerCase();
  if (language) body = body.slice(rawLanguage.length);

  let closeIndex = body.indexOf(CLOSE);
  // An unterminated fence swallows the rest of the file, leaving no content.
  const unterminated = closeIndex === -1;
  if (unterminated) closeIndex = body.length;

  // Normalize line breaks before parsing. The closing fence is found by the
  // `\n` in `\r\n`, which leaves the block ending in a lone `\r`; the `yaml`
  // package does not treat that as a line break and would fold it into the
  // last scalar (`title: Home` -> `"Home\r"`). js-yaml 3 normalized breaks the
  // way the YAML spec requires, so doing it here restores parity and keeps
  // CRLF-authored content working. Only the block is touched — the body must
  // keep its original bytes.
  const block = body.slice(0, closeIndex).replace(/\r\n?/g, "\n");

  let content: string;
  if (unterminated) {
    content = "";
  } else {
    content = body.slice(closeIndex + CLOSE.length);
    if (content.startsWith("\r")) content = content.slice(1);
    if (content.startsWith("\n")) content = content.slice(1);
  }

  if (block.replace(COMMENT_LINES, "").trim() === "") {
    return { data: {}, content };
  }

  return { data: parseBlock(block, language), content };
}

function parseBlock(block: string, language: string): Record<string, unknown> {
  if (language === "json") {
    return JSON.parse(block) as Record<string, unknown>;
  }
  if (language !== "" && language !== "yaml" && language !== "yml") {
    // gray-matter also threw here for a tag with no registered engine. Its
    // `javascript` engine is deliberately NOT reimplemented: it ran the block
    // through `eval`, i.e. arbitrary code execution from a content file.
    throw new Error(`Unsupported frontmatter language: "${language}"`);
  }
  // `merge: true` keeps YAML 1.1 merge keys (`<<: *anchor`) resolving, which
  // the js-yaml 3 schema supported. The rest of the dialect stays YAML 1.2
  // core on purpose: a bare `2026-01-12` now yields the STRING that zfb and
  // the docs schema already expect, rather than the `Date` js-yaml 3 coerced
  // it into (zudolab/zudo-doc#3642).
  const parsed = parseYaml(block, { merge: true }) as unknown;
  // A `null` document normalizes to `{}` — gray-matter did this in its excerpt
  // pass. Scalar and array roots deliberately pass through, as they did there.
  return (parsed ?? {}) as Record<string, unknown>;
}

/**
 * Rebuild a document from body content plus frontmatter data — the inverse of
 * {@link matter}, and the one writer this package needs (`tags-suggest` writes
 * approved tags back into a doc file).
 *
 * Matches gray-matter's `stringify`: empty data emits no fence at all, and the
 * body always ends with a newline. The one deliberate difference is that long
 * scalars are NOT folded. js-yaml's 80-column default reflowed unrelated
 * frontmatter — a long `description:` came back as a `>-` block — which is
 * needless churn in a file the tool is only meant to add tags to.
 */
export function stringify(
  content: string,
  data: Record<string, unknown>,
): string {
  const block = stringifyYaml(data, { lineWidth: 0 }).trim();
  const fence = block === "{}" ? "" : `${OPEN}\n${block}\n${OPEN}\n`;
  return fence + (content.endsWith("\n") ? content : `${content}\n`);
}
