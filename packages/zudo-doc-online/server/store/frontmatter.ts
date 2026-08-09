/**
 * The page file format: a YAML frontmatter block followed by markdown.
 *
 * Only three scalar fields are legal (`title`, `description`, `draft`), which
 * is why this module hand-rolls the block instead of pulling in a YAML
 * library: the grammar it must cover is "flat scalars", and epic #3327's
 * contract 4 freezes the dependency list at the bootstrap sub-issue anyway.
 *
 * Title ownership (contract 1): this block is the ONLY home for a page's
 * title, description and draft flag. The outline stores structure and nothing
 * else, so anything that wants a title reads it from here.
 */

import { z } from "zod";

export const FRONTMATTER_FENCE = "---";

/**
 * Strict on purpose. An unknown key means the file was written by something
 * that does not share this contract, and silently dropping it on the next
 * write would destroy the author's data — the store quarantines the file
 * instead (see `readPageFile`).
 */
export const pageFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    draft: z.boolean().optional(),
  })
  .strict();

export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;

export interface ParsedPageFile {
  frontmatter: PageFrontmatter;
  markdown: string;
}

/** Why a page file could not be read, for the quarantine message. */
export type FrontmatterProblem = string;

export type ParseOutcome =
  | { ok: true; value: ParsedPageFile }
  | { ok: false; problem: FrontmatterProblem };

/**
 * Splits a page file into its frontmatter block and body.
 *
 * A file with no frontmatter block is a parse failure rather than a body-only
 * page: `title` is required, so a page without a block has no title, and
 * inventing one would put a second title source into the system.
 */
export function parsePageFile(raw: string): ParseOutcome {
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
  const lines = text.split(/\r\n|\r|\n/);

  if (lines[0]?.trim() !== FRONTMATTER_FENCE) {
    return { ok: false, problem: "missing frontmatter block" };
  }

  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === FRONTMATTER_FENCE) {
      end = index;
      break;
    }
  }
  if (end === -1) {
    return { ok: false, problem: "unterminated frontmatter block" };
  }

  const fields: Record<string, unknown> = {};
  for (let index = 1; index < end; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) continue;

    const separator = line.indexOf(":");
    if (separator === -1) {
      return { ok: false, problem: `frontmatter line ${index + 1} is not "key: value"` };
    }
    const key = line.slice(0, separator).trim();
    if (key.length === 0) {
      return { ok: false, problem: `frontmatter line ${index + 1} has an empty key` };
    }

    const scalar = parseScalar(line.slice(separator + 1).trim());
    if (!scalar.ok) {
      return { ok: false, problem: `frontmatter key "${key}": ${scalar.problem}` };
    }
    fields[key] = scalar.value;
  }

  const parsed = pageFrontmatterSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, problem: describeZodProblem(parsed.error) };
  }

  return {
    ok: true,
    value: {
      frontmatter: parsed.data,
      // Leading blank lines are dropped on both sides of the round trip: the
      // serializer inserts one after the closing fence for readability, and a
      // body that gained a blank line every save would never compare equal.
      markdown: stripLeadingBlankLines(lines.slice(end + 1)).join("\n"),
    },
  };
}

/**
 * Renders a page file. Field order is fixed rather than object-key order so
 * two writes of the same content produce byte-identical files — the store
 * compares bytes to decide whether anything actually changed.
 */
export function serializePageFile(
  frontmatter: PageFrontmatter,
  markdown: string,
): string {
  const lines = [FRONTMATTER_FENCE, `title: ${quote(frontmatter.title)}`];
  if (frontmatter.description !== undefined) {
    lines.push(`description: ${quote(frontmatter.description)}`);
  }
  if (frontmatter.draft !== undefined) {
    lines.push(`draft: ${frontmatter.draft ? "true" : "false"}`);
  }
  lines.push(FRONTMATTER_FENCE);

  const body = markdown.replace(/^\n+/, "");
  return `${lines.join("\n")}\n${body.length > 0 ? `\n${body}` : ""}`;
}

function stripLeadingBlankLines(lines: string[]): string[] {
  let start = 0;
  while (start < lines.length && (lines[start] ?? "").length === 0) start += 1;
  return lines.slice(start);
}

type ScalarOutcome =
  | { ok: true; value: string | boolean }
  | { ok: false; problem: string };

/**
 * Covers exactly the YAML this module emits plus the plain scalars a human
 * would hand-write: double-quoted (with escapes), single-quoted (with `''`),
 * `true`/`false`, and unquoted text.
 */
function parseScalar(raw: string): ScalarOutcome {
  if (raw.length === 0) return { ok: false, problem: "value is empty" };

  if (raw.startsWith('"')) {
    return parseDoubleQuoted(raw);
  }
  if (raw.startsWith("'")) {
    if (!raw.endsWith("'") || raw.length < 2) {
      return { ok: false, problem: "unterminated single-quoted value" };
    }
    return { ok: true, value: raw.slice(1, -1).replace(/''/g, "'") };
  }
  if (raw === "true" || raw === "false") return { ok: true, value: raw === "true" };

  // Block scalars (`|`, `>`), flow collections and anchors are all outside the
  // supported grammar; rejecting them keeps "what we can read" identical to
  // "what we can write" rather than half-understanding a richer file.
  if (/^[|>&*[{]/.test(raw)) {
    return { ok: false, problem: "unsupported YAML value" };
  }
  return { ok: true, value: raw };
}

function parseDoubleQuoted(raw: string): ScalarOutcome {
  let value = "";
  let index = 1;
  while (index < raw.length) {
    const char = raw[index];
    if (char === "\\") {
      const escaped = raw[index + 1];
      if (escaped === undefined) {
        return { ok: false, problem: "dangling escape in double-quoted value" };
      }
      value += unescape(escaped);
      index += 2;
      continue;
    }
    if (char === '"') {
      if (index !== raw.length - 1) {
        return { ok: false, problem: "trailing text after double-quoted value" };
      }
      return { ok: true, value };
    }
    value += char;
    index += 1;
  }
  return { ok: false, problem: "unterminated double-quoted value" };
}

function unescape(char: string): string {
  switch (char) {
    case "n":
      return "\n";
    case "t":
      return "\t";
    case "r":
      return "\r";
    default:
      return char;
  }
}

/**
 * Double quotes everything, so no value can ever be mistaken for a boolean,
 * a number or a YAML directive. Newlines and tabs are escaped rather than
 * folded — a double-quoted scalar keeps the block one line per field.
 */
function quote(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function describeZodProblem(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "invalid frontmatter";
  const path = first.path.join(".");
  return path.length > 0 ? `frontmatter "${path}": ${first.message}` : first.message;
}
