#!/usr/bin/env node
// @takazudo/zudo-doc/bin/gen-z-index.mjs
//
// Package bin: regenerate (or check) the GENERATED:Z_INDEX marker block inside
// a project's src/styles/global.css from the single source of truth in
// src/config/z-index-tokens.ts.
//
// Reads from the project root (process.cwd()). Conventional paths:
//   - Tokens: src/config/z-index-tokens.ts (override with --tokens <path>)
//   - CSS:    src/styles/global.css (override with --css <path>)
//
// Usage (after pnpm install, via scripts in package.json):
//   gen-z-index                               # rewrite the @theme block (conventional paths)
//   gen-z-index --check                       # verify committed block is up to date (exit 1 on drift)
//   gen-z-index --tokens <path> --css <path>  # use non-conventional source/destination paths
//   gen-z-index --no-theme-wrapper            # emit bare --z-index-<name> declarations, no @theme wrapper
//   gen-z-index --md-table <path>             # also generate/verify a Z_INDEX_TABLE region in a
//                                              # markdown/MDX file (opt-in, no conventional default path)
//
// MUST be run with the project root as cwd — it resolves --tokens/--css/
// --md-table (or their conventional defaults) against process.cwd(), NOT
// against this file's location. A consuming project's own package.json
// scripts (e.g. gen:z-index / check:z-index) are responsible for invoking it
// from the project root. This generator is opt-in per project — a project
// only needs it when overriding one of the default tiers shipped
// unconditionally by @takazudo/zudo-doc/theme.css — and it is not wired into
// this repo's own b4push or CI; that integration was retired in
// zudolab/zudo-doc#2661.
//
// The block is a Tailwind v4 `@theme { --z-index-<name>: <value>; }` for every
// tier, so Tailwind generates `z-<name>` utilities and raw CSS can reference
// `z-index: var(--z-index-<name>)`. `--no-theme-wrapper` drops the `@theme`
// wrapper and emits bare `--z-index-<name>: <value>;` declarations instead,
// for projects that want to compose the block into their own `@theme` block.
//
// `--md-table <path>` additionally generates/verifies a second, independent
// `GENERATED:Z_INDEX_TABLE` region — a `| Token | Kind | Role |` table, one
// row per tier — inside a markdown/MDX file at <path>. It uses the MDX-safe
// brace-comment marker form `{/* GENERATED:Z_INDEX_TABLE_BEGIN/END */}`
// rather than an HTML `<!-- -->` comment, because an HTML comment is a parse
// error in MDX. `--check` verifies BOTH regions when --md-table is given;
// drift in either exits 1. Like the CSS block, the md-table region must be
// seeded once by hand (just the marker pair) before the generator can find
// it to replace. On this surface ONLY, marker lines inside a CommonMark
// fenced code block are ignored, so a doc page may reproduce the marker
// verbatim while explaining the generator (see `scanMarkerLines`).
//
// Pure Node (fs only — NO npm deps, no minimist). Idempotent: running twice
// produces no diff.
//
// MAINTENANCE: edit src/config/z-index-tokens.ts (the source of truth), then
// run `pnpm gen:z-index` (or the equivalent --tokens/--css/--md-table
// invocation) and commit the regenerated CSS (and md table, if used). Never
// hand-edit either block between its BEGIN/END markers.

import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BEGIN_MARKER = "GENERATED:Z_INDEX_BEGIN";
const END_MARKER = "GENERATED:Z_INDEX_END";

// MDX-safe markers for the optional --md-table region. An HTML `<!-- -->`
// comment is a parse error in MDX, which is the entire reason this region
// uses the brace-comment form instead — both markers are the literal,
// complete text that must appear (on their own line) in the seeded file.
const MD_TABLE_BEGIN_MARKER = "{/* GENERATED:Z_INDEX_TABLE_BEGIN */}";
const MD_TABLE_END_MARKER = "{/* GENERATED:Z_INDEX_TABLE_END */}";

// Conventional paths, relative to the project root (process.cwd()). Used as
// the default --tokens/--css values AND as the literal text shown in the
// generated header / log messages when no override is given — this is what
// keeps the default invocation's output byte-identical to pre-flag output.
// --md-table has NO conventional default: it's an opt-in region and there's
// no natural project-wide path to assume, so it stays undefined unless given.
const DEFAULT_TOKENS_PATH = "src/config/z-index-tokens.ts";
const DEFAULT_CSS_PATH = "src/styles/global.css";

const TIER_NAME_RE = /^[a-z0-9-]+$/;

const FLAG_USAGE =
  "Supported flags: --check, --tokens <path>, --css <path>, --md-table <path>, --no-theme-wrapper.";

/**
 * Hand-rolled argv parser (no minimist — this bin stays dependency-free).
 * Supports `--flag value` and `--flag=value` for value flags. Unknown flags,
 * repeated flags, a missing value for a value flag, and a value attached to a
 * boolean flag (`--no-theme-wrapper=x`) are all hard errors — this bin does
 * not silently ignore or guess at malformed invocations.
 *
 * Returns `{ check, tokens, css, mdTable, noThemeWrapper }`; `tokens`/`css`/
 * `mdTable` are `undefined` when not passed (callers apply the conventional
 * defaults — `mdTable` has none, so it stays undefined and the md-table
 * region is skipped entirely).
 *
 * Exported for unit testing.
 */
export function parseArgs(argv) {
  const result = {
    check: false,
    tokens: undefined,
    css: undefined,
    mdTable: undefined,
    noThemeWrapper: false,
  };
  const seen = new Set();

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const eqIdx = raw.startsWith("--") ? raw.indexOf("=") : -1;
    const flag = eqIdx === -1 ? raw : raw.slice(0, eqIdx);
    const inlineValue = eqIdx === -1 ? undefined : raw.slice(eqIdx + 1);

    const isBoolean = flag === "--check" || flag === "--no-theme-wrapper";
    const isValueFlag = flag === "--tokens" || flag === "--css" || flag === "--md-table";

    if (!isBoolean && !isValueFlag) {
      throw new Error(`Unknown flag "${raw}". ${FLAG_USAGE}`);
    }
    if (seen.has(flag)) {
      throw new Error(`Flag "${flag}" was passed more than once.`);
    }
    seen.add(flag);

    if (isBoolean) {
      if (inlineValue !== undefined) {
        throw new Error(
          `Flag "${flag}" does not take a value (got "${raw}"); it is a boolean switch.`,
        );
      }
      if (flag === "--check") result.check = true;
      if (flag === "--no-theme-wrapper") result.noThemeWrapper = true;
      continue;
    }

    // Value flag (--tokens / --css / --md-table): accept an inline `=value`,
    // otherwise consume the next argv token. A missing/empty value or a next
    // token that looks like another flag is a hard error, not a silent
    // default.
    let value = inlineValue;
    if (value === undefined) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error(`Flag "${flag}" requires a value (e.g. "${flag} <path>").`);
      }
      value = next;
      i++;
    }
    if (value === "") {
      throw new Error(`Flag "${flag}" requires a non-empty value.`);
    }
    if (flag === "--tokens") result.tokens = value;
    if (flag === "--css") result.css = value;
    if (flag === "--md-table") result.mdTable = value;
  }

  return result;
}

/**
 * Structural validations that apply regardless of `kind`/`purpose` usage,
 * plus the opt-in per-kind value-uniqueness check. Called by `parseTiers`
 * after regex-extraction, and exported separately so tests can exercise it
 * directly against hand-built tier arrays.
 *
 * - Rejects an empty tiers array (preserves the pre-refactor behavior).
 * - Rejects a tier name that doesn't match `^[a-z0-9-]+$`.
 * - Rejects duplicate tier names.
 * - If at least one tier carries `kind`, rejects two "global" tiers sharing a
 *   value. "local" tiers MAY share a value with each other; kind-less tiers
 *   are exempt from this check entirely.
 *
 * Exported for unit testing.
 */
export function validateTiers(tiers, tokensPath = DEFAULT_TOKENS_PATH) {
  if (tiers.length === 0) {
    throw new Error(`Z_INDEX_TIERS in ${tokensPath} parsed to an empty list`);
  }

  const seenNames = new Set();
  for (const tier of tiers) {
    if (!TIER_NAME_RE.test(tier.name)) {
      throw new Error(
        `Invalid tier name "${tier.name}" in ${tokensPath}: tier names must match ` +
          `${TIER_NAME_RE} (lowercase letters, digits, hyphens only).`,
      );
    }
    if (seenNames.has(tier.name)) {
      throw new Error(
        `Duplicate tier name "${tier.name}" in ${tokensPath}. Tier names must be unique.`,
      );
    }
    seenNames.add(tier.name);
  }

  const anyKinded = tiers.some((tier) => tier.kind !== undefined);
  if (anyKinded) {
    const seenGlobalValues = new Map();
    for (const tier of tiers) {
      if (tier.kind !== "global") continue;
      const existing = seenGlobalValues.get(tier.value);
      if (existing !== undefined) {
        throw new Error(
          `Duplicate z-index value ${tier.value} shared by "global" tiers "${existing}" ` +
            `and "${tier.name}" in ${tokensPath}. Global tiers must have unique values ` +
            `(local tiers may share a value).`,
        );
      }
      seenGlobalValues.set(tier.value, tier.name);
    }
  }

  return tiers;
}

/**
 * Scans the raw Z_INDEX_TIERS array body for `purpose:` fields and rejects
 * any whose quoted value contains a brace or a backslash (which also covers
 * escaped quotes) BEFORE the per-object splitter runs. The per-object
 * splitter below uses a non-greedy `{...}` match to isolate each tier object,
 * which only works when no field value contains a brace — a purpose string
 * with a stray `}` would silently truncate the object split and corrupt
 * parsing instead of failing loudly. Only a flat, plain double-quoted string
 * is supported; a newline between `purpose:` and the opening quote is fine
 * (the field-key regexes below all use `\s*`, which matches newlines).
 */
function assertSupportedPurposeGrammar(body, tokensPath) {
  const purposeKeyRe = /purpose:\s*/g;
  let m;
  while ((m = purposeKeyRe.exec(body)) !== null) {
    const afterKey = m.index + m[0].length;
    if (body[afterKey] !== '"') {
      // Not immediately followed by a quote — not a value this scan can
      // confirm is a real field; let the per-object parser's generic
      // "malformed tier object" error handle it if it really is one.
      continue;
    }
    let i = afterKey + 1;
    let closed = false;
    for (; i < body.length; i++) {
      const ch = body[i];
      if (ch === "{" || ch === "}" || ch === "\\") {
        throw new Error(
          `Unsupported purpose string grammar in ${tokensPath}: purpose values may not ` +
            `contain braces, backslashes, or escaped quotes — only flat, plain double-quoted ` +
            `strings are supported (the object parser cannot safely handle anything else). ` +
            `Offending text near: ${JSON.stringify(body.slice(afterKey, Math.min(afterKey + 40, body.length)))}`,
        );
      }
      if (ch === '"') {
        closed = true;
        break;
      }
    }
    if (!closed) {
      throw new Error(
        `Unterminated purpose string in ${tokensPath} (no closing double quote found).`,
      );
    }
    purposeKeyRe.lastIndex = i + 1;
  }
}

/**
 * Parse the Z_INDEX_TIERS array out of z-index-tokens.ts WITHOUT importing it
 * (this bin is a dependency-free .mjs and cannot resolve TypeScript). Reads
 * each `{ name: "...", value: <n>, kind?: "global"|"local", purpose?: "..." }`
 * object literal. Throws on a malformed source, an unsupported purpose-string
 * grammar, or an unknown `kind` value so drift between the parser and the
 * file surfaces loudly. Delegates the structural invariants (non-empty,
 * name shape, duplicate names, per-kind value uniqueness) to `validateTiers`.
 *
 * `tokensPath` is used purely for error-message context — pass the same path
 * string (conventional default or an explicit --tokens value) that was used
 * to read `src`, so the thrown error tells the reader exactly which file to
 * fix.
 *
 * Exported for unit testing.
 */
export function parseTiers(src, tokensPath = DEFAULT_TOKENS_PATH) {
  const arrayMatch = src.match(
    /export const Z_INDEX_TIERS[^=]*=\s*\[([\s\S]*?)\];/,
  );
  if (!arrayMatch) {
    throw new Error(
      `Could not locate "export const Z_INDEX_TIERS = [ ... ]" in ${tokensPath}`,
    );
  }
  const body = arrayMatch[1];

  assertSupportedPurposeGrammar(body, tokensPath);

  const tiers = [];
  // Each tier is a `{ ... }` object literal; iterate top-level braces. Safe
  // because assertSupportedPurposeGrammar above already ruled out braces
  // inside any purpose string.
  const objectRe = /\{([\s\S]*?)\}/g;
  let m;
  while ((m = objectRe.exec(body)) !== null) {
    const obj = m[1];
    const nameMatch = obj.match(/name:\s*"([^"]+)"/);
    const valueMatch = obj.match(/value:\s*(-?\d+)/);
    if (!nameMatch || !valueMatch) {
      throw new Error(
        `Malformed tier object in Z_INDEX_TIERS (missing name/value) in ${tokensPath}: ${obj.trim()}`,
      );
    }

    const tier = { name: nameMatch[1], value: Number(valueMatch[1]) };

    const kindMatch = obj.match(/kind:\s*"([^"]*)"/);
    if (kindMatch) {
      const kindValue = kindMatch[1];
      if (kindValue !== "global" && kindValue !== "local") {
        throw new Error(
          `Invalid kind "${kindValue}" for tier "${tier.name}" in ${tokensPath} ` +
            `(expected "global" or "local").`,
        );
      }
      tier.kind = kindValue;
    }

    const purposeMatch = obj.match(/purpose:\s*"([^"]*)"/);
    if (purposeMatch) {
      tier.purpose = purposeMatch[1];
    }

    tiers.push(tier);
  }

  return validateTiers(tiers, tokensPath);
}

/**
 * Wraps a path in double quotes so it copy-pastes safely into a shell even
 * when it contains a space (an unquoted `--tokens a b.ts` would otherwise
 * split into two argv tokens on rerun).
 */
function shellQuote(value) {
  return `"${value}"`;
}

/**
 * Builds the rerun-guidance command shown in the generated header comment and
 * in main()'s drift/error messages. Returns the exact legacy "pnpm
 * gen:z-index" text when every option is at its conventional default (the
 * byte-identity case); otherwise builds an explicit, directly-runnable
 * `pnpm exec gen-z-index ...` invocation carrying only the non-default flags
 * (quoted), so the guidance always reruns with the SAME effective options
 * that produced the current output. `pnpm exec` — rather than a bare
 * `gen-z-index` — is used because a project customizing --tokens/--css has
 * no guarantee it also defined a package.json script alias for that exact
 * invocation; `pnpm exec` resolves the package-local bin regardless.
 *
 * `mdTablePath` has no conventional default (undefined = --md-table wasn't
 * given), so its mere presence always disqualifies the byte-identity case.
 */
function buildRerunCommand({ tokensPath, cssPath, themeWrapper, mdTablePath }) {
  const isDefault =
    tokensPath === DEFAULT_TOKENS_PATH &&
    cssPath === DEFAULT_CSS_PATH &&
    themeWrapper === true &&
    mdTablePath === undefined;
  if (isDefault) return "pnpm gen:z-index";

  const parts = ["pnpm exec gen-z-index"];
  if (tokensPath !== DEFAULT_TOKENS_PATH) parts.push(`--tokens ${shellQuote(tokensPath)}`);
  if (cssPath !== DEFAULT_CSS_PATH) parts.push(`--css ${shellQuote(cssPath)}`);
  if (!themeWrapper) parts.push("--no-theme-wrapper");
  if (mdTablePath !== undefined) parts.push(`--md-table ${shellQuote(mdTablePath)}`);
  return parts.join(" ");
}

/**
 * Build the full generated block (markers included). Two leading spaces of
 * indentation match the surrounding `@theme` style in global.css.
 *
 * `options.tokensPath`/`options.cssPath` feed the "Source of truth:" and
 * rerun-guidance lines in the header comment — pass the SAME path strings
 * (conventional defaults or explicit --tokens/--css values) used to read/
 * write the actual files, so a reader of the committed CSS can tell exactly
 * where the block came from and how to regenerate it. With every option at
 * its default, the header is byte-identical to the pre-flag generator.
 *
 * `options.themeWrapper` (default `true`) wraps the declarations in an
 * `@theme { ... }` block; `false` (the `--no-theme-wrapper` CLI flag) emits
 * bare `--z-index-<name>: <value>;` declarations at 2-space indent instead,
 * for projects composing the block into their own `@theme` block.
 *
 * Deliberately does NOT accept `mdTablePath`: the CSS block's own content
 * must depend only on the CSS-region flags (--tokens/--css/--no-theme-
 * wrapper), never on whether --md-table happens to be passed in a given
 * invocation — otherwise adding/dropping --md-table would flip the embedded
 * rerun-guidance text and manufacture CSS-region drift unrelated to any
 * actual tier change. `main()`'s own drift/error messages use
 * `buildRerunCommand` directly (with `mdTablePath`) for that guidance instead.
 *
 * Exported for unit testing.
 */
export function buildBlock(tiers, options = {}) {
  const {
    tokensPath = DEFAULT_TOKENS_PATH,
    cssPath = DEFAULT_CSS_PATH,
    themeWrapper = true,
  } = options;

  const lines = [];
  lines.push(`  /* ${BEGIN_MARKER}`);
  lines.push(
    `   * GENERATED:Z_INDEX — do not hand-edit; run ${buildRerunCommand({ tokensPath, cssPath, themeWrapper })}.`,
  );
  lines.push(`   * Source of truth: ${tokensPath}. Tailwind v4 reads the`);
  lines.push(
    `   * --z-index-<name> theme key and generates a z-<name> utility. */`,
  );
  if (themeWrapper) {
    lines.push(`  @theme {`);
    for (const tier of tiers) {
      lines.push(`    --z-index-${tier.name}: ${tier.value};`);
    }
    lines.push(`  }`);
  } else {
    for (const tier of tiers) {
      lines.push(`  --z-index-${tier.name}: ${tier.value};`);
    }
  }
  lines.push(`  /* ${END_MARKER} */`);
  return lines.join("\n");
}

// CommonMark fenced-code-block rules (https://spec.commonmark.org/0.31.2/
// #fenced-code-blocks), transcribed only as far as `scanMarkerLines` needs
// them. Each of these is a rule a `trim()` + `startsWith` approximation gets
// wrong, which is why they are spelled out here rather than eyeballed:
//
//   - An opening fence carries AT MOST three spaces of indentation. Four
//     spaces makes the line indented code, not a fence.
//   - A fence may open on a list-item line (`- ```mdx`), because the list
//     marker is a container prefix rather than content. Missing this one is
//     not a harmless false negative: the item's closing fence — indented to
//     the item's content column, so carrying NO list marker — would then be
//     read as a fresh opener and swallow every marker below it, silently
//     splicing the generated block into the quoted example. Loud failure is
//     acceptable here; silent corruption is not.
//   - A backtick opening fence's info string may not itself contain a
//     backtick (a tilde fence's info string may contain anything).
//   - A closing fence repeats the SAME character, at least as many times as
//     the opener, followed by whitespace only — so an info-string line such
//     as ```js does not close an already-open fence. It carries no list
//     marker of its own, which is why only OPEN_FENCE_RE accepts one.
const OPEN_FENCE_RE = /^ {0,3}(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}|~{3,})(.*)$/;
const CLOSE_FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/**
 * Walks `source` line by line and returns the character offsets (into
 * `source`, in source order) of every LINE-ANCHORED occurrence of `marker` —
 * a line where removing the marker text leaves behind only whitespace and
 * comment/brace delimiter characters. This is the single scanner both
 * `replaceBlock`'s validation (duplicate/missing/inverted) and its splice
 * positions read from, so counting and locating can never diverge: a marker
 * mentioned in prose (e.g. "see GENERATED:Z_INDEX_BEGIN for details") is
 * invisible to this scanner, whether it appears before, between, or after the
 * real structural markers.
 *
 * Predicate: for a line containing `marker`, `line.replace(marker, "")` must
 * match `/^[\s{}/*]*$/`. This covers both real marker forms — the CSS
 * mid-comment-line pair (e.g. `  /* GENERATED:Z_INDEX_BEGIN`) and the MDX
 * whole-line brace-comment pair (e.g. `{/* GENERATED:Z_INDEX_TABLE_BEGIN`,
 * closed by a trailing brace-comment on the same line) — while rejecting a
 * line where the marker is only part of a prose sentence.
 *
 * `options.excludeFencedCode` (default `false`) additionally tracks
 * CommonMark fenced-code state (see the two regexes above) and makes every
 * line from an opening fence through its closing fence — inclusive, and
 * through end-of-source for an unterminated fence — ineligible. It is
 * OFF by default and passed only from the `--md-table` surface: fences are a
 * markdown construct, and the CSS surface must keep byte-identical behaviour.
 *
 * ACCEPTED LIMITATION: a marker line inside a **four-space-indented** code
 * block is still counted. Indented code is not a fence, and detecting it
 * needs far more markdown awareness (list-item continuation indentation,
 * paragraph interruption rules) than a dependency-free bin should carry —
 * zudolab/zudo-doc#3290 names fenced code, not indented code. The failure
 * mode stays loud (a "duplicate markers" error), never silent corruption.
 *
 * Exported for unit testing.
 */
export function scanMarkerLines(source, marker, options = {}) {
  const { excludeFencedCode = false } = options;
  const RESIDUE_RE = /^[\s{}/*]*$/;
  const offsets = [];
  // `{ char, length }` while inside an open fenced region, else null.
  let fence = null;
  let lineStart = 0;
  while (lineStart <= source.length) {
    const newlineIdx = source.indexOf("\n", lineStart);
    const lineEnd = newlineIdx === -1 ? source.length : newlineIdx;
    const line = source.slice(lineStart, lineEnd);

    let eligible = true;
    if (excludeFencedCode) {
      // Classify against the line minus a CRLF carriage return, so the
      // "whitespace only after a closing fence" rule still holds on a CRLF
      // source. Offsets are unaffected — `line` itself is untouched.
      const text = line.endsWith("\r") ? line.slice(0, -1) : line;
      if (fence !== null) {
        const close = CLOSE_FENCE_RE.exec(text);
        if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
          fence = null;
        }
        eligible = false;
      } else {
        const open = OPEN_FENCE_RE.exec(text);
        const backtickInInfoString = open !== null && open[1][0] === "`" && open[2].includes("`");
        if (open !== null && !backtickInInfoString) {
          fence = { char: open[1][0], length: open[1].length };
          eligible = false;
        }
      }
    }

    if (eligible) {
      const markerIdxInLine = line.indexOf(marker);
      if (markerIdxInLine !== -1 && RESIDUE_RE.test(line.replace(marker, ""))) {
        offsets.push(lineStart + markerIdxInLine);
      }
    }
    if (newlineIdx === -1) break;
    lineStart = newlineIdx + 1;
  }
  return offsets;
}

/**
 * Replace the existing BEGIN…END block in `source` with `block`. Requires
 * EXACTLY one line-anchored BEGIN and one line-anchored END marker (per
 * `scanMarkerLines`), with BEGIN preceding END — throws a clear, distinct
 * error for each failure mode: missing (the block must be seeded once by
 * hand), duplicated, or inverted markers.
 *
 * `beginMarker`/`endMarker` default to the CSS `@theme` block's markers so
 * existing call sites (the CSS region) are unaffected; the `--md-table`
 * region passes `MD_TABLE_BEGIN_MARKER`/`MD_TABLE_END_MARKER` instead — same
 * function, parameterized, mirroring how gen-component-tokens.mjs reuses one
 * `replaceBlock` across its content/chrome surfaces. `filePath` is used
 * purely for error-message context (pass the conventional default or an
 * explicit --css/--md-table value).
 *
 * `options.excludeFencedCode` is forwarded verbatim to `scanMarkerLines` and
 * is gated on the SURFACE, not on the marker strings: only the `--md-table`
 * call site passes it. Defaulting it off keeps every CSS call site — and its
 * output — byte-unchanged.
 *
 * Exported for unit testing.
 */
export function replaceBlock(
  source,
  block,
  beginMarker = BEGIN_MARKER,
  endMarker = END_MARKER,
  filePath = DEFAULT_CSS_PATH,
  options = {},
) {
  const { excludeFencedCode = false } = options;
  const scanOptions = { excludeFencedCode };
  const beginOffsets = scanMarkerLines(source, beginMarker, scanOptions);
  const endOffsets = scanMarkerLines(source, endMarker, scanOptions);

  if (beginOffsets.length === 0 || endOffsets.length === 0) {
    throw new Error(
      `Could not find ${beginMarker} … ${endMarker} markers in ${filePath}.\n` +
        `Seed the marker block once by hand, then re-run the generator.`,
    );
  }
  if (beginOffsets.length > 1 || endOffsets.length > 1) {
    throw new Error(
      `Found duplicate markers in ${filePath} (${beginOffsets.length} BEGIN "${beginMarker}", ` +
        `${endOffsets.length} END "${endMarker}"; expected exactly one of each). Remove the extra ` +
        `marker(s) by hand, then re-run the generator.`,
    );
  }

  const beginIdx = beginOffsets[0];
  const endIdx = endOffsets[0];
  if (beginIdx > endIdx) {
    throw new Error(
      `Markers in ${filePath} are inverted — the END marker (${endMarker}) appears before ` +
        `the BEGIN marker (${beginMarker}). Fix the marker order by hand, then re-run the ` +
        `generator.`,
    );
  }

  // Expand to the full line that opens the block and to the end of the line
  // that closes it, so the whole region (CSS comment or MDX brace-comment) is
  // replaced.
  const lineStart = source.lastIndexOf("\n", beginIdx) + 1;
  const afterEnd = source.indexOf("\n", endIdx);
  const lineEnd = afterEnd === -1 ? source.length : afterEnd;
  return source.slice(0, lineStart) + block + source.slice(lineEnd);
}

/**
 * Collapses whitespace runs — including an embedded literal newline from a
 * multi-line `purpose:` source string (the source grammar permits a raw
 * newline between the opening/closing quotes; only braces/backslashes/
 * escaped quotes are rejected, see `assertSupportedPurposeGrammar`) — into a
 * single space, and trims the result. A markdown/GFM table cell cannot
 * contain a raw newline without corrupting the row.
 */
function collapseWhitespace(str) {
  return str.replace(/\s+/g, " ").trim();
}

/** Escapes a literal `|` so it can't be misread as a table-cell boundary. */
function escapeTableCell(str) {
  return str.replace(/\|/g, "\\|");
}

/**
 * Escapes the characters MDX treats as syntax in text position — `<` (JSX
 * tag open) and `{`/`}` (expression delimiters) — as character references,
 * so a purpose like "search <dialog>" is emitted as literal text instead of
 * failing MDX compilation as an unclosed JSX element. `&` is escaped FIRST
 * so a purpose that already spells out an entity (e.g. "&lt;") stays
 * literal `&lt;` on the rendered page instead of collapsing to `<`, and so
 * the replacements below can never double-escape their own output.
 *
 * Braces cannot reach here via the CLI (`assertSupportedPurposeGrammar`
 * rejects them at parse time), but `buildMdTable` is an exported helper that
 * accepts hand-built tier arrays, so it defends against them itself.
 */
function escapeMdxText(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/**
 * Build the full `--md-table` region (markers included): a GFM
 * `| Token | Kind | Role |` table, one row per tier, in source order.
 *   - Token: the tier name.
 *   - Kind: the tier's optional `kind` field, or `-` when absent.
 *   - Role: the tier's optional `purpose` field with internal whitespace/
 *     newlines collapsed to single spaces, or `-` when absent/empty.
 * `|` in any cell is escaped so a stray pipe in a purpose string can't
 * corrupt the table structure. The Role cell is additionally MDX-escaped
 * (`&` first, then `<`/`{`/`}` — see `escapeMdxText`) so a purpose like
 * "search <dialog>" can't make the emitted .mdx fail to compile as an
 * unclosed JSX element.
 *
 * `options.tokensPath` feeds the "do not hand-edit" note beneath the BEGIN
 * marker (same default/meaning as `buildBlock`'s `tokensPath`).
 * `options.beginMarker`/`options.endMarker` default to the MDX-safe
 * `MD_TABLE_BEGIN_MARKER`/`MD_TABLE_END_MARKER` pair — overridable for tests,
 * same convention as `replaceBlock`.
 *
 * Exported for unit testing.
 */
export function buildMdTable(tiers, options = {}) {
  const {
    tokensPath = DEFAULT_TOKENS_PATH,
    beginMarker = MD_TABLE_BEGIN_MARKER,
    endMarker = MD_TABLE_END_MARKER,
  } = options;

  const lines = [];
  lines.push(beginMarker);
  lines.push("");
  lines.push(
    `_Generated by \`gen-z-index --md-table\`; do not hand-edit — edit \`${tokensPath}\` instead._`,
  );
  lines.push("");
  lines.push("| Token | Kind | Role |");
  lines.push("| --- | --- | --- |");
  for (const tier of tiers) {
    const token = escapeTableCell(tier.name);
    const kind = escapeTableCell(tier.kind ?? "-");
    // Collapse first, THEN decide the fallback — a whitespace-only purpose
    // (e.g. "   ") is truthy but collapses to "", which must still fall back
    // to "-" rather than emit a blank Role cell.
    const collapsedPurpose = tier.purpose ? collapseWhitespace(tier.purpose) : "";
    // Role is the only free-text cell (Token is ^[a-z0-9-]+$, Kind is
    // global|local|-), so it alone needs MDX escaping on top of the pipe
    // escaping.
    const role = collapsedPurpose
      ? escapeTableCell(escapeMdxText(collapsedPurpose))
      : "-";
    lines.push(`| ${token} | ${kind} | ${role} |`);
  }
  lines.push("");
  lines.push(endMarker);
  return lines.join("\n");
}

/**
 * CLI entrypoint. `argv` defaults to the real process argv (minus the node/
 * script prefix) so `isDirectInvocation()` below can call `main()` with no
 * arguments, while tests can pass a synthetic argv without touching
 * `process.argv`. Resolves --tokens/--css/--md-table against `process.cwd()`
 * (the project root) for actual file I/O, but threads the AS-GIVEN path
 * strings (conventional defaults or explicit flag values) through to every
 * message and into the generated header — never the resolved absolute path —
 * so the committed CSS/md file never embeds a machine-specific path.
 *
 * The CSS `@theme` region is always generated/verified. The `--md-table`
 * region is entirely opt-in: when `--md-table <path>` isn't passed, no md
 * file is read, built, or written, and `--check` only covers the CSS region
 * (unchanged from pre-`--md-table` behavior). When it IS passed, `--check`
 * covers BOTH regions — drift in either exits 1.
 *
 * Exported for unit testing.
 */
export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const tokensPath = args.tokens ?? DEFAULT_TOKENS_PATH;
  const cssPath = args.css ?? DEFAULT_CSS_PATH;
  const themeWrapper = !args.noThemeWrapper;
  const mdTablePath = args.mdTable;

  const root = process.cwd();
  const tokensAbsPath = resolve(root, tokensPath);
  const cssAbsPath = resolve(root, cssPath);

  const tokensSrc = readFileSync(tokensAbsPath, "utf8");
  const css = readFileSync(cssAbsPath, "utf8");

  const tiers = parseTiers(tokensSrc, tokensPath);
  const block = buildBlock(tiers, { tokensPath, cssPath, themeWrapper });
  const nextCss = replaceBlock(css, block, BEGIN_MARKER, END_MARKER, cssPath);

  let mdAbsPath;
  let mdSrc;
  let nextMd;
  if (mdTablePath !== undefined) {
    mdAbsPath = resolve(root, mdTablePath);
    mdSrc = readFileSync(mdAbsPath, "utf8");
    const mdBlock = buildMdTable(tiers, { tokensPath });
    nextMd = replaceBlock(
      mdSrc,
      mdBlock,
      MD_TABLE_BEGIN_MARKER,
      MD_TABLE_END_MARKER,
      mdTablePath,
      { excludeFencedCode: true },
    );
  }

  if (args.check) {
    let drift = false;
    if (nextCss !== css) {
      console.error(`z-index codegen drift detected: ${cssPath} is out of date.`);
      drift = true;
    }
    if (mdTablePath !== undefined && nextMd !== mdSrc) {
      console.error(`z-index codegen drift detected: ${mdTablePath} is out of date.`);
      drift = true;
    }
    if (drift) {
      console.error(
        `Run \`${buildRerunCommand({ tokensPath, cssPath, themeWrapper, mdTablePath })}\` and commit the result.`,
      );
      return 1;
    }
    console.log(
      mdTablePath !== undefined
        ? `OK — z-index @theme block and md table are up to date (${tiers.length} tiers).`
        : `OK — z-index @theme block is up to date (${tiers.length} tiers).`,
    );
    return 0;
  }

  if (nextCss === css) {
    console.log(
      `z-index @theme block already up to date (${tiers.length} tiers); no change.`,
    );
  } else {
    writeFileSync(cssAbsPath, nextCss);
    console.log(`Wrote z-index @theme block to ${cssPath} (${tiers.length} tiers).`);
  }

  if (mdTablePath !== undefined) {
    if (nextMd === mdSrc) {
      console.log(`z-index table already up to date at ${mdTablePath}; no change.`);
    } else {
      writeFileSync(mdAbsPath, nextMd);
      console.log(`Wrote z-index table to ${mdTablePath} (${tiers.length} tiers).`);
    }
  }

  return 0;
}

// Run the CLI only when executed directly, NOT when imported by tests (an
// import must not write global.css or exit the process as a side effect — it
// would break `pnpm test`). Compare REAL paths on both sides: when invoked
// through the pnpm bin shim, argv[1] is the `node_modules/.bin/…` symlink,
// NOT the real file, so a raw path-equality check is always false and
// main() would silently no-op. realpathSync resolves the shim/symlink to the
// real file on both sides so direct invocation is detected however the bin
// is launched.
function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
    );
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  process.exit(main());
}
