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
//
// MUST be run with the project root as cwd — it resolves --tokens/--css (or
// their conventional defaults) against process.cwd(), NOT against this file's
// location. A consuming project's own package.json scripts (e.g.
// gen:z-index / check:z-index) are responsible for invoking it from the
// project root. This generator is opt-in per project — a project only needs
// it when overriding one of the default tiers shipped unconditionally by
// @takazudo/zudo-doc/theme.css — and it is not wired into this repo's own
// b4push or CI; that integration was retired in zudolab/zudo-doc#2661.
//
// The block is a Tailwind v4 `@theme { --z-index-<name>: <value>; }` for every
// tier, so Tailwind generates `z-<name>` utilities and raw CSS can reference
// `z-index: var(--z-index-<name>)`. `--no-theme-wrapper` drops the `@theme`
// wrapper and emits bare `--z-index-<name>: <value>;` declarations instead,
// for projects that want to compose the block into their own `@theme` block.
//
// Pure Node (fs only — NO npm deps, no minimist). Idempotent: running twice
// produces no diff.
//
// MAINTENANCE: edit src/config/z-index-tokens.ts (the source of truth), then
// run `pnpm gen:z-index` (or the equivalent --tokens/--css invocation) and
// commit the regenerated CSS. Never hand-edit the block between the
// BEGIN/END markers.

import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BEGIN_MARKER = "GENERATED:Z_INDEX_BEGIN";
const END_MARKER = "GENERATED:Z_INDEX_END";

// Conventional paths, relative to the project root (process.cwd()). Used as
// the default --tokens/--css values AND as the literal text shown in the
// generated header / log messages when no override is given — this is what
// keeps the default invocation's output byte-identical to pre-flag output.
const DEFAULT_TOKENS_PATH = "src/config/z-index-tokens.ts";
const DEFAULT_CSS_PATH = "src/styles/global.css";

const TIER_NAME_RE = /^[a-z0-9-]+$/;

const FLAG_USAGE =
  "Supported flags: --check, --tokens <path>, --css <path>, --no-theme-wrapper.";

/**
 * Hand-rolled argv parser (no minimist — this bin stays dependency-free).
 * Supports `--flag value` and `--flag=value` for value flags. Unknown flags,
 * repeated flags, a missing value for a value flag, and a value attached to a
 * boolean flag (`--no-theme-wrapper=x`) are all hard errors — this bin does
 * not silently ignore or guess at malformed invocations.
 *
 * Returns `{ check, tokens, css, noThemeWrapper }`; `tokens`/`css` are
 * `undefined` when not passed (callers apply the conventional defaults).
 *
 * Exported for unit testing.
 */
export function parseArgs(argv) {
  const result = {
    check: false,
    tokens: undefined,
    css: undefined,
    noThemeWrapper: false,
  };
  const seen = new Set();

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const eqIdx = raw.startsWith("--") ? raw.indexOf("=") : -1;
    const flag = eqIdx === -1 ? raw : raw.slice(0, eqIdx);
    const inlineValue = eqIdx === -1 ? undefined : raw.slice(eqIdx + 1);

    const isBoolean = flag === "--check" || flag === "--no-theme-wrapper";
    const isValueFlag = flag === "--tokens" || flag === "--css";

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

    // Value flag (--tokens / --css): accept an inline `=value`, otherwise
    // consume the next argv token. A missing/empty value or a next token
    // that looks like another flag is a hard error, not a silent default.
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
 */
function buildRerunCommand({ tokensPath, cssPath, themeWrapper }) {
  const isDefault =
    tokensPath === DEFAULT_TOKENS_PATH &&
    cssPath === DEFAULT_CSS_PATH &&
    themeWrapper === true;
  if (isDefault) return "pnpm gen:z-index";

  const parts = ["pnpm exec gen-z-index"];
  if (tokensPath !== DEFAULT_TOKENS_PATH) parts.push(`--tokens ${shellQuote(tokensPath)}`);
  if (cssPath !== DEFAULT_CSS_PATH) parts.push(`--css ${shellQuote(cssPath)}`);
  if (!themeWrapper) parts.push("--no-theme-wrapper");
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

/** Counts non-overlapping occurrences of `marker` in `str`. */
function countOccurrences(str, marker) {
  let count = 0;
  let idx = str.indexOf(marker);
  while (idx !== -1) {
    count++;
    idx = str.indexOf(marker, idx + marker.length);
  }
  return count;
}

/**
 * Replace the existing BEGIN…END block in `css` with `block`. Requires
 * EXACTLY one BEGIN and one END marker, with BEGIN preceding END — throws a
 * clear, distinct error for each failure mode: missing (the block must be
 * seeded once by hand), duplicated, or inverted markers. `cssPath` is used
 * purely for error-message context (pass the conventional default or an
 * explicit --css value).
 *
 * Exported for unit testing.
 */
export function replaceBlock(css, block, cssPath = DEFAULT_CSS_PATH) {
  const beginCount = countOccurrences(css, BEGIN_MARKER);
  const endCount = countOccurrences(css, END_MARKER);

  if (beginCount === 0 || endCount === 0) {
    throw new Error(
      `Could not find ${BEGIN_MARKER} … ${END_MARKER} markers in ${cssPath}.\n` +
        `Seed the marker block once by hand, then re-run the generator.`,
    );
  }
  if (beginCount > 1 || endCount > 1) {
    throw new Error(
      `Found duplicate GENERATED:Z_INDEX markers in ${cssPath} (${beginCount} BEGIN, ` +
        `${endCount} END; expected exactly one of each). Remove the extra marker(s) by ` +
        `hand, then re-run the generator.`,
    );
  }

  const beginIdx = css.indexOf(BEGIN_MARKER);
  const endIdx = css.indexOf(END_MARKER);
  if (beginIdx > endIdx) {
    throw new Error(
      `GENERATED:Z_INDEX markers in ${cssPath} are inverted — the END marker appears ` +
        `before the BEGIN marker. Fix the marker order by hand, then re-run the generator.`,
    );
  }

  // Expand to the full comment line that opens the block ("  /* GENERATED:...")
  // and to the end of the closing "*/ " line so the whole region is replaced.
  const lineStart = css.lastIndexOf("\n", beginIdx) + 1;
  const afterEnd = css.indexOf("\n", endIdx);
  const lineEnd = afterEnd === -1 ? css.length : afterEnd;
  return css.slice(0, lineStart) + block + css.slice(lineEnd);
}

/**
 * CLI entrypoint. `argv` defaults to the real process argv (minus the node/
 * script prefix) so `isDirectInvocation()` below can call `main()` with no
 * arguments, while tests can pass a synthetic argv without touching
 * `process.argv`. Resolves --tokens/--css against `process.cwd()` (the
 * project root) for actual file I/O, but threads the AS-GIVEN path strings
 * (conventional defaults or explicit flag values) through to every message
 * and into the generated header — never the resolved absolute path — so the
 * committed CSS never embeds a machine-specific path.
 *
 * Exported for unit testing.
 */
export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const tokensPath = args.tokens ?? DEFAULT_TOKENS_PATH;
  const cssPath = args.css ?? DEFAULT_CSS_PATH;
  const themeWrapper = !args.noThemeWrapper;

  const root = process.cwd();
  const tokensAbsPath = resolve(root, tokensPath);
  const cssAbsPath = resolve(root, cssPath);

  const tokensSrc = readFileSync(tokensAbsPath, "utf8");
  const css = readFileSync(cssAbsPath, "utf8");

  const tiers = parseTiers(tokensSrc, tokensPath);
  const block = buildBlock(tiers, { tokensPath, cssPath, themeWrapper });
  const next = replaceBlock(css, block, cssPath);

  if (args.check) {
    if (next !== css) {
      console.error(`z-index codegen drift detected: ${cssPath} is out of date.`);
      console.error(
        `Run \`${buildRerunCommand({ tokensPath, cssPath, themeWrapper })}\` and commit the result.`,
      );
      return 1;
    }
    console.log(`OK — z-index @theme block is up to date (${tiers.length} tiers).`);
    return 0;
  }

  if (next === css) {
    console.log(
      `z-index @theme block already up to date (${tiers.length} tiers); no change.`,
    );
    return 0;
  }
  writeFileSync(cssAbsPath, next);
  console.log(`Wrote z-index @theme block to ${cssPath} (${tiers.length} tiers).`);
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
