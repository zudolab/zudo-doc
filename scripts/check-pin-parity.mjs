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

const PINNED_PACKAGES = ["@takazudo/zfb", "@takazudo/zfb-runtime"];

/**
 * Extract the literal version string for `pkgName` from scaffold.ts. The
 * scaffold.ts source has lines like:
 *   "@takazudo/zfb": "0.1.0-next.6",
 * We match the JSON-ish key/value pair anywhere in the file (the file is
 * TypeScript, not JSON, so we can't `JSON.parse` it).
 */
function readScaffoldPin(scaffoldSrc, pkgName) {
  const escaped = pkgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`["']${escaped}["']\\s*:\\s*["']([^"']+)["']`);
  const match = scaffoldSrc.match(re);
  return match ? match[1] : null;
}

function main() {
  const rootPkg = JSON.parse(readFileSync(ROOT_PKG_PATH, "utf-8"));
  const scaffoldSrc = readFileSync(SCAFFOLD_TS_PATH, "utf-8");

  const mismatches = [];

  for (const pkgName of PINNED_PACKAGES) {
    const rootPin = rootPkg.dependencies?.[pkgName];
    const scaffoldPin = readScaffoldPin(scaffoldSrc, pkgName);

    if (rootPin === undefined) {
      mismatches.push({
        pkg: pkgName,
        reason: `Missing in root package.json dependencies`,
        rootPin,
        scaffoldPin,
      });
      continue;
    }
    if (scaffoldPin === null) {
      mismatches.push({
        pkg: pkgName,
        reason: `Missing in packages/create-zudo-doc/src/scaffold.ts (could not locate the literal pin line)`,
        rootPin,
        scaffoldPin,
      });
      continue;
    }
    if (rootPin !== scaffoldPin) {
      mismatches.push({
        pkg: pkgName,
        reason: `Pin drift between root and scaffold.ts`,
        rootPin,
        scaffoldPin,
      });
    }
  }

  if (mismatches.length === 0) {
    console.log(
      `OK — pin parity verified for ${PINNED_PACKAGES.length} package(s):`,
    );
    for (const pkgName of PINNED_PACKAGES) {
      console.log(`  ${pkgName} = ${rootPkg.dependencies[pkgName]}`);
    }
    return 0;
  }

  console.error("");
  console.error(
    "Pin parity check FAILED — failure mode: W1A §5#4 (three pin sources, only one bumped).",
  );
  console.error("");
  console.error(
    "The same upstream version must be pinned identically in BOTH:",
  );
  console.error(`  - ${ROOT_PKG_PATH} (dependencies)`);
  console.error(`  - ${SCAFFOLD_TS_PATH} (generatePackageJson literals)`);
  console.error("");
  for (const m of mismatches) {
    console.error(`  [${m.pkg}]  ${m.reason}`);
    console.error(`    root:        ${m.rootPin ?? "(missing)"}`);
    console.error(`    scaffold.ts: ${m.scaffoldPin ?? "(missing)"}`);
    console.error("");
  }
  console.error(
    "Fix: align both sites to the intended version, then re-run this check.",
  );
  return 1;
}

process.exit(main());
