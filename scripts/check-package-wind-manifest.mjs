#!/usr/bin/env node
// scripts/check-package-wind-manifest.mjs
//
// Guard check: ensures the generated dist/wind.json in
// packages/zudo-doc/ covers every responsive-variant + arbitrary-value
// utility class found in packages/zudo-doc/src/**/*.tsx (excluding __tests__).
//
// Background (#1971, #1982, #1993, #1994): consumers scaffolded via
// create-zudo-doc previously relied on a hand-maintained @source inline()
// in the template global.css — prone to silent drift when new bracket or
// responsive utilities were added to the package. The v3 package now publishes
// a strict wind manifest consumed by its preset (zudolab/zudo-doc#4440).
// This guard validates the generated artifact: if gen-wind-manifest.mjs (#1993)
// misses a utility from src/**/*.tsx, this check catches it before it lands.
//
// Escape hatch (#3204, #3211): extraction scans raw source text (see the
// "Class extraction" section below), so a class name written in PROSE —
// e.g. a comment contrasting one Tailwind class with another — is
// indistinguishable from a live class attribute and gets demanded of the
// generated manifest even though nothing emits it. A line carrying a
// trailing `// safelist-ok: <reason>` marker is excluded from extraction,
// modeled on scripts/check-wait-debt.mjs's `// wait-ok:` convention. This is
// the ONLY line-aware step — general comment-stripping was considered and
// explicitly rejected as an alternative (it would blind the guard to real
// class usage sitting inside a commented-out block). See the TOC wrapper
// comment in packages/zudo-doc/src/doc-page-shell/index.tsx for a live
// example.
//
// Usage: node scripts/check-package-wind-manifest.mjs
// Exit 0 = generated manifest covers all source utilities. Exit 1 = drift detected.
//
// Requires packages/zudo-doc/dist/wind.json to exist.
// Run `pnpm --filter @takazudo/zudo-doc build` first if missing.
//
// Wired into:
//   - scripts/run-b4push.sh (after the package-build step)
//   - .github/workflows/pr-checks.yml (after pnpm install + package build)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PKG_SRC_DIR = resolve(ROOT, "packages/zudo-doc/src");
const GENERATED_WIND_JSON = resolve(
  ROOT,
  "packages/zudo-doc/dist/wind.json",
);

// The marker itself — deliberately a plain substring (not a regex group) so
// it stays trivially greppable from the shell:
// `grep -rn "safelist-ok:" packages/zudo-doc/src`. Mirrors
// scripts/check-wait-debt.mjs's `WAIT_OK_MARKER` convention: no reason-text
// validation, just presence of the substring on the same line.
const SAFELIST_OK_MARKER = "safelist-ok:";

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
//
// The ONE exception to "raw text, no comment-awareness" is the
// `safelist-ok:` marker (see above): a line containing that plain
// substring is blanked out before the regex runs, so tokens on that line
// are never captured as candidates. Comment lines WITHOUT the marker are
// still scanned exactly like any other line — general comment-stripping
// remains out of scope by design.

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
 * Blank out every line containing the `safelist-ok:` marker before class
 * extraction runs. This is the only line-aware step in extraction — see
 * the "Class extraction" section comment above for why a marker-exempt
 * line is the right scope (not the whole file, not general comments).
 */
function stripMarkedLines(src) {
  return src
    .split("\n")
    .map((line) => (line.includes(SAFELIST_OK_MARKER) ? "" : line))
    .join("\n");
}

/**
 * Scan a source file and return the set of Tailwind utility classes that
 * match the responsive-variant or arbitrary-value shapes. Lines carrying a
 * `// safelist-ok: <reason>` marker are excluded from the scan.
 */
export function extractClasses(src) {
  const classes = new Set();
  const scanTarget = stripMarkedLines(src);
  TARGET_RE.lastIndex = 0;
  let m;
  while ((m = TARGET_RE.exec(scanTarget)) !== null) {
    const cls = m[1];
    if (cls && isValidToken(cls)) {
      classes.add(cls);
    }
  }
  return classes;
}

// ── Manifest parser ────────────────────────────────────────────────────────

/**
 * Parse the generated dist/wind.json.
 * Returns the strict candidate set.
 */
export function parseWindManifest(jsonSrc) {
  const manifest = JSON.parse(jsonSrc);
  if (manifest.schemaVersion !== 1 || manifest.specVersion !== 1 || manifest.producer !== "zudo-doc" || !Array.isArray(manifest.candidates)) {
    throw new Error("Expected a zudo-doc v1 candidate manifest");
  }
  return new Set(manifest.candidates);
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  // Require the generated artifact to exist — it is produced by the package build.
  if (!existsSync(GENERATED_WIND_JSON)) {
    console.error("");
    console.error(
      "ERROR: packages/zudo-doc/dist/wind.json does not exist.",
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

  // Parse generated manifest
  const generatedJson = readFileSync(GENERATED_WIND_JSON, "utf8");
  const manifest = parseWindManifest(generatedJson);

  // Direction: source → generated manifest (critical — missing = drift that hurts consumers)
  const missingFromManifest = [...sourceClasses]
    .filter((c) => !manifest.has(c))
    .sort();

  if (missingFromManifest.length === 0) {
    console.log(
      `OK — package wind manifest check passed. ${sourceClasses.size} source utilities all present in generated dist/wind.json.`,
    );
    return 0;
  }

  console.error("");
  console.error(
    "Package wind manifest check FAILED — the following utilities exist in",
  );
  console.error(
    `packages/zudo-doc/src/**/*.tsx but are MISSING from the generated\n` +
      `packages/zudo-doc/dist/wind.json:`,
  );
  console.error("");
  for (const c of missingFromManifest) {
    console.error(`  ${c}`);
  }
  console.error("");
  console.error("This has two possible causes:");
  console.error("");
  console.error(
    "  1. A REAL utility class that packages/zudo-doc/scripts/gen-wind-manifest.mjs\n" +
      "     failed to capture from the compiled dist/**/*.js. Fix the extraction\n" +
      "     logic there, then rebuild:\n" +
      "       pnpm --filter @takazudo/zudo-doc build",
  );
  console.error("");
  console.error(
    "  2. A class name mentioned in PROSE — e.g. a comment naming a class to\n" +
      "     contrast it with the one actually used. Nothing emits it, so it will\n" +
      "     never appear in the generated manifest. Append a trailing\n" +
      "     `// safelist-ok: <reason>` comment on that SAME line to exempt it from\n" +
      "     extraction (mirrors scripts/check-wait-debt.mjs's `wait-ok:` marker;\n" +
      "     see the TOC wrapper comment in\n" +
      "     packages/zudo-doc/src/doc-page-shell/index.tsx for a live example).",
  );
  console.error("");
  console.error(
    "Re-run `pnpm check:package-wind-manifest` after fixing to verify.",
  );
  return 1;
}

// Run the CLI only when executed directly (node scripts/check-package-wind-manifest.mjs),
// NOT when imported. Mirrors packages/zudo-doc/scripts/gen-wind-manifest.mjs's guard:
// the unit test dynamically imports this module for extractClasses/parseWindManifest,
// and without this guard the import would run main() (and process.exit) as a
// side effect, killing the Vitest process.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main());
}
