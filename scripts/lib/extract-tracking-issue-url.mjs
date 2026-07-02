#!/usr/bin/env node
// scripts/lib/extract-tracking-issue-url.mjs
//
// Pure, side-effect-free module. Extracted from a hand-copied duplicate that
// had drifted into two CLI scripts (#2529):
//   - scripts/report-flaky-lane.mjs (posts quarantine telemetry to the
//     tracking issue found via this function)
//   - scripts/check-flaky-tracking-issue.mjs (guards that every @flaky /
//     @local-only test has a tracking-issue URL comment)
//
// Both scripts import this module rather than one importing the other's CLI
// entry — report-flaky-lane.mjs has argv-parsing / process.exit side effects
// at module scope that a pure consumer should not trigger by importing it.

// ---------------------------------------------------------------------------
// Pure function: extract tracking issue URL from spec file content
//
// Searches backwards from the test title line for the nearest preceding
// comment line containing a GitHub issue URL.
//
// Returns the first GitHub issue URL found, or null if none.
// ---------------------------------------------------------------------------
/**
 * @param {string} fileContent - full text of the spec file
 * @param {string} testTitle - the test title string (as it appears in test("..."))
 * @returns {string | null}
 */
export function extractTrackingIssueUrl(fileContent, testTitle) {
  const lines = fileContent.split("\n");

  // Escape special regex chars in the test title for safe matching
  const escapedTitle = testTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const titlePattern = new RegExp(
    `test\\s*\\(\\s*["'\`].*${escapedTitle}.*["'\`]`,
  );

  // Find the line index where this test is defined
  let testLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (titlePattern.test(lines[i])) {
      testLineIndex = i;
      break;
    }
  }

  if (testLineIndex === -1) return null;

  // Walk backwards from the test title line to find a comment with a GitHub URL
  const githubIssuePattern =
    /https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/issues\/\d+/;

  for (let i = testLineIndex - 1; i >= 0 && i >= testLineIndex - 10; i--) {
    const line = lines[i].trim();
    // Only consider comment lines (// or /* style)
    if (
      line.startsWith("//") ||
      line.startsWith("*") ||
      line.startsWith("/*")
    ) {
      const match = line.match(githubIssuePattern);
      if (match) {
        return match[0];
      }
    } else if (line === "" || line === "*/") {
      // Allow blank lines and end-of-block-comment between comment and test
      continue;
    } else {
      // Non-comment, non-blank line encountered — stop looking
      break;
    }
  }

  return null;
}
