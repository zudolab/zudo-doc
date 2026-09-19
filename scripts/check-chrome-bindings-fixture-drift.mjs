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
// Normalization removes block-comment spans outside string/template literals
// and the braces around comment-only JSX expressions, drops blank/comment-only
// lines, and trims the rest. Trailing `//` text on a code line stays intact.
//
// Replacement allowlist (.chrome-bindings-fixture-drift-allowlist) covers
// root lines the fixture legitimately replaces instead of copying verbatim.
// One entry per line:
//   <fixture>|<exact trimmed root line>|<exact trimmed replacement line> # reason: <why>
// An entry is valid only if the root line still exists in root AND the
// replacement line exists in the fixture file; the replacement then stands
// in for the root line at that point in the ordered-subsequence walk.
// The first field names a FIXTURE, not one pair, so when a fixture owns
// several `.fixture.*` files an entry applies to whichever of that fixture's
// pairs carries its root line; it is reported stale only if no pair does.
//
// Usage: node scripts/check-chrome-bindings-fixture-drift.mjs
// Exit 0 = no unallowlisted drift. Exit 1 = drift detected.
//
// Wired into:
//   - scripts/run-b4push.sh (step 6, inside the guard-region markers)
//   - .github/workflows/pr-checks.yml (check-chrome-bindings-fixture-drift —
//     own pure-Node job, "Chrome Bindings Fixture Drift Check")

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
  const strippedLines = rawLines.map(() => "");
  let inBlockComment = false;
  let quote = null;
  let pendingExpression = null;
  // Regex literals containing `/*` are out of scope.
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const next = line[j + 1];
      if (inBlockComment) {
        if (char === "*" && next === "/") {
          inBlockComment = false;
          j++;
        }
        continue;
      }

      if (quote !== null) {
        strippedLines[i] += char;
        if (char === "\\" && next !== undefined) {
          strippedLines[i] += next;
          j++;
        } else if (char === quote) {
          quote = null;
        }
        continue;
      }

      if (char === "/" && next === "/") {
        // Keep trailing text (including JSX URLs) verbatim, without letting
        // its quotes or comment markers change the following line's state.
        if (strippedLines[i].trim() !== "") {
          strippedLines[i] += line.slice(j);
        }
        pendingExpression = null;
        break;
      }
      if (char === "/" && next === "*") {
        inBlockComment = true;
        if (pendingExpression !== null) pendingExpression.hasComment = true;
        j++;
        continue;
      }

      if (char === "{") {
        // Defer deciding whether these braces belong to a comment-only
        // expression until its closing brace, even when it is on a later line.
        // A nested opening brace invalidates the previous candidate.
        pendingExpression = {
          lineIndex: i,
          offset: strippedLines[i].length,
          hasComment: false,
        };
      } else if (char === "}" && pendingExpression?.hasComment) {
        const { lineIndex, offset } = pendingExpression;
        strippedLines[lineIndex] = strippedLines[lineIndex].slice(0, offset);
        for (let k = lineIndex + 1; k <= i; k++) strippedLines[k] = "";
        pendingExpression = null;
        continue;
      } else if (/\S/.test(char)) {
        // Any code, including a string literal, prevents the containing
        // expression from being comment-only.
        pendingExpression = null;
        if (char === "'" || char === '"' || char === "`") {
          quote = char;
        }
      }
      strippedLines[i] += char;
    }

    // Only templates can carry literal state across source lines; their
    // interpolation text is deliberately opaque until the closing backtick.
    if (quote !== "`") quote = null;
  }

  return strippedLines
    .map((line, i) => ({ text: line.trim(), lineNumber: i + 1 }))
    .filter(({ text }) => text !== "");
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

  const entryStatus = new Map(
    entries.map((entry) => [
      entry,
      { matchedRoot: false, satisfied: false, lastError: null },
    ]),
  );

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
    let fixtureContent;
    try {
      fixtureContent = readFileSync(resolve(ROOT, pair.fixturePath), "utf8");
    } catch {
      console.error(
        `[chrome-bindings-fixture-drift] ${pair.fixturePath}: tracked in git but missing on disk`,
      );
      anyError = true;
      continue;
    }

    const rootLines = stripCommentsAndBlanks(rootContent);
    const fixtureLines = stripCommentsAndBlanks(fixtureContent);
    const rootLineTexts = new Set(rootLines.map((l) => l.text));
    const fixtureLineTexts = new Set(fixtureLines.map((l) => l.text));

    // An entry names a fixture, not an individual pair, so it applies to
    // whichever of that fixture's pairs actually carries its root line. It is
    // only reported as stale/unsatisfied once every pair has been walked.
    const replacementMap = new Map();
    for (const entry of entries) {
      if (entry.fixture !== pair.fixtureDir) continue;
      if (!rootLineTexts.has(entry.rootLine)) continue;
      const status = entryStatus.get(entry);
      status.matchedRoot = true;
      const err = validateAllowlistEntry(entry, rootLineTexts, fixtureLineTexts);
      if (err) {
        status.lastError = err;
        continue;
      }
      status.satisfied = true;
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

  for (const [entry, status] of entryStatus) {
    if (status.satisfied) continue;
    if (!knownFixtureDirs.has(entry.fixture)) continue; // already reported above
    const err =
      status.matchedRoot && status.lastError
        ? status.lastError
        : `stale entry (root line no longer exists): ${entry.rootLine}`;
    console.error(
      `[chrome-bindings-fixture-drift] allowlist entry for ${entry.fixture}: ${err}`,
    );
    anyError = true;
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
