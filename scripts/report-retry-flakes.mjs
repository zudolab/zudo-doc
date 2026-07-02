#!/usr/bin/env node
/**
 * Parses a Playwright JSON report and emits GitHub Actions warning annotations
 * for any test that passed on retry (i.e. final status is "passed" but has
 * more than one result attempt). These are triage signals — not failures — so
 * the script always exits 0.
 *
 * Beyond the annotation, each flake also gets a consumer (zudolab/zudo-doc#2535):
 * a deduped `retry-flake`-labeled GitHub issue per offending test (one open
 * issue per test, reusing the file-exam-issue.sh per-identity dedup pattern —
 * see scripts/lib/file-retry-flake-issue.mjs). This step degrades gracefully
 * to annotation-only when GITHUB_TOKEN is absent or read-only (fork PRs) or
 * `gh` fails for any reason — it never fails the job.
 *
 * Usage: node scripts/report-retry-flakes.mjs [report-path]
 * Default report path: playwright-report/report.json
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RETRY_FLAKE_LABEL,
  buildRetryFlakeIssueTitle,
  buildRetryFlakeIssueBody,
  findMatchingRetryFlakeIssue,
  dedupeFlakes,
} from "./lib/file-retry-flake-issue.mjs";

// `gh issue list` defaults to a 30-issue page; without an explicit --limit
// higher than the expected open-issue count, a matching issue outside the
// first page reads as "missing" and gets duplicated (codex review finding).
const GH_ISSUE_LIST_LIMIT = "200";

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

/**
 * Builds the `gh --repo` flag array from GH_REPO, mirroring the pattern in
 * scripts/file-exam-issue.sh (gh auto-detects the repo from the git remote
 * when unset, so the flag is optional).
 *
 * @returns {string[]}
 */
function repoFlag() {
  return process.env.GH_REPO ? ["--repo", process.env.GH_REPO] : [];
}

/**
 * Files or appends a deduped `retry-flake`-labeled issue per offending test.
 * Never throws — every risky step (label creation, listing, filing) is
 * wrapped so a missing/read-only token, a network hiccup, or an unexpected
 * `gh` response degrades to "annotations only" instead of failing the job.
 *
 * @param {FlakeAnnotation[]} flakes
 * @param {string} runUrl
 */
function fileRetryFlakeIssues(flakes, runUrl) {
  if (flakes.length === 0) return;

  if (!process.env.GITHUB_TOKEN) {
    process.stderr.write(
      "report-retry-flakes: GITHUB_TOKEN not set — skipping issue filing (annotation-only).\n",
    );
    return;
  }

  // Idempotent; failure here (e.g. read-only fork-PR token) is non-fatal —
  // `gh issue list`/`create` below will fail the same way and get caught.
  try {
    execFileSync(
      "gh",
      [
        "label",
        "create",
        RETRY_FLAKE_LABEL,
        "--description",
        "Auto-filed: a test passed only after a CI retry (scripts/report-retry-flakes.mjs)",
        "--color",
        "F9D0C4",
        ...repoFlag(),
      ],
      { stdio: "ignore" },
    );
  } catch {
    // Already exists, or we lack permission to create it — non-fatal.
  }

  /** @type {Array<{number: number, title: string}>} */
  let openIssues;
  try {
    const raw = execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--label",
        RETRY_FLAKE_LABEL,
        "--state",
        "open",
        "--json",
        "number,title",
        "--limit",
        GH_ISSUE_LIST_LIMIT,
        ...repoFlag(),
      ],
      { encoding: "utf8" },
    );
    openIssues = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(
      `report-retry-flakes: could not list existing retry-flake issues (${/** @type {Error} */ (err).message}) — skipping issue filing (annotation-only).\n`,
    );
    return;
  }

  // Collapse duplicate file+title entries (e.g. the same spec flaking under
  // more than one Playwright project in this run) — openIssues is a
  // pre-loop snapshot, so a same-titled duplicate later in the raw `flakes`
  // list wouldn't see the issue an earlier duplicate just created.
  for (const flake of dedupeFlakes(flakes)) {
    const title = buildRetryFlakeIssueTitle(flake);
    const body = buildRetryFlakeIssueBody(flake, runUrl);
    const existing = findMatchingRetryFlakeIssue(openIssues, flake);
    try {
      if (existing) {
        execFileSync(
          "gh",
          ["issue", "comment", String(existing), "--body", body, ...repoFlag()],
          { stdio: "ignore" },
        );
      } else {
        execFileSync(
          "gh",
          [
            "issue",
            "create",
            "--title",
            title,
            "--label",
            RETRY_FLAKE_LABEL,
            "--body",
            body,
            ...repoFlag(),
          ],
          { stdio: "ignore" },
        );
      }
    } catch (err) {
      process.stderr.write(
        `report-retry-flakes: failed to file/append retry-flake issue for "${flake.title}" (${/** @type {Error} */ (err).message}) — continuing (annotation-only for this test).\n`,
      );
    }
  }
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

  // Give the annotations a consumer — never let issue-filing problems fail
  // this (informational, always-exit-0) step.
  try {
    const runUrl =
      process.env.GITHUB_SERVER_URL &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : "(unknown run — GITHUB_SERVER_URL/GITHUB_REPOSITORY/GITHUB_RUN_ID unset)";
    fileRetryFlakeIssues(flakes, runUrl);
  } catch (err) {
    process.stderr.write(
      `report-retry-flakes: unexpected error while filing retry-flake issues (${/** @type {Error} */ (err).message}) — continuing (annotation-only).\n`,
    );
  }

  process.exit(0);
}
