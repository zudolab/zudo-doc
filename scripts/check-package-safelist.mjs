#!/usr/bin/env node
// scripts/check-package-safelist.mjs
//
// Guard check: ensures the generated dist/safelist.css in
// packages/zudo-doc/ covers every responsive-variant + arbitrary-value
// utility class found in packages/zudo-doc/src/**/*.tsx (excluding __tests__).
//
// Background (#1971, #1982, #1993, #1994): consumers scaffolded via
// create-zudo-doc previously relied on a hand-maintained @source inline()
// in the template global.css — prone to silent drift when new bracket or
// responsive utilities were added to the package. The template now imports
// the package-generated dist/safelist.css instead (zudolab/zudo-doc#1994).
// This guard validates the generated artifact: if gen-safelist.mjs (#1993)
// misses a utility from src/**/*.tsx, this check catches it before it lands.
//
// Usage: node scripts/check-package-safelist.mjs
// Exit 0 = generated safelist covers all source utilities. Exit 1 = drift detected.
//
// Requires packages/zudo-doc/dist/safelist.css to exist.
// Run `pnpm --filter @takazudo/zudo-doc build` first if missing.
//
// Wired into:
//   - scripts/run-b4push.sh (after package build step — step 10)
//   - .github/workflows/pr-checks.yml (after pnpm install + package build)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_SRC_DIR = resolve(ROOT, "packages/zudo-doc/src");
const GENERATED_SAFELIST_CSS = resolve(
  ROOT,
  "packages/zudo-doc/dist/safelist.css",
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
 * Parse the @source inline("…") block from the generated dist/safelist.css.
 * Returns a Set of all whitespace-delimited tokens in the inline block.
 */
function parseSafelist(cssSrc) {
  const match = cssSrc.match(/@source\s+inline\s*\(\s*"([\s\S]*?)"\s*\)/);
  if (!match) {
    throw new Error(
      'Could not locate @source inline("…") in generated safelist.\n' +
        "Expected a single @source inline() block in:\n" +
        GENERATED_SAFELIST_CSS,
    );
  }
  return new Set(match[1].trim().split(/\s+/).filter(Boolean));
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  // Require the generated artifact to exist — it is produced by the package build.
  if (!existsSync(GENERATED_SAFELIST_CSS)) {
    console.error("");
    console.error(
      "ERROR: packages/zudo-doc/dist/safelist.css does not exist.",
    );
    console.error(
      "Run `pnpm --filter @takazudo/zudo-doc build` first to generate it.",
    );
    console.error("");
    return 1;
  }

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

  // Parse generated safelist
  const generatedCss = readFileSync(GENERATED_SAFELIST_CSS, "utf8");
  const safelist = parseSafelist(generatedCss);

  // Direction: source → generated safelist (critical — missing = drift that hurts consumers)
  const missingFromSafelist = [...sourceClasses]
    .filter((c) => !safelist.has(c))
    .sort();

  if (missingFromSafelist.length === 0) {
    console.log(
      `OK — package safelist check passed. ${sourceClasses.size} source utilities all present in generated dist/safelist.css.`,
    );
    return 0;
  }

  console.error("");
  console.error(
    "Package safelist check FAILED — the following utilities exist in",
  );
  console.error(
    `packages/zudo-doc/src/**/*.tsx but are MISSING from the generated\n` +
      `@source inline() in packages/zudo-doc/dist/safelist.css:`,
  );
  console.error("");
  for (const c of missingFromSafelist) {
    console.error(`  ${c}`);
  }
  console.error("");
  console.error(
    "Remediation — the generator (scripts/gen-safelist.mjs in packages/zudo-doc/)\n" +
      "did not capture these utilities. Fix the extraction logic in gen-safelist.mjs,\n" +
      "then rebuild: `pnpm --filter @takazudo/zudo-doc build`",
  );
  console.error("");
  console.error(
    "Re-run `pnpm check:package-safelist` after rebuilding to verify.",
  );
  return 1;
}

process.exit(main());
