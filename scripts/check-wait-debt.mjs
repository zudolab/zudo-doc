#!/usr/bin/env node
// scripts/check-wait-debt.mjs
//
// Wait-debt guard — zero-tolerance enforcement of TESTING.md's wait-pattern
// rules for `waitForTimeout` and `networkidle`.
//
// TESTING.md's "Wait-Pattern Rules" section forbids bare `waitForTimeout`
// (the same reasoning scripts/check-flaky-tracking-issue.mjs's header
// articulates for @flaky tracking: documented policy with no enforcement
// mechanism silently rots). This guard closes that gap: every
// `waitForTimeout` call site in the tracked Playwright specs/scripts must carry
// a trailing `// wait-ok: <why>` comment on the SAME line, explain why a
// duration wait is justified instead of a state/event wait, and pass a named
// identifier rather than a literal or computed expression. Both Playwright
// spellings of `networkidle` are banned.
//
// Zero-tolerance, no ratchet: current debt is zero (every existing call site
// is already annotated), so any unannotated call fails immediately — there
// is no baseline file to maintain.
//
// Usage: node scripts/check-wait-debt.mjs
// Exit 0 = all OK. Exit 1 = violation(s) detected.
//
// Wired into:
//   - scripts/run-b4push.sh (guard step — inside marker region)
//   - .github/workflows/pr-checks.yml (lightweight pure-Node job)

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// The marker itself — deliberately a plain substring (not a regex group) so
// it stays trivially greppable from the shell: `grep -rn "wait-ok:" e2e/`.
const WAIT_OK_MARKER = "wait-ok:";

// Matches an actual `waitForTimeout(` call preceded by a `.` (e.g.
// `page.waitForTimeout(`) and captures its single argument. Deliberately
// excludes bare "waitForTimeout("
// substrings that appear only in prose comments (e.g. "...replaces the old
// fixed waitForTimeout(1000) sleep.") — those describe past code, they are
// not live call sites.
const WAIT_FOR_TIMEOUT_CALL = /\.waitForTimeout\s*\(\s*([^)]*?)\s*\)/;
const NAMED_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// Both forms are forbidden: explicit waits after navigation and the
// `page.goto(..., { waitUntil: "networkidle" })` option.
const WAIT_FOR_LOAD_STATE_NETWORK_IDLE =
  /\.waitForLoadState\s*\(\s*(['"])networkidle\1\s*\)/;
const WAIT_UNTIL_NETWORK_IDLE = /\bwaitUntil\s*:\s*(['"])networkidle\1/;

/**
 * Find all git-TRACKED Playwright TypeScript files under e2e/, excluding
 * e2e/fixtures/ (those are separate zfb project checkouts used as fixture
 * content, not Playwright spec/helper files), plus the standalone theme-a11y
 * Playwright script. Tracked-only scanning respects .gitignore, so build output
 * and scratch dirs never trip the guard. Returns paths relative to ROOT.
 */
function findTrackedPlaywrightTsFiles() {
  const out = execFileSync(
    "git",
    ["ls-files", "e2e/*.ts", "e2e/**/*.ts", "scripts/theme-a11y-audit.ts"],
    { cwd: ROOT, encoding: "utf8" },
  );
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .filter((relPath) => !relPath.startsWith("e2e/fixtures/"));
}

function main() {
  const errors = [];
  const files = findTrackedPlaywrightTsFiles();
  let annotatedCount = 0;
  let networkIdleCount = 0;
  let waitForTimeoutViolationCount = 0;

  for (const relPath of files) {
    const absPath = resolve(ROOT, relPath);
    let content;
    try {
      content = readFileSync(absPath, "utf-8");
    } catch (err) {
      errors.push(`Cannot read ${relPath}: ${err.message}`);
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Whole-line comments never count as call sites (e.g. prose describing
      // a past fix, or genuinely dead commented-out code — either way, not
      // executing).
      if (trimmed.startsWith("//")) continue;

      if (
        WAIT_FOR_LOAD_STATE_NETWORK_IDLE.test(line) ||
        WAIT_UNTIL_NETWORK_IDLE.test(line)
      ) {
        errors.push(
          `[wait-debt] ${relPath}:${i + 1}: networkidle is forbidden; use a deterministic state/event wait instead.\n` +
            `  Line: ${trimmed}`,
        );
        networkIdleCount++;
      }

      const timeoutMatch = line.match(WAIT_FOR_TIMEOUT_CALL);
      if (!timeoutMatch) continue;

      const argument = timeoutMatch[1]?.trim() ?? "";

      if (line.includes(WAIT_OK_MARKER)) {
        annotatedCount++;
      } else {
        waitForTimeoutViolationCount++;
        errors.push(
          `[wait-debt] ${relPath}:${i + 1}: bare waitForTimeout without a wait-ok marker.\n` +
            `  Line: ${trimmed}\n` +
            `  Fix: add a trailing "// wait-ok: <why>" comment on the SAME line explaining\n` +
            `       why a duration wait is justified here — prefer a state/event wait\n` +
            `       instead (see TESTING.md § "Wait-Pattern Rules").`,
        );
      }

      if (!NAMED_IDENTIFIER.test(argument)) {
        waitForTimeoutViolationCount++;
        errors.push(
          `[wait-debt] ${relPath}:${i + 1}: waitForTimeout argument must be a named identifier.\n` +
            `  Line: ${trimmed}\n` +
            `  Fix: assign the delay to a named constant and pass that identifier.`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error("");
    console.error(
      `Wait-debt guard FAILED — ${errors.length} violation(s) found (${networkIdleCount} networkidle, ${waitForTimeoutViolationCount} waitForTimeout):`,
    );
    console.error("");
    for (const err of errors) {
      console.error(err);
      console.error("");
    }
    console.error('See TESTING.md § "Wait-Pattern Rules" for the deterministic-wait requirement.');
    return 1;
  }

  console.log(
    `OK — wait-debt guard passed. ${annotatedCount} waitForTimeout call(s), ${networkIdleCount} networkidle violation(s), across ${files.length} tracked Playwright file(s).`,
  );
  return 0;
}

process.exit(main());
