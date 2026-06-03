#!/usr/bin/env node
// scripts/check-pin-parity.mjs
//
// Pin-parity gate (W4A — #1732). Failure mode:
//   "W1A §5#4 — three pin sources, only one bumped"
//
// The same upstream version of @takazudo/zfb (and @takazudo/zfb-runtime)
// is pinned in THREE places that must stay in lockstep:
//
//   1. Root package.json `dependencies["@takazudo/zfb"]`
//      (what this repo builds against)
//   2. Root package.json `dependencies["@takazudo/zfb-runtime"]`
//   3. packages/create-zudo-doc/src/scaffold.ts — the literal version
//      strings emitted into the generated downstream package.json by
//      `generatePackageJson()`. A fresh scaffold gets EXACTLY this version.
//
// Historically, bumping #1/#2 (e.g. via `pnpm up @takazudo/zfb@latest`)
// silently left #3 stale, so newly scaffolded projects shipped with an
// older zfb than the showcase site they were modeled on. This script
// makes that drift a CI/b4push error.
//
// Also checks internal @takazudo/zudo-doc* pins (#1850 / #1854): the scaffold
// emits pins for this repo's own packages; they must match the root version.
//
// Wired into:
//   - scripts/run-b4push.sh (Step 2.5, cheap pre-typecheck check)
//   - .github/workflows/pr-checks.yml (own lightweight job)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..");

const ROOT_PKG_PATH = resolve(ROOT_DIR, "package.json");
const SCAFFOLD_TS_PATH = resolve(
  ROOT_DIR,
  "packages/create-zudo-doc/src/scaffold.ts",
);

// External upstream packages: scaffold pin must equal root dependencies[pkg].
const PINNED_PACKAGES = [
  "@takazudo/zfb",
  "@takazudo/zfb-runtime",
  "@takazudo/zfb-adapter-cloudflare",
];

// Internal packages published from this monorepo: scaffold pin (caret/tilde
// stripped) must equal root package.json `version` (the lockstep release
// version). These are NOT in root dependencies — they ARE root.
//
// Cross-reference: scripts/release-create-zudo-doc.sh Step 2c (colon form)
// and Step 2d (bracket-assignment form) are the source of truth that WRITES
// these pins on every release bump. Keep this list in sync with those steps
// so any future 3rd internal pin gets guarded here too.
const INTERNAL_PINNED_PACKAGES = [
  "@takazudo/zudo-doc",
  "@takazudo/zudo-doc-history-server",
];

/**
 * Extract the literal version string for `pkgName` from scaffold.ts.
 *
 * scaffold.ts uses two forms for package pins:
 *   Colon form (object literal):
 *     "@takazudo/zudo-doc": "^0.2.0-next.1",
 *   Bracket-assignment form:
 *     deps["@takazudo/zudo-doc-history-server"] = "^0.2.0-next.1";
 *
 * The regex handles both by accepting either `:` or `] =` as the separator.
 * The closing quote immediately after the key name is what prevents
 * `@takazudo/zudo-doc` from matching inside `@takazudo/zudo-doc-history-server`
 * (no closing quote follows `zudo-doc` in the longer name).
 */
function readScaffoldPin(scaffoldSrc, pkgName) {
  const escaped = pkgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `["']${escaped}["']\\s*(?::|\\]\\s*=)\\s*["']([^"']+)["']`,
  );
  const match = scaffoldSrc.match(re);
  return match ? match[1] : null;
}

function main() {
  const rootPkg = JSON.parse(readFileSync(ROOT_PKG_PATH, "utf-8"));
  const scaffoldSrc = readFileSync(SCAFFOLD_TS_PATH, "utf-8");

  const mismatches = [];

  // ── External pins: scaffold literal must equal root dependencies[pkg] ──────
  for (const pkgName of PINNED_PACKAGES) {
    const rootPin = rootPkg.dependencies?.[pkgName];
    const scaffoldPin = readScaffoldPin(scaffoldSrc, pkgName);

    if (rootPin === undefined) {
      mismatches.push({
        pkg: pkgName,
        reason: `Missing in root package.json dependencies`,
        rootPin,
        scaffoldPin,
        kind: "external",
      });
      continue;
    }
    if (scaffoldPin === null) {
      mismatches.push({
        pkg: pkgName,
        reason: `Missing in packages/create-zudo-doc/src/scaffold.ts (could not locate the literal pin line)`,
        rootPin,
        scaffoldPin,
        kind: "external",
      });
      continue;
    }
    if (rootPin !== scaffoldPin) {
      mismatches.push({
        pkg: pkgName,
        reason: `Pin drift between root and scaffold.ts`,
        rootPin,
        scaffoldPin,
        kind: "external",
      });
    }
  }

  // ── Internal pins: scaffold pin (stripped) must equal root version ─────────
  const releaseVersion = rootPkg.version;
  for (const pkgName of INTERNAL_PINNED_PACKAGES) {
    const scaffoldPin = readScaffoldPin(scaffoldSrc, pkgName);

    if (scaffoldPin === null) {
      mismatches.push({
        pkg: pkgName,
        reason: `Missing in packages/create-zudo-doc/src/scaffold.ts (could not locate the literal pin line)`,
        rootPin: releaseVersion,
        scaffoldPin,
        kind: "internal",
      });
      continue;
    }
    const strippedPin = scaffoldPin.replace(/^[\^~]/, "");
    if (strippedPin !== releaseVersion) {
      mismatches.push({
        pkg: pkgName,
        reason: `Internal pin drift — scaffold emits ${scaffoldPin} but release version is ${releaseVersion}`,
        rootPin: releaseVersion,
        scaffoldPin,
        kind: "internal",
      });
    }
  }

  if (mismatches.length === 0) {
    console.log(
      `OK — pin parity verified for ${PINNED_PACKAGES.length} external + ${INTERNAL_PINNED_PACKAGES.length} internal package(s):`,
    );
    for (const pkgName of PINNED_PACKAGES) {
      console.log(`  ${pkgName} = ${rootPkg.dependencies[pkgName]}`);
    }
    for (const pkgName of INTERNAL_PINNED_PACKAGES) {
      const scaffoldPin = readScaffoldPin(scaffoldSrc, pkgName);
      console.log(
        `  ${pkgName} = ${scaffoldPin} (matches release ${releaseVersion})`,
      );
    }
    return 0;
  }

  console.error("");
  console.error(
    "Pin parity check FAILED — failure mode: W1A §5#4 (three pin sources, only one bumped).",
  );
  console.error("");
  for (const m of mismatches) {
    if (m.kind === "external") {
      console.error(`  [${m.pkg}]  ${m.reason}`);
      console.error(`    root dependencies: ${m.rootPin ?? "(missing)"}`);
      console.error(`    scaffold.ts:       ${m.scaffoldPin ?? "(missing)"}`);
    } else {
      console.error(`  [${m.pkg}]  ${m.reason}`);
      console.error(`    expected (release version): ${m.rootPin}`);
      console.error(`    scaffold.ts:                ${m.scaffoldPin ?? "(missing)"}`);
    }
    console.error("");
  }
  console.error("Fix — align the pin(s) in:");
  console.error(`  - ${ROOT_PKG_PATH}`);
  console.error(
    `      external pins live in "dependencies"; the internal release version is the "version" field`,
  );
  console.error(`  - ${SCAFFOLD_TS_PATH}`);
  console.error("then re-run this check.");
  return 1;
}

process.exit(main());
