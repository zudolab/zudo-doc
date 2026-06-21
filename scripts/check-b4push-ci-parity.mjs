#!/usr/bin/env node
// scripts/check-b4push-ci-parity.mjs
//
// Guard-manifest meta-check: ensures that every lightweight guard gate in
// scripts/run-b4push.sh also has a corresponding job in CI (pr-checks.yml).
//
// MAINTENANCE CONTRACT
// ====================
// Adding a guard gate to scripts/run-b4push.sh means:
//   1. Add its b4push pnpm script name to REQUIRED_CI_GUARDS (b4pushScript).
//   2. Add a CI job (or step) running it, named with its ciNeedle string.
//   3. This script will then confirm both are wired.
//
// If a guard is intentionally CI-exempt (e.g. enforced by a pre-commit hook
// instead), add its b4push pnpm script name to .b4push-ci-parity-allowlist
// with a "# reason:" comment.
//
// Usage: node scripts/check-b4push-ci-parity.mjs
// Exit 0 = parity OK. Exit 1 = missing guard(s) detected.
//
// Wired into:
//   - scripts/run-b4push.sh (guard step — inside marker region)
//   - .github/workflows/pr-checks.yml (own lightweight pure-Node job)

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Required CI guards manifest ────────────────────────────────────────────
//
// Each entry carries TWO string forms:
//   ciNeedle     — substring searched in .github/workflows/pr-checks.yml
//                  (matches the `run:` line or script reference as it appears
//                  in YAML: file paths, hyphenated names, pnpm script tokens).
//   b4pushScript — exact pnpm script name as `pnpm <b4pushScript>` in the
//                  run-b4push.sh guard region (colon-delimited pnpm names).
//                  Set to null when the b4push step is a raw bash invocation
//                  (e.g. `bash scripts/...`) so the region parser never emits
//                  a token for it — a no-op miss, never a false alarm.
//
// Having separate forms is intentional: the YAML references hyphenated script
// paths while b4push invokes colon-delimited pnpm scripts. A single string
// would fail to match one direction on the clean tree.

const REQUIRED_CI_GUARDS = [
  {
    // Template drift: bash scripts/check-template-drift.sh in b4push; same in CI
    ciNeedle: "check-template-drift",
    b4pushScript: null, // raw bash invocation — not a pnpm script token
    comment: "Template drift check (scripts/check-template-drift.sh)",
  },
  {
    // Pin parity: node scripts/check-pin-parity.mjs (CI) / pnpm check:pin-parity (b4push)
    ciNeedle: "check-pin-parity.mjs",
    b4pushScript: "check:pin-parity",
    comment: "Pin parity check (W4A #1732)",
  },
  {
    // Fixture settings drift: node scripts/check-fixture-settings-drift.mjs (CI) / pnpm check:fixture-settings-drift (b4push)
    ciNeedle: "check-fixture-settings-drift.mjs",
    b4pushScript: "check:fixture-settings-drift",
    comment: "Fixture settings drift check (#1946)",
  },
  {
    // Tags audit: pnpm tags:audit --ci (both CI and b4push)
    ciNeedle: "tags:audit",
    b4pushScript: "tags:audit",
    comment: "Tags audit (tsx scripts/tags-audit.ts)",
  },
  {
    // Design token lint: pnpm lint:tokens (both CI and b4push)
    ciNeedle: "lint:tokens",
    b4pushScript: "lint:tokens",
    comment: "Design token lint",
  },
  {
    // Package safelist: node scripts/check-package-safelist.mjs (CI) / pnpm check:package-safelist (b4push)
    ciNeedle: "check-package-safelist.mjs",
    b4pushScript: "check:package-safelist",
    comment: "Package safelist drift check (#1982)",
  },
  {
    // This parity check itself — must also appear in CI
    ciNeedle: "check-b4push-ci-parity.mjs",
    b4pushScript: "check:b4push-ci-parity",
    comment: "B4push/CI parity meta-check (this script, #1967)",
  },
  {
    // E2E spec naming guard: asserts fixture-prefix + no orphan specs (#2095)
    ciNeedle: "check-e2e-spec-naming.mjs",
    b4pushScript: "check:e2e-spec-naming",
    comment: "E2E spec naming guard (scripts/check-e2e-spec-naming.mjs, #2095)",
  },
  {
    // Z-index codegen drift: node scripts/gen-z-index.mjs --check (CI) /
    // pnpm check:z-index (b4push). Fails if the generated @theme block in
    // src/styles/global.css drifts from src/config/z-index-tokens.ts (#2148).
    ciNeedle: "gen-z-index.mjs",
    b4pushScript: "check:z-index",
    comment: "Z-index codegen drift check (scripts/gen-z-index.mjs, #2148)",
  },
  {
    // @flaky/@local-only tracking-issue guard: asserts every @flaky and
    // @local-only tagged test has a GitHub issue URL comment on the preceding
    // line(s). Closes the enforcement gap where TESTING.md required the URL but
    // nothing mechanically checked for it (#2292).
    ciNeedle: "check-flaky-tracking-issue.mjs",
    b4pushScript: "check:flaky-tracking-issue",
    comment: "@flaky/@local-only tracking-issue guard (scripts/check-flaky-tracking-issue.mjs, #2292)",
  },
];

const ALLOWLIST_PATH = resolve(ROOT, ".b4push-ci-parity-allowlist");
const WORKFLOW_PATH = resolve(ROOT, ".github/workflows/pr-checks.yml");
const B4PUSH_PATH = resolve(ROOT, "scripts/run-b4push.sh");

// Open/close marker comments that delimit the lightweight guard region in
// scripts/run-b4push.sh. Only pnpm invocations inside this region are
// extracted — heavy steps (build, typecheck, e2e) are outside.
// Distinct open/close strings prevent a stray close-marker from accidentally
// matching the open-marker line (and vice versa) during parsing.
const REGION_OPEN_MARKER = "b4push-ci-parity:guards:begin";
const REGION_CLOSE_MARKER = "b4push-ci-parity:guards:end";

/** Read and parse the allowlist file. Returns a Set of allowed b4push script names. */
function readAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return new Set();
  return new Set(
    readFileSync(ALLOWLIST_PATH, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );
}

/**
 * Extract pnpm script tokens from the delimited guard region in run-b4push.sh.
 * Returns an array of pnpm script names (strings after `pnpm ` / `pnpm run `).
 * Ignores lines outside the markers; never throws on parse failure (returns []).
 */
function extractB4pushGuardRegion(src) {
  const lines = src.split("\n");
  let inRegion = false;
  const tokens = [];

  for (const line of lines) {
    if (!inRegion) {
      if (line.includes(`>>> ${REGION_OPEN_MARKER}`)) {
        inRegion = true;
      }
      continue;
    }
    if (line.includes(`<<< ${REGION_CLOSE_MARKER}`)) {
      break;
    }
    // Match: pnpm <script> or pnpm run <script>
    // Stop at first whitespace, ), ;, or end-of-line after the script name.
    const m = line.match(/\bpnpm(?:\s+run)?\s+([A-Za-z0-9:_-]+)/);
    if (m) {
      tokens.push(m[1]);
    }
  }

  return tokens;
}

/**
 * Strip YAML comment lines so ciNeedle substring checks only match
 * actual step definitions (run:, name:, etc.), not comment text.
 * Lines where the first non-whitespace character is '#' are removed.
 */
function stripYamlComments(src) {
  return src
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

function main() {
  const workflowSrc = stripYamlComments(readFileSync(WORKFLOW_PATH, "utf8"));
  const b4pushSrc = readFileSync(B4PUSH_PATH, "utf8");
  const allowlist = readAllowlist();

  const errors = [];

  // ── Direction 1: manifest → CI ────────────────────────────────────────────
  // Assert each required guard's ciNeedle appears in a non-comment workflow line.
  // Comments are stripped first so a guard removed from CI but still mentioned
  // in a header comment does NOT produce a false "present" result.
  for (const guard of REQUIRED_CI_GUARDS) {
    if (!workflowSrc.includes(guard.ciNeedle)) {
      errors.push(
        `[manifest→CI] Guard "${guard.comment}" must run in CI but is absent from pr-checks.yml\n` +
          `  Missing string: "${guard.ciNeedle}"\n` +
          `  Fix: add a job or step referencing "${guard.ciNeedle}" to .github/workflows/pr-checks.yml,\n` +
          `       or add "${guard.b4pushScript ?? guard.ciNeedle}" to .b4push-ci-parity-allowlist if CI-exempt.`,
      );
    }
  }

  // ── Direction 2: b4push region → manifest ────────────────────────────────
  // Extract pnpm tokens from the marker region and assert each is tracked.
  const knownB4pushScripts = new Set(
    REQUIRED_CI_GUARDS.map((g) => g.b4pushScript).filter(Boolean),
  );
  const regionTokens = extractB4pushGuardRegion(b4pushSrc);

  if (regionTokens.length === 0) {
    // No markers found or region is empty — warn but do not error.
    // The manifest→CI check is the load-bearing path; region parse is a helper.
    console.warn(
      `WARN: no pnpm tokens found in the ${REGION_OPEN_MARKER} region of run-b4push.sh.\n` +
        `  Check that the markers "# >>> ${REGION_OPEN_MARKER}" and "# <<< ${REGION_CLOSE_MARKER}" are present.`,
    );
  }

  for (const token of regionTokens) {
    if (!knownB4pushScripts.has(token) && !allowlist.has(token)) {
      errors.push(
        `[b4push→manifest] pnpm ${token} is in the run-b4push.sh guard region but is not in REQUIRED_CI_GUARDS or .b4push-ci-parity-allowlist.\n` +
          `  Fix: add an entry for "${token}" to REQUIRED_CI_GUARDS in scripts/check-b4push-ci-parity.mjs\n` +
          `       (with a matching CI job), or add "${token}" to .b4push-ci-parity-allowlist if CI-exempt.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("");
    console.error(
      "B4push/CI parity check FAILED — guard gate(s) not tracked in manifest or absent from CI:",
    );
    console.error("");
    for (const err of errors) {
      console.error(err);
      console.error("");
    }
    console.error(
      "MAINTENANCE CONTRACT: adding a guard gate to scripts/run-b4push.sh means adding it to",
    );
    console.error(
      "  REQUIRED_CI_GUARDS in scripts/check-b4push-ci-parity.mjs AND to .github/workflows/pr-checks.yml.",
    );
    return 1;
  }

  console.log(
    `OK — b4push/CI parity verified. ${REQUIRED_CI_GUARDS.length} required guards all present in CI.`,
  );
  if (regionTokens.length > 0) {
    console.log(
      `     Region cross-check: ${regionTokens.length} pnpm token(s) in run-b4push.sh guard region all tracked.`,
    );
  }
  return 0;
}

process.exit(main());
