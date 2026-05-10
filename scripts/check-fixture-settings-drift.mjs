#!/usr/bin/env node
// check-fixture-settings-drift.mjs
//
// Verifies that every top-level key in src/config/settings.ts (canonical)
// is either present in each e2e fixture's settings.ts or explicitly listed
// in .fixture-settings-drift-allowlist.
//
// Usage: node scripts/check-fixture-settings-drift.mjs
// Exit 0 = no unallowlisted drift. Exit 1 = drift detected.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const FIXTURES = ["sidebar", "i18n", "theme", "smoke", "versioning"];
const CANONICAL_PATH = "src/config/settings.ts";
const ALLOWLIST_PATH = ".fixture-settings-drift-allowlist";

/** Extract top-level keys from `export const settings = { ... }` block. */
function extractSettingsKeys(filePath) {
  const content = readFileSync(filePath, "utf8");
  const startMatch = content.match(/export const settings = \{/);
  if (!startMatch) {
    throw new Error(`No "export const settings = {" found in ${filePath}`);
  }
  const afterOpen = content.slice(
    (startMatch.index ?? 0) + startMatch[0].length
  );
  const keys = [];
  for (const line of afterOpen.split("\n")) {
    // Top-level key lines: exactly 2 spaces of indent, then word chars, then colon+space
    const m = line.match(/^  (\w+):\s/);
    if (m) keys.push(m[1]);
    // Stop at the closing of the top-level object literal
    if (line.match(/^\};/) || line.match(/^} (satisfies|as) /)) break;
  }
  return keys;
}

/** Load allowlist. Returns a Set of "fixture:key" strings. */
function loadAllowlist(allowlistPath) {
  let content;
  try {
    content = readFileSync(allowlistPath, "utf8");
  } catch {
    return new Set();
  }
  const allowed = new Set();
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    allowed.add(line);
  }
  return allowed;
}

const canonicalKeys = extractSettingsKeys(resolve(ROOT, CANONICAL_PATH));
const allowed = loadAllowlist(resolve(ROOT, ALLOWLIST_PATH));

let anyDrift = false;

for (const fixture of FIXTURES) {
  const fixturePath = resolve(
    ROOT,
    `e2e/fixtures/${fixture}/src/config/settings.ts`
  );
  const fixtureKeys = extractSettingsKeys(fixturePath);
  const fixtureKeySet = new Set(fixtureKeys);

  const missing = canonicalKeys.filter((k) => {
    if (fixtureKeySet.has(k)) return false;
    if (allowed.has(`${fixture}:${k}`)) return false;
    return true;
  });

  if (missing.length > 0) {
    anyDrift = true;
    console.error(`\n[fixture-settings-drift] ${fixture}:`);
    for (const key of missing) {
      console.error(`  missing key: ${key}`);
    }
  }
}

if (anyDrift) {
  console.error(
    "\nDrift detected. Add missing keys to all five fixtures, OR add an allowlist"
  );
  console.error(
    "entry to .fixture-settings-drift-allowlist (with # reason: comment)."
  );
  process.exit(1);
} else {
  console.log("fixture-settings drift check passed.");
}
