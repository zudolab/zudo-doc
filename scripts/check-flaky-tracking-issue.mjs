#!/usr/bin/env node
// scripts/check-flaky-tracking-issue.mjs
//
// @flaky / @local-only tracking-issue guard.
//
// Every test tagged @flaky or @local-only must have a GitHub issue URL in a
// comment on the line immediately preceding (or within 10 lines before) the
// `test(...)` call. The URL is extracted using the same backward-walk logic
// `scripts/report-flaky-lane.mjs` uses, shared via
// `scripts/lib/extract-tracking-issue-url.mjs` (#2529).
//
// This guard closes the enforcement gap: TESTING.md documents the tracking-
// issue requirement, but nothing previously prevented a @flaky / @local-only
// test from landing without the URL. Adding the tag without a URL leaves the
// quarantine telemetry (report-flaky-lane.mjs) silent and the exit deadline
// untracked — exactly the graveyard anti-pattern the refactor was meant to
// eliminate.
//
// Usage: node scripts/check-flaky-tracking-issue.mjs
// Exit 0 = all OK. Exit 1 = violation(s) detected.
//
// Wired into:
//   - scripts/run-b4push.sh (guard step — inside marker region)
//   - .github/workflows/pr-checks.yml (lightweight pure-Node job)

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractTrackingIssueUrl } from "./lib/extract-tracking-issue-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/**
 * Find all git-TRACKED *.spec.ts files under e2e/.
 * Tracked-only scanning respects .gitignore, so build output and scratch dirs
 * never trip the guard. Returns paths relative to ROOT.
 */
function findE2eSpecFiles() {
  const out = execFileSync("git", ["ls-files", "e2e/*.spec.ts", "e2e/**/*.spec.ts"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return out.split("\n").filter((line) => line.length > 0);
}

// ---------------------------------------------------------------------------
// Tag detection: find all test() calls tagged @flaky or @local-only
//
// Returns an array of { title, tag, lineNumber } for every tagged test.
// The tag is detected in the test-title string itself (the conventional
// placement per TESTING.md: `test("feature works @flaky", ...)`).
// ---------------------------------------------------------------------------
/**
 * @param {string} fileContent
 * @returns {Array<{title: string, tag: string, lineNumber: number}>}
 */
function findTaggedTests(fileContent) {
  const lines = fileContent.split("\n");
  const results = [];

  // Matches: test("...@flaky...", ...) or test("...@local-only...", ...)
  // Handles single, double, and template-literal quote styles.
  const testCallPattern = /\btest\s*\(\s*(["'`])(.*?)\1/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(testCallPattern);
    if (!m) continue;

    const title = m[2];
    if (title.includes("@flaky")) {
      results.push({ title, tag: "@flaky", lineNumber: i + 1 });
    } else if (title.includes("@local-only")) {
      results.push({ title, tag: "@local-only", lineNumber: i + 1 });
    }
  }

  return results;
}

function main() {
  const errors = [];
  const specFiles = findE2eSpecFiles();

  let checkedTests = 0;

  for (const relPath of specFiles) {
    const absPath = resolve(ROOT, relPath);
    let content;
    try {
      content = readFileSync(absPath, "utf-8");
    } catch (err) {
      errors.push(`Cannot read ${relPath}: ${err.message}`);
      continue;
    }

    const taggedTests = findTaggedTests(content);

    for (const { title, tag, lineNumber } of taggedTests) {
      checkedTests++;
      const issueUrl = extractTrackingIssueUrl(content, title);
      if (!issueUrl) {
        errors.push(
          `[missing-url] ${relPath}:${lineNumber} — test tagged ${tag} has no tracking-issue URL comment.\n` +
            `  Test: "${title}"\n` +
            `  Fix: add a comment with a GitHub issue URL on the line(s) immediately above the test() call:\n` +
            `       // https://github.com/<org>/<repo>/issues/<N> — brief description; deadline: YYYY-MM\n` +
            `       test("... ${tag}", async ({ page }) => { ... });\n` +
            `  See TESTING.md §"How to tag a test as @flaky" for the full requirement.`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error("");
    console.error(
      `@flaky/@local-only tracking-issue guard FAILED — ${errors.length} test(s) lack a tracking-issue URL:`,
    );
    console.error("");
    for (const err of errors) {
      console.error(err);
      console.error("");
    }
    console.error(
      "See TESTING.md for the tracking-issue requirement and quarantine pipeline.",
    );
    return 1;
  }

  console.log(
    `OK — @flaky/@local-only tracking-issue guard passed.` +
      (checkedTests > 0
        ? ` ${checkedTests} tagged test(s) across ${specFiles.length} spec file(s) all have tracking-issue URLs.`
        : ` No @flaky or @local-only tests found in ${specFiles.length} spec file(s).`),
  );
  return 0;
}

process.exit(main());
