#!/usr/bin/env node
// check-fixture-settings-drift.mjs
//
// Verifies that every top-level key in src/config/settings.ts (canonical)
// is either present in each e2e fixture's settings.ts or explicitly listed
// in .fixture-settings-drift-allowlist.
//
// Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 7 #2663):
// `zfb.config.ts` now assembles config via the single `zudoDoc({...})` entry
// point (`@takazudo/zudo-doc/config`) instead of hand-building a `ZfbConfig`.
// The naive re-point implied by that shape change — parse the object literal
// passed to `zudoDoc(...)` in zfb.config.ts — does NOT work here: both the
// host's and every fixture's `zudoDoc({...})` call spreads an IMPORTED
// `settings` object (`...settings,`) plus a handful of shell-only fields that
// are not part of `Settings` at all (`chromeBindingsModule`, `port`,
// `adapter`, `bundle`, `tagVocabularyEntries`, `translations`). Those shell
// fields are copied byte-for-byte into every fixture's `zfb.config.ts` by
// `e2e/setup-fixtures.sh`, so diffing zfb.config.ts text would compare two
// always-identical files and catch nothing; the actual per-fixture Settings
// field names never appear as literal object keys in zfb.config.ts — they
// live behind the spread, in `settings.ts`. `src/config/settings.ts` SURVIVED
// the Wave 6 (#2661) minimal-scaffold cutover as a real showcase-owned data
// module (unlike the sibling shims it deleted — `settings-types.ts` et al. —
// which were byte-identical to package defaults); it is still spread
// wholesale into `zudoDoc({ ...settings, ... })`, so it remains the one place
// where individual Settings field names are literal object keys, in both the
// host and every fixture. So per the "pick the mechanically simplest faithful
// check" instruction, this script's canonical source stays
// `src/config/settings.ts` — unchanged, not a stale leftover.
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
const canonicalKeySet = new Set(canonicalKeys);
const fixtureSet = new Set(FIXTURES);
const allowed = loadAllowlist(resolve(ROOT, ALLOWLIST_PATH));

// Validate allowlist entries reference real fixtures and real canonical keys.
// A stale entry (fixture or key no longer exists) is reported as an error so
// the allowlist stays accurate rather than silently masking nothing.
let anyError = false;
for (const entry of allowed) {
  const colon = entry.indexOf(":");
  if (colon === -1) {
    console.error(`[fixture-settings-drift] bad allowlist entry (no colon): ${entry}`);
    anyError = true;
    continue;
  }
  const fixture = entry.slice(0, colon);
  const key = entry.slice(colon + 1);
  if (!fixtureSet.has(fixture)) {
    console.error(`[fixture-settings-drift] allowlist references unknown fixture: ${entry}`);
    anyError = true;
  }
  if (!canonicalKeySet.has(key)) {
    console.error(`[fixture-settings-drift] allowlist references unknown canonical key: ${entry}`);
    anyError = true;
  }
}

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
}

if (anyError || anyDrift) {
  process.exit(1);
} else {
  console.log("fixture-settings drift check passed.");
}
