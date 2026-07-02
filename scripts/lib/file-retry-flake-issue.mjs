#!/usr/bin/env node
// scripts/lib/file-retry-flake-issue.mjs
//
// Pure helpers for turning a retry-flake annotation (from
// scripts/report-retry-flakes.mjs's findRetryFlakes) into a deduped GitHub
// issue — one open issue per offending test, mirroring the per-workflow
// dedup pattern in scripts/file-exam-issue.sh but keyed on the test's
// file+title instead of the workflow name (zudolab/zudo-doc#2535).
//
// Kept side-effect-free (no gh/execFileSync calls) so the dedup/formatting
// logic is directly unit-testable without shelling out or mocking child_process.

export const RETRY_FLAKE_LABEL = "retry-flake";

/**
 * @typedef {Object} RetryFlake
 * @property {string} file
 * @property {string} title
 * @property {number} [retryNumber]
 */

/**
 * Builds the canonical issue title for a given flake. This string is also
 * the dedup key: an open issue with this exact title is considered "already
 * tracking this test".
 *
 * @param {RetryFlake} flake
 * @returns {string}
 */
export function buildRetryFlakeIssueTitle(flake) {
  return `[retry-flake] ${flake.file} › ${flake.title}`;
}

/**
 * Builds the markdown body posted to a new issue or appended as a comment.
 *
 * @param {RetryFlake} flake
 * @param {string} runUrl
 * @returns {string}
 */
export function buildRetryFlakeIssueBody(flake, runUrl) {
  const lines = [
    `## Retry-flake: ${flake.title}`,
    "",
    `**File:** ${flake.file}`,
    `**Run:** ${runUrl}`,
  ];
  if (typeof flake.retryNumber === "number") {
    lines.push(`**Passed on retry:** ${flake.retryNumber}`);
  }
  lines.push(
    "",
    "This test failed on its first attempt and passed on retry in CI. Per " +
      "TESTING.md, pass-on-retry is a triage signal, not a resolution — this " +
      "test should enter the quarantine pipeline (`@flaky` tag + tracking " +
      "issue) or be root-caused.",
  );
  return lines.join("\n");
}

/**
 * Finds the open issue (if any) already tracking this exact flake, given a
 * list of open issues carrying the `retry-flake` label. Dedup is by exact
 * title match (see buildRetryFlakeIssueTitle) — same test, same file.
 *
 * @param {Array<{number: number, title: string}>} openIssues
 * @param {RetryFlake} flake
 * @returns {number | null}
 */
export function findMatchingRetryFlakeIssue(openIssues, flake) {
  if (!Array.isArray(openIssues)) return null;
  const wantTitle = buildRetryFlakeIssueTitle(flake);
  const match = openIssues.find((issue) => issue?.title === wantTitle);
  return match ? match.number : null;
}

/**
 * Collapses a flakes list to one entry per file+title (dedup key —
 * buildRetryFlakeIssueTitle). A single Playwright run can report the same
 * spec as flaky under more than one project (e.g. the same test title
 * flaking in both the "smoke" and "i18n" projects), which would otherwise
 * file one GitHub issue per duplicate entry — the in-memory `openIssues`
 * snapshot used by the caller isn't updated mid-loop after a `gh issue
 * create`, so a later duplicate in the same run wouldn't see the issue the
 * earlier one just created. Keeps the first occurrence.
 *
 * @param {RetryFlake[]} flakes
 * @returns {RetryFlake[]}
 */
export function dedupeFlakes(flakes) {
  const seen = new Set();
  const result = [];
  for (const flake of flakes) {
    const key = buildRetryFlakeIssueTitle(flake);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(flake);
  }
  return result;
}
