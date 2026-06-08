#!/usr/bin/env node
// scripts/gen-safelist.mjs
//
// Scans dist/**/*.js after tsup compiles the package and writes
// dist/safelist.css with a single @source inline("…") directive
// containing every Tailwind candidate token found in the compiled JS.
//
// Run after tsup (tsup `onSuccess` hook, and chained in build/prepare).
// Must run AFTER tsup because `clean: true` wipes dist/ before compiling.
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

const JUNK_RE = /['"` \t\n\r<>]/;

/** Return true when a token is safe for the quoted @source inline("…") */
function isValidToken(token) {
  // Must not contain anything that would break the surrounding double-quote
  // or introduce a parse/security hazard. Parens, commas, underscores, #, %
  // must SURVIVE (bracket utilities like shadow-[0_1px…] and bg-[#fff]).
  return token.length > 0 && !JUNK_RE.test(token);
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

main();
