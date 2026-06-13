#!/usr/bin/env node
/**
 * Parses a Playwright JSON report and emits GitHub Actions warning annotations
 * for any test that passed on retry (i.e. final status is "passed" but has
 * more than one result attempt). These are triage signals — not failures — so
 * the script always exits 0.
 *
 * Usage: node scripts/report-retry-flakes.mjs [report-path]
 * Default report path: playwright-report/report.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Playwright JSON report shape (the part we consume):
//
//   report.suites[]                      ← top-level, one per spec file (nested)
//     .file                              ← spec file path (inherited by children)
//     .specs[]                           ← one per test() in the file
//       .title                           ← the test title
//       .file                            ← spec file path
//       .tests[]                         ← one per project (e.g. "smoke", "i18n")
//         .status                        ← OUTCOME: expected|unexpected|flaky|skipped
//         .results[]                     ← one per attempt
//           .status                      ← passed|failed|timedOut|...
//           .retry                       ← 0-based attempt index
//     .suites[]                          ← nested describe() blocks
//
// A "passed on retry" is exactly Playwright's `flaky` outcome: the test failed
// on attempt 0 and passed on a later retry. We also detect it structurally
// (a passing final result after >1 attempts) as a belt-and-suspenders fallback.

/**
 * @typedef {Object} PwResult
 * @property {"passed"|"failed"|"timedOut"|"interrupted"|"skipped"} status
 * @property {number} [retry] - 0-based attempt index
 */

/**
 * @typedef {Object} PwTest
 * @property {"expected"|"unexpected"|"flaky"|"skipped"} status
 * @property {PwResult[]} [results]
 */

/**
 * @typedef {Object} PwSpec
 * @property {string} title
 * @property {string} [file]
 * @property {PwTest[]} [tests]
 */

/**
 * @typedef {Object} Suite
 * @property {string} [title]
 * @property {string} [file]
 * @property {PwSpec[]} [specs]
 * @property {Suite[]} [suites]
 */

/**
 * @typedef {Object} FlakeAnnotation
 * @property {string} file
 * @property {string} title
 * @property {number} retryNumber - the retry index of the passing attempt (>=1)
 */

/**
 * Recursively collects all spec objects from a suite tree, threading the
 * inherited `file` down to specs that omit it.
 *
 * @param {Suite} suite
 * @param {string} inheritedFile
 * @returns {Array<PwSpec & { file: string }>}
 */
function collectSpecs(suite, inheritedFile) {
  const file = suite.file ?? inheritedFile;
  /** @type {Array<PwSpec & { file: string }>} */
  const specs = [];
  if (Array.isArray(suite.specs)) {
    for (const spec of suite.specs) {
      specs.push({ ...spec, file: spec.file ?? file });
    }
  }
  if (Array.isArray(suite.suites)) {
    for (const child of suite.suites) {
      specs.push(...collectSpecs(child, file));
    }
  }
  return specs;
}

/**
 * Parses a Playwright JSON report object and returns an array of flake
 * annotations for tests that passed only after retrying.
 *
 * This function is pure (no I/O) so it can be unit-tested directly.
 *
 * @param {object} report - Parsed Playwright JSON report
 * @returns {FlakeAnnotation[]}
 */
export function findRetryFlakes(report) {
  /** @type {FlakeAnnotation[]} */
  const flakes = [];

  if (!report || !Array.isArray(report.suites)) {
    return flakes;
  }

  const specs = [];
  for (const suite of report.suites) {
    specs.push(...collectSpecs(suite, ""));
  }

  for (const spec of specs) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      const lastResult = results[results.length - 1];
      const maxRetry = results.reduce(
        (max, r) => Math.max(max, r.retry ?? 0),
        0,
      );
      // Canonical signal: Playwright's own `flaky` outcome. Structural
      // fallback: a passing final result after a retry actually happened.
      const passedOnRetry =
        test.status === "flaky" ||
        (maxRetry > 0 && lastResult?.status === "passed");
      if (passedOnRetry) {
        flakes.push({
          file: spec.file || "(unknown file)",
          title: spec.title,
          retryNumber: Math.max(maxRetry, results.length - 1),
        });
      }
    }
  }

  return flakes;
}

// --- CLI entry point ---
// Guard against being imported as a module in unit tests.
const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const reportPath = resolve(
    process.argv[2] ?? "playwright-report/report.json",
  );

  let report;
  try {
    const raw = readFileSync(reportPath, "utf8");
    report = JSON.parse(raw);
  } catch (err) {
    // If the report doesn't exist (e.g. all tests were skipped or Playwright
    // never ran), exit silently — this is a non-fatal, informational step.
    process.stderr.write(
      `report-retry-flakes: could not read ${reportPath}: ${/** @type {Error} */ (err).message}\n`,
    );
    process.exit(0);
  }

  const flakes = findRetryFlakes(report);

  for (const { file, title, retryNumber } of flakes) {
    // GitHub Actions warning annotation format.
    process.stdout.write(
      `::warning::flaky: ${file} › ${title} passed on retry ${retryNumber}\n`,
    );
  }

  process.exit(0);
}
