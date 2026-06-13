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
//   (a) Every `e2e/*.spec.ts` filename starts with a known fixture prefix:
//       sidebar | i18n | theme | smoke | versioning
//   (b) No `*.spec.ts` files exist outside `e2e/` except those listed in
//       .check-e2e-spec-naming-allowlist with a why-comment.
//
// Usage: node scripts/check-e2e-spec-naming.mjs
// Exit 0 = all OK. Exit 1 = violation(s) detected.
//
// Wired into:
//   - scripts/run-b4push.sh (guard step — inside marker region)
//   - .github/workflows/pr-checks.yml (lightweight pure-Node job)

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Known fixture prefixes — must match the Playwright project names in
// playwright.config.ts (the `testMatch` pattern is `${name}*.spec.ts`).
// Keep this list in sync with the actual fixtures in e2e/fixtures/.
const KNOWN_PREFIXES = ["sidebar", "i18n", "theme", "smoke", "versioning"];

const ALLOWLIST_PATH = resolve(ROOT, ".check-e2e-spec-naming-allowlist");
const E2E_DIR = resolve(ROOT, "e2e");

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
 * Recursively find all *.spec.ts files under the given directory.
 * Returns paths relative to ROOT.
 */
function findSpecFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSpecFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      results.push(fullPath.slice(ROOT.length + 1)); // relative to repo root
    }
  }
  return results;
}

function main() {
  const errors = [];
  const allowlist = readAllowlist();

  // ── Rule (a): e2e/*.spec.ts must start with a known fixture prefix ──────────
  // Only checks the top-level e2e/ directory (not subdirectories — sub-dirs are
  // fixture content, not specs).
  let e2eEntries;
  try {
    e2eEntries = readdirSync(E2E_DIR, { withFileTypes: true });
  } catch (err) {
    errors.push(`Cannot read e2e/ directory: ${err.message}`);
    e2eEntries = [];
  }

  for (const entry of e2eEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".spec.ts")) continue;
    const hasKnownPrefix = KNOWN_PREFIXES.some((prefix) =>
      entry.name.startsWith(prefix),
    );
    if (!hasKnownPrefix) {
      errors.push(
        `[rule-a] e2e/${entry.name}: filename does not start with a known fixture prefix.\n` +
          `  Known prefixes: ${KNOWN_PREFIXES.join(" | ")}\n` +
          `  Fix: rename the file to start with one of the above prefixes, or add a new\n` +
          `       prefix to KNOWN_PREFIXES in scripts/check-e2e-spec-naming.mjs if a new\n` +
          `       fixture has been added.`,
      );
    }
  }

  // ── Rule (b): no *.spec.ts outside e2e/ unless allowlisted ─────────────────
  // Scan the full repo tree for spec files, excluding e2e/ itself.
  const allSpecs = findSpecFiles(ROOT).filter(
    (p) => !p.startsWith("e2e/") && !p.startsWith("node_modules/"),
  );

  // Also skip worktrees/ — child worktrees may have their own e2e copies.
  const repoSpecs = allSpecs.filter((p) => !p.startsWith("worktrees/"));

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

  const e2eSpecCount = e2eEntries.filter(
    (e) => e.isFile() && e.name.endsWith(".spec.ts"),
  ).length;
  console.log(
    `OK — E2E spec naming guard passed. ${e2eSpecCount} e2e/*.spec.ts file(s) all have known prefixes.` +
      (repoSpecs.length > 0
        ? ` ${repoSpecs.length} allowlisted spec(s) outside e2e/ verified.`
        : " No spec files outside e2e/."),
  );
  return 0;
}

process.exit(main());
