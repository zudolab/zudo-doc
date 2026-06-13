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

/**
 * @typedef {Object} TestResult
 * @property {"passed"|"failed"|"timedOut"|"interrupted"|"skipped"} status
 */

/**
 * @typedef {Object} TestCase
 * @property {string} title
 * @property {string} file
 * @property {TestResult[]} results
 * @property {"passed"|"failed"|"timedOut"|"interrupted"|"skipped"|"unexpected"|"flaky"} status
 */

/**
 * @typedef {Object} Suite
 * @property {string} [title]
 * @property {TestCase[]} [tests]
 * @property {Suite[]} [suites]
 */

/**
 * @typedef {Object} FlakeAnnotation
 * @property {string} file
 * @property {string} title
 * @property {number} retryNumber - 1-based index of the passing attempt
 */

/**
 * Recursively collects all TestCase objects from a suite tree.
 *
 * @param {Suite} suite
 * @returns {TestCase[]}
 */
function collectTests(suite) {
  /** @type {TestCase[]} */
  const tests = [];
  if (suite.tests) {
    tests.push(...suite.tests);
  }
  if (suite.suites) {
    for (const child of suite.suites) {
      tests.push(...collectTests(child));
    }
  }
  return tests;
}

/**
 * Parses a Playwright JSON report object and returns an array of flake
 * annotations for tests that passed only after retrying.
 *
 * A test is considered a retry-pass when:
 *   - Its final `.status` is "passed"
 *   - It has more than one result attempt (the first attempt(s) failed,
 *     the last succeeded)
 *
 * This function is pure (no I/O) so it can be unit-tested directly.
 *
 * @param {object} report - Parsed Playwright JSON report
 * @param {Suite[]} report.suites
 * @returns {FlakeAnnotation[]}
 */
export function findRetryFlakes(report) {
  /** @type {FlakeAnnotation[]} */
  const flakes = [];

  if (!report || !Array.isArray(report.suites)) {
    return flakes;
  }

  /** @type {TestCase[]} */
  const allTests = [];
  for (const suite of report.suites) {
    allTests.push(...collectTests(suite));
  }

  for (const test of allTests) {
    const results = test.results ?? [];
    // Passed on retry: final status is "passed" and there were multiple attempts.
    if (test.status === "passed" && results.length > 1) {
      flakes.push({
        file: test.file ?? "(unknown file)",
        title: test.title,
        retryNumber: results.length - 1,
      });
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
