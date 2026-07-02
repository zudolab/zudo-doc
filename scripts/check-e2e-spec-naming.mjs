#!/usr/bin/env node
// scripts/check-e2e-spec-naming.mjs
//
// Spec-to-fixture naming guard.
//
// Playwright's testMatch pattern is `${fixtureName}*.spec.ts` — a spec whose
// filename doesn't start with a known fixture prefix silently matches no project
// and never runs. This script catches that silent omission.
//
// It also ensures no Playwright spec files exist outside `e2e/` unless they are
// pre-approved in the allowlist file.
//
// Rules enforced:
//   (a) Every `e2e/**/*.spec.ts` filename (recursive — a spec nested in a
//       subdirectory is just as silently orphaned as a top-level one) starts
//       with a known fixture prefix. `e2e/fixtures/**` is excluded — that
//       subtree is fixture *content* (separate zfb project checkouts), not
//       Playwright specs.
//   (b) No `*.spec.ts` files exist outside `e2e/` except those listed in
//       .check-e2e-spec-naming-allowlist with a why-comment.
//   (c) The fixture directory names under e2e/fixtures/ and
//       playwright.config.ts's ALL_FIXTURES array are the same set. Drift in
//       either direction reopens the orphan-spec hole rule (a) exists to
//       close: a fixture directory with no matching Playwright project
//       accepts specs that then never run; a Playwright project with no
//       fixture directory has no webServer/testDir content to run against.
//
// KNOWN_PREFIXES (used by rule (a)) is the INTERSECTION of the two rule-(c)
// sources — a prefix only counts as "known good" if it has both a real
// fixture directory AND a wired Playwright project. A hand-synced literal
// copy of ALL_FIXTURES previously drifted silently (#2538); deriving from
// directories alone would still miss the reverse drift (a directory added
// without updating ALL_FIXTURES), which rule (c) now catches explicitly.
//
// Usage: node scripts/check-e2e-spec-naming.mjs
// Exit 0 = all OK. Exit 1 = violation(s) detected.
//
// Wired into:
//   - scripts/run-b4push.sh (guard step — inside marker region)
//   - .github/workflows/pr-checks.yml (lightweight pure-Node job)

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const FIXTURES_DIR = resolve(ROOT, "e2e/fixtures");
const PLAYWRIGHT_CONFIG_PATH = resolve(ROOT, "playwright.config.ts");

/**
 * Read the fixture directory names under e2e/fixtures/.
 */
function readFixtureDirNames() {
  let entries;
  try {
    entries = readdirSync(FIXTURES_DIR, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read e2e/fixtures/ directory: ${err.message}`);
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/**
 * Read the `ALL_FIXTURES` array literal from playwright.config.ts via a
 * targeted regex (not a full TS parse — this is a single well-known array
 * declaration, same lightweight-parsing approach check-b4push-ci-parity.mjs
 * uses for its guard-region markers).
 */
function readPlaywrightFixtures() {
  let src;
  try {
    src = readFileSync(PLAYWRIGHT_CONFIG_PATH, "utf8");
  } catch (err) {
    throw new Error(`Cannot read playwright.config.ts: ${err.message}`);
  }
  const m = src.match(/const\s+ALL_FIXTURES\s*=\s*\[([\s\S]*?)\]/);
  if (!m) {
    throw new Error(
      "Cannot find `const ALL_FIXTURES = [...]` in playwright.config.ts — " +
        "update the regex in scripts/check-e2e-spec-naming.mjs if the declaration shape changed.",
    );
  }
  return [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((mm) => mm[1]).sort();
}

const ALLOWLIST_PATH = resolve(ROOT, ".check-e2e-spec-naming-allowlist");

/** Read the allowlist. Returns a Set of allowed relative paths (from repo root). */
function readAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return new Set();
  return new Set(
    readFileSync(ALLOWLIST_PATH, "utf8")
      .split("\n")
      .map((line) => line.trim())
      // Strip inline comments (e.g. "path/foo.spec.ts  # reason: ...")
      .map((line) => line.replace(/\s*#.*$/, "").trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );
}

/**
 * Find all git-TRACKED *.spec.ts files in the repo.
 * Tracked-only scanning respects .gitignore, so build output, nested
 * node_modules, and scratch dirs (e.g. __inbox/) never trip the guard.
 * Returns paths relative to ROOT.
 */
function findSpecFiles() {
  const out = execFileSync("git", ["ls-files", "*.spec.ts", "**/*.spec.ts"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return out.split("\n").filter((line) => line.length > 0);
}

/**
 * Find all git-TRACKED e2e/**\/*.spec.ts files, excluding e2e/fixtures/**
 * (fixture content, not specs). Recursive — a spec nested in a subdirectory
 * is just as silently orphaned from Playwright's testMatch as a top-level
 * one, so rule (a) below must not be limited to the top-level directory.
 * Returns paths relative to ROOT.
 */
function findE2eSpecFiles() {
  const out = execFileSync("git", ["ls-files", "e2e/*.spec.ts", "e2e/**/*.spec.ts"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .filter((relPath) => !relPath.startsWith("e2e/fixtures/"));
}

function main() {
  const errors = [];
  const allowlist = readAllowlist();

  // ── Rule (c): e2e/fixtures/ dirs ↔ playwright.config.ts ALL_FIXTURES ───────
  // Must run before rule (a) — it produces KNOWN_PREFIXES.
  const fixtureDirNames = readFixtureDirNames();
  const playwrightFixtures = readPlaywrightFixtures();
  const dirSet = new Set(fixtureDirNames);
  const configSet = new Set(playwrightFixtures);
  const dirOnly = fixtureDirNames.filter((n) => !configSet.has(n));
  const configOnly = playwrightFixtures.filter((n) => !dirSet.has(n));

  if (dirOnly.length > 0 || configOnly.length > 0) {
    errors.push(
      `[rule-c] e2e/fixtures/ directories and playwright.config.ts's ALL_FIXTURES have drifted apart.\n` +
        (dirOnly.length > 0
          ? `  Directory exists but no Playwright project: ${dirOnly.join(", ")}\n`
          : "") +
        (configOnly.length > 0
          ? `  Playwright project exists but no directory: ${configOnly.join(", ")}\n`
          : "") +
        `  Fix: add the missing fixture directory under e2e/fixtures/, or add/remove the\n` +
        `       corresponding entry in ALL_FIXTURES in playwright.config.ts, so both stay in sync.`,
    );
  }

  // KNOWN_PREFIXES is the intersection — only prefixes verified valid in
  // BOTH sources allow a spec through rule (a) below.
  const KNOWN_PREFIXES = fixtureDirNames.filter((n) => configSet.has(n)).sort();

  // ── Rule (a): e2e/**/*.spec.ts must start with a known fixture prefix ──────
  // Recursive (git ls-files), excluding e2e/fixtures/ — a spec nested in a
  // subdirectory would otherwise match no Playwright project and never run,
  // exactly as silently as a misnamed top-level file (#2538).
  const e2eSpecFiles = findE2eSpecFiles();

  for (const relPath of e2eSpecFiles) {
    const name = basename(relPath);
    const hasKnownPrefix = KNOWN_PREFIXES.some((prefix) => name.startsWith(prefix));
    if (!hasKnownPrefix) {
      errors.push(
        `[rule-a] ${relPath}: filename does not start with a known fixture prefix.\n` +
          `  Known prefixes: ${KNOWN_PREFIXES.join(" | ")}\n` +
          `  Fix: rename the file to start with one of the above prefixes, or wire up a new\n` +
          `       fixture (directory under e2e/fixtures/ AND an entry in ALL_FIXTURES in\n` +
          `       playwright.config.ts — KNOWN_PREFIXES only counts prefixes present in both).`,
      );
    }
  }

  // ── Rule (b): no tracked *.spec.ts outside e2e/ unless allowlisted ─────────
  const repoSpecs = findSpecFiles().filter((p) => !p.startsWith("e2e/"));

  for (const specPath of repoSpecs) {
    if (!allowlist.has(specPath)) {
      errors.push(
        `[rule-b] ${specPath}: spec file found outside e2e/ and not in allowlist.\n` +
          `  Fix: move the spec into e2e/ with a fixture-prefixed name, OR add it to\n` +
          `       .check-e2e-spec-naming-allowlist with a "# reason:" comment explaining\n` +
          `       why it lives outside e2e/.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("");
    console.error(
      "E2E spec naming guard FAILED — spec file(s) violate naming or location rules:",
    );
    console.error("");
    for (const err of errors) {
      console.error(err);
      console.error("");
    }
    console.error(
      "See scripts/check-e2e-spec-naming.mjs for rule definitions.",
    );
    return 1;
  }

  console.log(
    `OK — E2E spec naming guard passed. ${e2eSpecFiles.length} e2e/**/*.spec.ts file(s) (excluding fixtures) all have known prefixes.` +
      (repoSpecs.length > 0
        ? ` ${repoSpecs.length} allowlisted spec(s) outside e2e/ verified.`
        : " No spec files outside e2e/."),
  );
  return 0;
}

process.exit(main());
