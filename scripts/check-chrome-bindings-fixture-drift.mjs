#!/usr/bin/env node
// scripts/check-chrome-bindings-fixture-drift.mjs
//
// Drift guard for fixture-owned copies of repo-root src/ single files.
// Today there is exactly one pair: src/chrome-bindings.tsx <->
// e2e/fixtures/hostpanel/src/chrome-bindings.fixture.tsx (materialized over
// the root copy by the SRC_SINGLE_FILES loop in e2e/setup-fixtures.sh —
// `<name>.fixture.<ext>` wins).
//
// Why it matters: every ChromeBindingsInput slot is optional, so a root
// change the fixture copy misses does not fail any build — hostpanel e2e
// just silently tests stale chrome.
//
// Invariant (one-way preservation, root subset of fixture): every normalized
// root line must appear in the fixture file, in the same relative order
// (ordered-subsequence match). The fixture may add lines freely. This proves
// nothing in root was LOST — it does not police what the fixture adds, and a
// line deleted from root lingers in the fixture undetected. That is accepted.
//
// Normalization drops blank lines and comment-only lines (`//...`, and lines
// wholly inside `/* ... */` blocks) and trims the rest.
//
// Replacement allowlist (.chrome-bindings-fixture-drift-allowlist) covers
// root lines the fixture legitimately replaces instead of copying verbatim.
// One entry per line:
//   <fixture>|<exact trimmed root line>|<exact trimmed replacement line> # reason: <why>
// An entry is valid only if the root line still exists in root AND the
// replacement line exists in the fixture file; the replacement then stands
// in for the root line at that point in the ordered-subsequence walk.
//
// Usage: node scripts/check-chrome-bindings-fixture-drift.mjs
// Exit 0 = no unallowlisted drift. Exit 1 = drift detected.
//
// Wired into:
//   (wired by the gate-wiring sub-issue)

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ALLOWLIST_PATH = resolve(ROOT, ".chrome-bindings-fixture-drift-allowlist");
const REASON_MARKER = "# reason:";

// ---------------------------------------------------------------------------
// Pure functions — exported for
// scripts/__tests__/check-chrome-bindings-fixture-drift.test.ts
// ---------------------------------------------------------------------------

/**
 * Split file content into normalized, comment/blank-stripped lines, each
 * carrying its original 1-based line number (for error messages).
 */
export function stripCommentsAndBlanks(content) {
  const rawLines = content.split("\n");
  const result = [];
  let inBlockComment = false;
  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const trimmed = rawLines[i].trim();
    if (inBlockComment) {
      const closeIdx = trimmed.indexOf("*/");
      if (closeIdx === -1) continue;
      inBlockComment = false;
      const after = trimmed.slice(closeIdx + 2).trim();
      if (after !== "" && !after.startsWith("//")) {
        result.push({ text: after, lineNumber });
      }
      continue;
    }
    if (trimmed === "") continue;
    if (trimmed.startsWith("//")) continue;
    if (trimmed.startsWith("/*")) {
      const closeIdx = trimmed.indexOf("*/", 2);
      if (closeIdx === -1) {
        inBlockComment = true;
      } else {
        const after = trimmed.slice(closeIdx + 2).trim();
        if (after !== "" && !after.startsWith("//")) {
          result.push({ text: after, lineNumber });
        }
      }
      continue;
    }
    result.push({ text: trimmed, lineNumber });
  }
  return result;
}

/**
 * Parse one raw allowlist line.
 * Returns:
 *   - null for a blank line, or a line that is only a `#` comment (ignored)
 *   - { error } for a malformed entry
 *   - { fixture, rootLine, replacementLine, reason } for a valid entry
 */
export function parseAllowlistLine(rawLine) {
  const trimmed = rawLine.trim();
  if (trimmed === "" || trimmed.startsWith("#")) return null;

  const reasonIdx = trimmed.indexOf(REASON_MARKER);
  if (reasonIdx === -1) {
    return { error: `missing "${REASON_MARKER}" comment: ${trimmed}` };
  }
  const dataPart = trimmed.slice(0, reasonIdx).trim();
  const reason = trimmed.slice(reasonIdx + REASON_MARKER.length).trim();
  if (reason === "") {
    return { error: `empty reason: ${trimmed}` };
  }

  const parts = dataPart.split("|");
  if (parts.length !== 3) {
    return {
      error: `expected 3 "|"-separated fields (fixture|rootLine|replacementLine), got ${parts.length}: ${trimmed}`,
    };
  }
  const [fixture, rootLine, replacementLine] = parts.map((p) => p.trim());
  if (!fixture || !rootLine || !replacementLine) {
    return { error: `empty field in entry: ${trimmed}` };
  }
  return { fixture, rootLine, replacementLine, reason };
}

/** Parse a whole allowlist file's content into valid entries + parse errors. */
export function parseAllowlist(content) {
  const entries = [];
  const errors = [];
  content.split("\n").forEach((rawLine, idx) => {
    const parsed = parseAllowlistLine(rawLine);
    if (parsed === null) return;
    if (parsed.error) {
      errors.push(`line ${idx + 1}: ${parsed.error}`);
    } else {
      entries.push(parsed);
    }
  });
  return { entries, errors };
}

/**
 * Ordered-subsequence match: every normalized root line must appear in the
 * fixture lines, in the same relative order. `replacementMap` (root line
 * text -> replacement text) lets an allowlisted line stand in for its root
 * line at that point in the walk.
 *
 * Returns null when the fixture preserves every root line, or
 * { missingLine, missingLineNumber } naming the first one it drops.
 */
export function findDrift(rootLines, fixtureLines, replacementMap = new Map()) {
  let cursor = 0;
  for (const root of rootLines) {
    const target = replacementMap.get(root.text) ?? root.text;
    let found = -1;
    for (let i = cursor; i < fixtureLines.length; i++) {
      if (fixtureLines[i].text === target) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      return { missingLine: root.text, missingLineNumber: root.lineNumber };
    }
    cursor = found + 1;
  }
  return null;
}

/**
 * Validate one allowlist entry against the root/fixture line sets of the
 * pair it names. Returns an error string, or null when the entry is valid.
 */
export function validateAllowlistEntry(entry, rootLineTexts, fixtureLineTexts) {
  if (!rootLineTexts.has(entry.rootLine)) {
    return `stale entry (root line no longer exists): ${entry.rootLine}`;
  }
  if (!fixtureLineTexts.has(entry.replacementLine)) {
    return `missing replacement (not found in fixture): ${entry.replacementLine}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------

/**
 * Discover every git-tracked e2e/fixtures/*\/src/<name>.fixture.<ext> file
 * and pair it with its root counterpart src/<name>.<ext>.
 */
function discoverFixturePairs() {
  const out = execFileSync(
    "git",
    ["ls-files", "e2e/fixtures/*/src/*.fixture.*"],
    { cwd: ROOT, encoding: "utf8" },
  );
  const fixturePaths = out.split("\n").filter((line) => line.length > 0);

  return fixturePaths.map((fixturePath) => {
    const m = fixturePath.match(
      /^e2e\/fixtures\/([^/]+)\/src\/(.+)\.fixture\.([^./]+)$/,
    );
    if (!m) {
      throw new Error(
        `Cannot parse fixture path (unexpected shape): ${fixturePath}`,
      );
    }
    const [, fixtureDir, baseName, ext] = m;
    return { fixtureDir, fixturePath, rootPath: `src/${baseName}.${ext}` };
  });
}

function main() {
  const pairs = discoverFixturePairs();
  const knownFixtureDirs = new Set(pairs.map((p) => p.fixtureDir));

  let allowlistContent = "";
  try {
    allowlistContent = readFileSync(ALLOWLIST_PATH, "utf8");
  } catch {
    allowlistContent = "";
  }
  const { entries, errors: parseErrors } = parseAllowlist(allowlistContent);

  let anyError = false;
  for (const err of parseErrors) {
    console.error(`[chrome-bindings-fixture-drift] allowlist: ${err}`);
    anyError = true;
  }
  for (const entry of entries) {
    if (!knownFixtureDirs.has(entry.fixture)) {
      console.error(
        `[chrome-bindings-fixture-drift] allowlist references unknown fixture (no .fixture.* file): ${entry.fixture}`,
      );
      anyError = true;
    }
  }

  for (const pair of pairs) {
    let rootContent;
    try {
      rootContent = readFileSync(resolve(ROOT, pair.rootPath), "utf8");
    } catch {
      console.error(
        `[chrome-bindings-fixture-drift] ${pair.fixturePath}: no root counterpart at ${pair.rootPath}`,
      );
      anyError = true;
      continue;
    }
    const fixtureContent = readFileSync(resolve(ROOT, pair.fixturePath), "utf8");

    const rootLines = stripCommentsAndBlanks(rootContent);
    const fixtureLines = stripCommentsAndBlanks(fixtureContent);
    const rootLineTexts = new Set(rootLines.map((l) => l.text));
    const fixtureLineTexts = new Set(fixtureLines.map((l) => l.text));

    const replacementMap = new Map();
    for (const entry of entries) {
      if (entry.fixture !== pair.fixtureDir) continue;
      const err = validateAllowlistEntry(entry, rootLineTexts, fixtureLineTexts);
      if (err) {
        console.error(
          `[chrome-bindings-fixture-drift] allowlist entry for ${entry.fixture}: ${err}`,
        );
        anyError = true;
        continue;
      }
      replacementMap.set(entry.rootLine, entry.replacementLine);
    }

    const drift = findDrift(rootLines, fixtureLines, replacementMap);
    if (drift) {
      anyError = true;
      console.error(`\n[chrome-bindings-fixture-drift] ${pair.fixturePath}:`);
      console.error(
        `  missing root line (${pair.rootPath}:${drift.missingLineNumber}): ${drift.missingLine}`,
      );
      console.error(
        "  remedy: port the root change into the fixture copy, or add a replacement entry with a reason to .chrome-bindings-fixture-drift-allowlist",
      );
    }
  }

  if (anyError) {
    process.exit(1);
  } else {
    console.log("chrome-bindings fixture drift check passed.");
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
