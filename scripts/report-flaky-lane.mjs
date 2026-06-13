#!/usr/bin/env node
// report-flaky-lane.mjs — Quarantine telemetry reporter for exam.yml.
//
// Parses the @flaky lane's Playwright JSON report and for each test:
//   1. Extracts the tracking issue URL from the inline comment above the
//      test title in its spec file (the nearest preceding comment line
//      containing a GitHub issue URL).
//   2. Posts a comment to that issue with: run URL, pass/fail status, and
//      failure signature (error message excerpt if failed).
//
// Usage:
//   node scripts/report-flaky-lane.mjs \
//     --report <path-to-playwright-json-report> \
//     --run-url <github-actions-run-url>
//
// Environment:
//   GITHUB_TOKEN — required; used by `gh issue comment`

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

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
    `test\\s*\\(\\s*["'\`].*${escapedTitle}.*["'\`]`
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
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) {
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

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let reportPath = "";
let runUrl = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--report" && args[i + 1]) {
    reportPath = args[++i];
  } else if (args[i] === "--run-url" && args[i + 1]) {
    runUrl = args[++i];
  }
}

// When imported as a module for testing, skip the main execution block
if (process.argv[1] && process.argv[1].endsWith("report-flaky-lane.mjs")) {
  if (!reportPath) {
    console.error("Error: --report is required");
    process.exit(1);
  }
  if (!runUrl) {
    console.error("Error: --run-url is required");
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Main: parse JSON report and post telemetry
  // ---------------------------------------------------------------------------
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf-8"));
  } catch (err) {
    console.error(`Failed to parse report at ${reportPath}: ${err.message}`);
    process.exit(1);
  }

  // Collect all test results from the nested Playwright JSON structure
  /** @type {Array<{title: string, ok: boolean, file: string, error?: string}>} */
  const testResults = [];

  function collectTests(node, currentFile) {
    const file = node.file ?? currentFile;
    if (node.specs) {
      for (const spec of node.specs) {
        const ok = spec.ok ?? spec.tests?.every((t) => t.results?.every((r) => r.status === "passed")) ?? true;
        const error = spec.tests
          ?.flatMap((t) => t.results ?? [])
          .find((r) => r.status !== "passed")
          ?.error?.message;
        testResults.push({ title: spec.title, ok, file: file ?? "", error });
      }
    }
    if (node.suites) {
      for (const child of node.suites) {
        collectTests(child, file);
      }
    }
  }

  if (report.suites) {
    for (const suite of report.suites) {
      collectTests(suite, "");
    }
  }

  if (testResults.length === 0) {
    console.log("No tests found in the flaky lane report — nothing to report.");
    process.exit(0);
  }

  console.log(`Found ${testResults.length} test(s) in flaky lane report.`);

  for (const result of testResults) {
    const status = result.ok ? "PASS" : "FAIL";
    console.log(`  [${status}] ${result.title} (${result.file})`);

    // Try to extract tracking issue URL from the spec file
    let issueUrl = null;
    if (result.file) {
      try {
        const fileContent = readFileSync(result.file, "utf-8");
        issueUrl = extractTrackingIssueUrl(fileContent, result.title);
      } catch {
        // File may not exist or be readable in all contexts
      }
    }

    if (!issueUrl) {
      console.log(`    No tracking issue URL found — skipping telemetry comment.`);
      continue;
    }

    console.log(`    Tracking issue: ${issueUrl}`);

    // Build comment body
    let body = `## Flaky lane telemetry — ${status}\n\n`;
    body += `**Test:** ${result.title}\n`;
    body += `**Status:** ${status}\n`;
    body += `**Run:** ${runUrl}\n`;
    if (!result.ok && result.error) {
      const excerpt = result.error.slice(0, 500);
      body += `\n### Failure signature\n\n\`\`\`\n${excerpt}\n\`\`\`\n`;
    }

    // Post comment to the tracking issue using gh CLI
    try {
      execFileSync("gh", ["issue", "comment", issueUrl, "--body", body], {
        stdio: ["ignore", "inherit", "inherit"],
        env: { ...process.env },
      });
      console.log(`    Comment posted to ${issueUrl}`);
    } catch (err) {
      console.error(`    Failed to post comment to ${issueUrl}: ${err.message}`);
    }
  }
}
