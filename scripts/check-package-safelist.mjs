#!/usr/bin/env node
// scripts/check-package-safelist.mjs
//
// Guard check: ensures the @source inline() safelist in
// packages/create-zudo-doc/templates/base/src/styles/global.css
// covers every responsive-variant + arbitrary-value utility class
// found in packages/zudo-doc/src/**/*.tsx (excluding __tests__).
//
// Background (#1971, #1982): consumers scaffolded via create-zudo-doc
// lack the monorepo's src/styles/global.css @source for
// packages/zudo-doc/src/**. The template global.css compensates via
// an @source inline() safelist. This check closes the silent-drift gap
// where a new bracket or responsive utility added to the package would
// never reach consumers (the scan passes at build time in the host repo
// because its own @source covers the package source directly, masking
// the consumer-side gap).
//
// Usage: node scripts/check-package-safelist.mjs
// Exit 0 = safelist covers all source utilities. Exit 1 = drift detected.
//
// Wired into:
//   - scripts/run-b4push.sh (guard step — inside marker region)
//   - .github/workflows/pr-checks.yml (pure-Node CI job)

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_SRC_DIR = resolve(ROOT, "packages/zudo-doc/src");
const TEMPLATE_CSS = resolve(
  ROOT,
  "packages/create-zudo-doc/templates/base/src/styles/global.css",
);

// ── File discovery ─────────────────────────────────────────────────────────

/** Recursively collect .tsx files, skipping __tests__ directories. */
function findTsxFiles(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      results.push(...findTsxFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith(".tsx")) {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

// ── Class extraction ───────────────────────────────────────────────────────
//
// Strategy: direct token scan over raw source text, using a regex that
// matches the TARGET class shapes only:
//
//   A) Responsive variants — start with sm:|md:|lg:|xl:|2xl:
//      (may have an arbitrary-value suffix)
//
//   B) Bracket utilities — match pattern: property-name-[value]
//      where "-[" is the canonical Tailwind arbitrary-value separator.
//      The value must not contain quotes or whitespace (filters out TS
//      type expressions like IntrinsicElements["a"] and pairs[i]).
//
// This direct approach avoids the fragility of string-literal parsing:
//   - No risk of apostrophes in JSDoc comments being mis-parsed as
//     single-quoted string starts (a real issue in this codebase).
//   - No risk of nested template literals consuming inner double-quoted
//     strings (e.g. `...${condition ? "max-w-[80rem]" : "..."}...`).
//   - No need to enumerate known Tailwind property names — the shape
//     criterion (property-name-[...]) is self-contained.
//
// The leading-character anchor (whitespace, quote, brace, comma, etc.)
// ensures we start at a class-token boundary and do not capture tokens
// mid-way (e.g., grabbing "lg" from inside a longer identifier).

// Matches a complete responsive-or-bracket utility class token, preceded
// by a token boundary (beginning of line, whitespace, or JSX structural
// characters). Group 1 is the full class token.
const TARGET_RE =
  /(?:^|[\s"'`{,;(])((?:(?:sm|md|lg|xl|2xl):)[a-zA-Z0-9_/[\](),.*%:#-]+|(?:(?:hover:|focus(?:-visible|-within)?:)?)[a-zA-Z][a-zA-Z0-9_/-]*-\[[^\]"'`\s]+\])/g;

/** True when a captured token contains no HTML/JSX structural characters. */
function isValidToken(token) {
  return !/[><"'`]/.test(token);
}

/**
 * Scan a source file and return the set of Tailwind utility classes that
 * match the responsive-variant or arbitrary-value shapes.
 */
function extractClasses(src) {
  const classes = new Set();
  TARGET_RE.lastIndex = 0;
  let m;
  while ((m = TARGET_RE.exec(src)) !== null) {
    const cls = m[1];
    if (cls && isValidToken(cls)) {
      classes.add(cls);
    }
  }
  return classes;
}

// ── Safelist parser ────────────────────────────────────────────────────────

/**
 * Parse the @source inline("…") block from the template global.css.
 * Returns a Set of class tokens.
 */
function parseSafelist(cssSrc) {
  const match = cssSrc.match(/@source\s+inline\s*\(\s*"([\s\S]*?)"\s*\)/);
  if (!match) {
    throw new Error(
      'Could not locate @source inline("…") in template global.css.\n' +
        "Expected a single @source inline() block in:\n" +
        TEMPLATE_CSS,
    );
  }
  return new Set(match[1].trim().split(/\s+/).filter(Boolean));
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  const files = findTsxFiles(PKG_SRC_DIR);
  if (files.length === 0) {
    console.error(`ERROR: no .tsx files found under ${PKG_SRC_DIR}`);
    return 1;
  }

  // Collect all target classes from source files
  const sourceClasses = new Set();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const cls of extractClasses(src)) {
      sourceClasses.add(cls);
    }
  }

  // Parse safelist
  const templateCss = readFileSync(TEMPLATE_CSS, "utf8");
  const safelist = parseSafelist(templateCss);

  // Direction: source → safelist (critical — missing = drift that hurts consumers)
  const missingFromSafelist = [...sourceClasses]
    .filter((c) => !safelist.has(c))
    .sort();

  // Direction: safelist → source (informational only — warn but don't fail.
  // Safelist entries not found in source are safe to keep: the dist/ @source
  // directive also scans compiled JS and may cover classes the source scanner
  // misses in complex template expressions.)
  const notInSource = [...safelist].filter((c) => !sourceClasses.has(c)).sort();

  if (missingFromSafelist.length === 0) {
    console.log(
      `OK — package safelist check passed. ${sourceClasses.size} source utilities all present in safelist.`,
    );
    if (notInSource.length > 0) {
      console.log(
        `\nNote: ${notInSource.length} safelist entr${notInSource.length === 1 ? "y" : "ies"} not found in source scan (covered by dist/ @source — safe to keep):`,
      );
      for (const c of notInSource) {
        console.log(`  ${c}`);
      }
    }
    return 0;
  }

  console.error("");
  console.error(
    "Package safelist check FAILED — the following utilities exist in",
  );
  console.error(
    `packages/zudo-doc/src/**/*.tsx but are MISSING from the @source inline()\n` +
      `safelist in packages/create-zudo-doc/templates/base/src/styles/global.css:`,
  );
  console.error("");
  for (const c of missingFromSafelist) {
    console.error(`  ${c}`);
  }
  console.error("");
  console.error(
    "Remediation — add the missing entries to the @source inline() block:",
  );
  console.error(
    `  File: packages/create-zudo-doc/templates/base/src/styles/global.css`,
  );
  console.error(
    `  Locate the @source inline("…") block and append the following tokens:`,
  );
  console.error("");
  console.error("  " + missingFromSafelist.join(" "));
  console.error("");
  console.error(
    "Re-run `pnpm check:package-safelist` after updating to verify.",
  );
  return 1;
}

process.exit(main());
