#!/usr/bin/env node
// scripts/gen-safelist.mjs
//
// Scans dist/**/*.js after tsup compiles the package and writes
// dist/safelist.css with a single @source inline("…") directive
// containing every Tailwind candidate token found in the compiled JS.
//
// Run after tsup (tsup `onSuccess` hook, and chained in build/prepare).
// Must run AFTER tsup because a one-shot build's clean wipes dist/ before
// compiling (`clean: !options.watch` — a watch build does not clean).
//
// Why dist/ rather than src/:
//   Consumers of the npm package have dist/ via node_modules; they do NOT
//   have src/. The safelist must therefore be derived from dist so that
//   consumer-side @source directives point at the correct published files.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, "../dist");
const OUT_FILE = resolve(DIST_DIR, "safelist.css");

// ── File discovery ─────────────────────────────────────────────────────────

/** Recursively collect .js files under dir. */
function findJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsFiles(full));
    } else if (entry.name.endsWith(".js")) {
      results.push(full);
    }
  }
  return results;
}

// ── Token extraction ───────────────────────────────────────────────────────
//
// Strategy: a single stateful left-to-right character scan that correctly
// tracks:
//   - double-quoted strings  "..."
//   - single-quoted strings  '...'
//   - template literals      `...${  nested  }...`
//     - quasis (the static text portions between ${...})
//     - interpolations ${...} — re-enter normal scanning, tracking brace depth
//       so nested string literals inside ${...} are also captured
//   - regex literals /pattern/flags  (contain "/' chars that are NOT strings)
//   - line comments   // ...
//   - block comments  /* ... */
//
// Regex detection: after operator/punctuation chars a `/` starts a regex,
// not division. We track the last non-whitespace char to decide which one.
// This is a heuristic for non-minified code (which tsup with bundle:false
// produces), sufficient to avoid false string-start misidentification on
// patterns like .replace(/"/g, '\\"').
//
// The scanner emits the raw text content of every string literal / quasi.
// Tokenisation into whitespace-separated Tailwind candidates happens after.

// Class-shape filter. The dist JS contains far more than Tailwind class
// strings — JS code fragments, HTML entities, hex colors, regex bits all live
// inside string literals. We must keep ONLY real Tailwind class candidates,
// because Tailwind v4's @source inline() parses each token as a class
// candidate and ABORTS on malformed ones (e.g. `catch(e){` →
// "Error: The pattern `catch(e){` is not balanced.").
//
// Per token, in order:
//   1. Mask balanced [...] arbitrary-value regions to a placeholder. Arbitrary
//      values legitimately contain # ( ) , % . _ so they must be exempt from
//      the char check below. Unbalanced [ or ] after masking ⇒ reject.
//   2. On the masked token, the char set outside brackets is restricted to
//      [a-zA-Z0-9:_/!.%-] plus the placeholder — this kills ( ) { } < > # & $
//      ; = ^ backtick quotes that appear OUTSIDE brackets (the JS/HTML junk).
//   3. The masked token must match the anchored Tailwind class shape:
//      variant prefixes, optional ! and -, a letter-led utility root (or a
//      lone arbitrary placeholder), optional -<placeholder> arbitrary value,
//      optional /modifier.
//   4. Require at least one ASCII letter (drops all-digit / all-punct tokens).

const PLACEHOLDER = "\x00";

// One masked variant prefix: `name:` where name is class-ident or a masked
// arbitrary variant (e.g. `[&_nav]:` → `<placeholder>:`).
const VARIANT = `(?:(?:[a-zA-Z0-9_-]+|${PLACEHOLDER})[:])`;
// Utility root: a letter-led identifier, OR a lone placeholder (pure-arbitrary
// token like `[&_a]:underline`'s value, or `[mask-type:luminance]`).
const ROOT = `(?:[a-zA-Z][a-zA-Z0-9-]*|${PLACEHOLDER})`;
// Optional arbitrary-value suffix and optional opacity/modifier.
const ARBITRARY_SUFFIX = `(?:-${PLACEHOLDER})?`;
const MODIFIER = `(?:/[a-zA-Z0-9.%-]+)?`;
const CLASS_SHAPE = new RegExp(
  `^${VARIANT}*!?-?${ROOT}${ARBITRARY_SUFFIX}${MODIFIER}$`,
);

// After masking brackets, only these chars (plus the placeholder) may remain.
// Lowercase-only outside brackets: real Tailwind utilities / variants / modifiers
// are never uppercase, so an uppercase letter outside a [...] arbitrary value marks
// the token as captured prose or a JS/Preact identifier (Activate, Breadcrumb,
// ColorSchemeProvider, B7B7B7, !moreContainer). Uppercase inside an arbitrary value
// (e.g. bg-[#FFF]) is fine — those regions are masked before this check.
const MASKED_CHARSET = new RegExp(`^[a-z0-9:_/!.%${PLACEHOLDER}-]*$`);

/** Replace each balanced [...] region with a single placeholder char. */
function maskBrackets(token) {
  return token.replace(/\[[^\]]*\]/g, PLACEHOLDER);
}

/**
 * Return true when a token is a plausible Tailwind class candidate that is
 * safe to emit into @source inline("…").
 */
function isValidToken(token) {
  if (token.length === 0) return false;
  // Quotes / backticks / angle braces can never be class chars and would
  // break the quoted @source string — reject up front.
  if (/['"`<>]/.test(token)) return false;

  const masked = maskBrackets(token);
  // Any leftover bracket means the [...] was unbalanced.
  if (masked.includes("[") || masked.includes("]")) return false;
  // Outside-bracket char set: kills ( ) { } # & $ ; = ^ etc.
  if (!MASKED_CHARSET.test(masked)) return false;
  // Anchored Tailwind class shape.
  if (!CLASS_SHAPE.test(masked)) return false;
  // Must contain at least one ASCII letter somewhere in the ORIGINAL token
  // (the masked form hides letters inside brackets, so check the original).
  if (!/[a-zA-Z]/.test(token)) return false;
  return true;
}

/**
 * Tokenise a raw string/quasi content blob into whitespace-split tokens
 * and push valid ones into `out`.
 */
function collectTokens(blob, out) {
  for (const tok of blob.split(/\s+/)) {
    if (isValidToken(tok)) out.add(tok);
  }
}

// Characters after which a `/` begins a regex literal (not division).
// In non-minified ESM: operators, punctuation, and no preceding id/number/)/].
// This set is the standard ECMAScript heuristic used by many JS tools.
const REGEX_PRECURSOR = new Set([
  "=",
  "(",
  "[",
  "!",
  "&",
  "|",
  "?",
  ":",
  ",",
  ";",
  "{",
  "}",
  "+",
  "-",
  "*",
  "%",
  "^",
  "~",
  "<",
  ">",
  "\n",
  "\r",
  // no prev char (start of file) is represented by a sentinel
]);

/**
 * Scan one JS source file and populate `out` with every string-literal
 * and template-quasi token found.
 *
 * @param {string} src  raw JS source text
 * @param {Set<string>} out  accumulator
 */
export function extractTokens(src, out = new Set()) {
  // Lexer states
  const NORMAL = 0;
  const IN_DOUBLE = 1; // inside "..."
  const IN_SINGLE = 2; // inside '...'
  const IN_TEMPLATE = 3; // inside `...` quasi

  // For template literals we can be nested (a template containing ${...}
  // which contains another template). Track with a stack.
  // Each stack entry: { brace: 0 } — brace depth within ${...}
  const templateStack = [];

  let mode = NORMAL;
  let buf = ""; // accumulates current string / quasi content
  let i = 0;
  const len = src.length;
  // Track last non-whitespace char for regex-vs-division detection.
  // Initialise to "\n" so a `/` at start-of-file is treated as regex.
  let prevNonWs = "\n";

  while (i < len) {
    const ch = src[i];

    if (mode === NORMAL) {
      if (ch === '"') {
        mode = IN_DOUBLE;
        buf = "";
        prevNonWs = ch;
        i++;
      } else if (ch === "'") {
        mode = IN_SINGLE;
        buf = "";
        prevNonWs = ch;
        i++;
      } else if (ch === "`") {
        mode = IN_TEMPLATE;
        buf = "";
        templateStack.push({ brace: 0 });
        prevNonWs = ch;
        i++;
      } else if (ch === "/" && i + 1 < len) {
        const next = src[i + 1];
        if (next === "/") {
          // Line comment — skip to EOL
          i += 2;
          while (i < len && src[i] !== "\n") i++;
        } else if (next === "*") {
          // Block comment — skip to */
          i += 2;
          while (i < len && !(src[i] === "*" && src[i + 1] === "/")) i++;
          i += 2;
        } else if (REGEX_PRECURSOR.has(prevNonWs)) {
          // Regex literal — skip to matching unescaped /
          // Include character classes [...] which may contain /
          i++; // skip opening /
          while (i < len) {
            const rc = src[i];
            if (rc === "\\") {
              i += 2; // skip escape
            } else if (rc === "[") {
              // character class — skip to ]
              i++;
              while (i < len && src[i] !== "]") {
                if (src[i] === "\\") i += 2;
                else i++;
              }
              if (i < len) i++; // skip ]
            } else if (rc === "/") {
              i++; // skip closing /
              // skip flags
              while (i < len && /[gimsuy]/.test(src[i])) i++;
              break;
            } else {
              i++;
            }
          }
          // prevNonWs after a regex literal is effectively ")" (ends expression)
          prevNonWs = ")";
        } else {
          // Division operator — skip
          prevNonWs = "/";
          i++;
        }
      } else if (templateStack.length > 0 && ch === "}") {
        // Closing brace of a ${...} interpolation — resume template quasi
        const top = templateStack[templateStack.length - 1];
        if (top.brace > 0) {
          top.brace--;
          prevNonWs = ch;
          i++;
        } else {
          // Matched the ${ — back to template quasi
          mode = IN_TEMPLATE;
          buf = "";
          prevNonWs = ch;
          i++;
        }
      } else if (templateStack.length > 0 && ch === "{") {
        templateStack[templateStack.length - 1].brace++;
        prevNonWs = ch;
        i++;
      } else {
        // Update prevNonWs for non-whitespace chars
        if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") {
          prevNonWs = ch;
        }
        i++;
      }
    } else if (mode === IN_DOUBLE) {
      if (ch === "\\") {
        // skip escaped char
        i += 2;
      } else if (ch === '"') {
        collectTokens(buf, out);
        mode = NORMAL;
        prevNonWs = ch;
        i++;
      } else {
        buf += ch;
        i++;
      }
    } else if (mode === IN_SINGLE) {
      if (ch === "\\") {
        i += 2;
      } else if (ch === "'") {
        collectTokens(buf, out);
        mode = NORMAL;
        prevNonWs = ch;
        i++;
      } else {
        buf += ch;
        i++;
      }
    } else if (mode === IN_TEMPLATE) {
      if (ch === "\\") {
        i += 2;
      } else if (ch === "`") {
        // End of template literal
        collectTokens(buf, out);
        templateStack.pop();
        mode = NORMAL;
        prevNonWs = ch;
        i++;
      } else if (ch === "$" && src[i + 1] === "{") {
        // Start of interpolation — emit what we have so far, enter NORMAL
        collectTokens(buf, out);
        buf = "";
        mode = NORMAL;
        // The current top entry tracks braces within this interpolation
        templateStack[templateStack.length - 1].brace = 0;
        // prevNonWs inside interpolation starts fresh from { context
        prevNonWs = "{";
        i += 2; // skip ${
      } else {
        buf += ch;
        i++;
      }
    }
  }

  // If a string is unterminated (shouldn't happen in valid compiled JS,
  // but guard anyway), still collect whatever we accumulated.
  if (buf.length > 0 && mode !== NORMAL) collectTokens(buf, out);

  return out;
}

// ── CSS emission ───────────────────────────────────────────────────────────

/**
 * Build the @source inline("…") directive string from a set of tokens.
 * Tokens are sorted for reproducible output.
 *
 * @param {Set<string>} tokens
 * @returns {string}  complete CSS file content
 */
export function emitSafelist(tokens) {
  const sorted = [...tokens].sort();
  const inline = sorted.join(" ");
  return `/* generated by gen-safelist.mjs — do not edit by hand */\n@source inline("${inline}");\n`;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  const files = findJsFiles(DIST_DIR);
  if (files.length === 0) {
    process.stderr.write(`gen-safelist: no .js files found in ${DIST_DIR}\n`);
    process.exit(1);
  }

  const tokens = new Set();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    extractTokens(src, tokens);
  }

  const css = emitSafelist(tokens);
  writeFileSync(OUT_FILE, css, "utf8");
  process.stdout.write(
    `gen-safelist: wrote ${tokens.size} tokens → dist/safelist.css\n`,
  );
}

// Run the CLI only when executed directly (node scripts/gen-safelist.mjs), NOT
// when imported. The unit test imports this module for extractTokens/emitSafelist;
// without this guard the import would scan + rewrite dist/safelist.css as a side
// effect and process.exit(1) on a dist-less checkout, breaking `pnpm test`.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
