#!/usr/bin/env node
// scripts/check-pin-parity.mjs
//
// Pin-parity gate (W4A — #1732). Failure mode:
//   "W1A §5#4 — pin sources out of lockstep"
//
// The same upstream version of @takazudo/zfb (and @takazudo/zfb-runtime)
// is pinned in FIVE places that must stay in lockstep:
//
//   1. Root package.json `dependencies["@takazudo/zfb"]`
//      (what this repo builds against)
//   2. Root package.json `dependencies["@takazudo/zfb-runtime"]`
//   3. packages/create-zudo-doc/src/scaffold.ts — the literal version
//      strings emitted into the generated downstream package.json by
//      `generatePackageJson()`. A fresh scaffold gets EXACTLY this version.
//   4. packages/zudo-doc/package.json `devDependencies["@takazudo/zfb"]`
//      and `["@takazudo/zfb-runtime"]` — exact-equal to the root pins
//      (used to build the package locally against the exact same version)
//   5. packages/zudo-doc/package.json `peerDependencies["@takazudo/zfb"]`
//      and `["@takazudo/zfb-runtime"]` — must be `^<root pin>`
//      (root pins are exact, e.g. "0.1.0-next.28", so ^ is prepended directly)
//
// Historically, bumping #1/#2 (e.g. via `pnpm up @takazudo/zfb@latest`)
// silently left #3/#4/#5 stale. This script makes that drift a CI/b4push error.
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
const ZUDO_DOC_PKG_PATH = resolve(ROOT_DIR, "packages/zudo-doc/package.json");

// External upstream packages: scaffold pin must equal root dependencies[pkg].
// @takazudo/zdtp is included here so the scaffold's emitted zdtp pin is
// parity-checked against root dependencies — same staleness class as #2381 / #2445.
const PINNED_PACKAGES = [
  "@takazudo/zfb",
  "@takazudo/zfb-runtime",
  "@takazudo/zfb-adapter-cloudflare",
  "@takazudo/zdtp",
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

// packages/zudo-doc/package.json carries zfb pins in two fields:
//   devDependencies — exact-equal to the root pin (build-time version)
//   peerDependencies — ^<root pin> (downstream compatibility range)
// Note: @takazudo/zfb-adapter-cloudflare is NOT in packages/zudo-doc — only these two.
const ZUDO_DOC_ZFB_PACKAGES = ["@takazudo/zfb", "@takazudo/zfb-runtime"];

// First-party peer floors in packages/zudo-doc/package.json peerDependencies.
// These peers were previously unguarded and went stale on the 2.0.1 major bump
// (#2381 / #2445). Adding them here catches the same staleness class whenever
// the version or an external pin changes.
//
// Source-of-truth distinction:
//   lockstep  — co-released with this repo; source = root package.json `version`
//   pinned    — external dep pinned in root `dependencies`; source = that dep string
//
// Insurance: both sources are exact strings today (no leading ^/~). The check
// below rejects a future ranged source value that would produce a malformed `^^…`
// expected peer, making the breakage loud rather than silently wrong.
const FIRST_PARTY_PEER_CHECKS = [
  {
    pkg: "@takazudo/zudo-doc-history-server",
    sourceKind: "lockstep (root version)",
    // Released at the same lockstep version as the root package.
    getSource: (rootPkg) => rootPkg.version,
  },
  {
    pkg: "@takazudo/zdtp",
    sourceKind: 'pinned (root dependencies["@takazudo/zdtp"])',
    // External dependency pinned in root dependencies — NOT lockstep.
    getSource: (rootPkg) => rootPkg.dependencies?.["@takazudo/zdtp"],
  },
];

/**
 * Extract the literal version string for `pkgName` from scaffold.ts.
 *
 * scaffold.ts uses three forms for package pins:
 *   Colon form (object literal):
 *     "@takazudo/zudo-doc": "^0.2.0-next.1",
 *   Bracket-assignment form:
 *     deps["@takazudo/zudo-doc-history-server"] = "^0.2.0-next.1";
 *   Constant-reference form (C1 #2362 — the pin is hoisted to a module
 *   constant so the dep pin and the `.zudo-doc.json` provenance seed can't
 *   drift):
 *     export const ZUDO_DOC_PIN = "^0.2.22";
 *     ...
 *     "@takazudo/zudo-doc": ZUDO_DOC_PIN,
 *
 * The first regex handles the two literal forms by accepting either `:` or
 * `] =` as the separator. The closing quote immediately after the key name is
 * what prevents `@takazudo/zudo-doc` from matching inside
 * `@takazudo/zudo-doc-history-server` (no closing quote follows `zudo-doc` in
 * the longer name). When the value is a bare identifier instead of a quoted
 * literal, we resolve that identifier's `const NAME = "..."` declaration.
 */
function readScaffoldPin(scaffoldSrc, pkgName) {
  const escaped = pkgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `["']${escaped}["']\\s*(?::|\\]\\s*=)\\s*["']([^"']+)["']`,
  );
  const match = scaffoldSrc.match(re);
  if (match) return match[1];

  // Constant-reference form: `"<pkg>": IDENTIFIER` / `deps["<pkg>"] = IDENTIFIER`.
  // Resolve IDENTIFIER to its `const IDENTIFIER = "<literal>";` declaration.
  const refRe = new RegExp(
    `["']${escaped}["']\\s*(?::|\\]\\s*=)\\s*([A-Za-z_$][A-Za-z0-9_$]*)`,
  );
  const refMatch = scaffoldSrc.match(refRe);
  if (!refMatch) return null;
  const constRe = new RegExp(
    `\\b${refMatch[1]}\\s*=\\s*["']([^"']+)["']`,
  );
  const constMatch = scaffoldSrc.match(constRe);
  return constMatch ? constMatch[1] : null;
}

function main() {
  const rootPkg = JSON.parse(readFileSync(ROOT_PKG_PATH, "utf-8"));
  const scaffoldSrc = readFileSync(SCAFFOLD_TS_PATH, "utf-8");
  const zudoDocPkg = JSON.parse(readFileSync(ZUDO_DOC_PKG_PATH, "utf-8"));

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

  // ── packages/zudo-doc pins: devDependencies exact + peerDependencies ^ ──────
  for (const pkgName of ZUDO_DOC_ZFB_PACKAGES) {
    const rootPin = rootPkg.dependencies?.[pkgName];
    const devPin = zudoDocPkg.devDependencies?.[pkgName];
    const peerPin = zudoDocPkg.peerDependencies?.[pkgName];
    const expectedPeerPin = rootPin !== undefined ? `^${rootPin}` : undefined;

    if (rootPin === undefined) {
      // Reported by the external pins loop above; skip here to avoid duplicate.
      continue;
    }

    if (devPin === undefined) {
      mismatches.push({
        pkg: pkgName,
        reason: `Missing in packages/zudo-doc/package.json devDependencies`,
        expected: rootPin,
        actual: "(missing)",
        file: ZUDO_DOC_PKG_PATH,
        field: "devDependencies",
        kind: "workspace-package",
      });
    } else if (devPin !== rootPin) {
      mismatches.push({
        pkg: pkgName,
        reason: `Pin drift in packages/zudo-doc/package.json devDependencies`,
        expected: rootPin,
        actual: devPin,
        file: ZUDO_DOC_PKG_PATH,
        field: "devDependencies",
        kind: "workspace-package",
      });
    }

    if (peerPin === undefined) {
      mismatches.push({
        pkg: pkgName,
        reason: `Missing in packages/zudo-doc/package.json peerDependencies`,
        expected: expectedPeerPin,
        actual: "(missing)",
        file: ZUDO_DOC_PKG_PATH,
        field: "peerDependencies",
        kind: "workspace-package",
      });
    } else if (peerPin !== expectedPeerPin) {
      mismatches.push({
        pkg: pkgName,
        reason: `Pin drift in packages/zudo-doc/package.json peerDependencies`,
        expected: expectedPeerPin,
        actual: peerPin,
        file: ZUDO_DOC_PKG_PATH,
        field: "peerDependencies",
        kind: "workspace-package",
      });
    }
  }

  // ── First-party peer floors in packages/zudo-doc peerDependencies ────────────
  // Guards the recurrence class from #2381 / #2445: the zfb ZUDO_DOC_ZFB_PACKAGES
  // loop above only covers the zfb pair; these two first-party peers were unguarded
  // and went stale on the 2.0.1 major bump. This block catches the same pattern.
  for (const { pkg, sourceKind, getSource } of FIRST_PARTY_PEER_CHECKS) {
    const sourceValue = getSource(rootPkg);

    if (!sourceValue) {
      mismatches.push({
        pkg,
        reason: `Source value not found — ${sourceKind}`,
        expected: "(could not determine)",
        actual: zudoDocPkg.peerDependencies?.[pkg] ?? "(missing)",
        file: ZUDO_DOC_PKG_PATH,
        field: "peerDependencies",
        kind: "first-party-peer",
      });
      continue;
    }

    // Insurance: assert source is an exact string with no leading ^/~.
    // Today both lockstep (root version) and pinned (root dependencies) sources
    // are bare version strings. A future change that makes one a range would
    // produce a malformed `^^…` expected peer — fail loudly instead.
    if (/^[\^~]/.test(sourceValue)) {
      mismatches.push({
        pkg,
        reason: `Source value ${JSON.stringify(sourceValue)} has a leading ^/~ (${sourceKind}) — cannot derive a clean expected peer; fix the source to be an exact string`,
        expected: `^${sourceValue} (MALFORMED — double-caret)`,
        actual: zudoDocPkg.peerDependencies?.[pkg] ?? "(missing)",
        file: ZUDO_DOC_PKG_PATH,
        field: "peerDependencies",
        kind: "first-party-peer",
      });
      continue;
    }

    const expectedPeer = `^${sourceValue}`;
    const actualPeer = zudoDocPkg.peerDependencies?.[pkg];

    if (actualPeer !== expectedPeer) {
      mismatches.push({
        pkg,
        reason: `First-party peer floor drift — stale floor will reject the current ${sourceKind} (#2381 / #2445)`,
        expected: expectedPeer,
        actual: actualPeer ?? "(missing)",
        file: ZUDO_DOC_PKG_PATH,
        field: "peerDependencies",
        kind: "first-party-peer",
      });
    }
  }

  if (mismatches.length === 0) {
    console.log(
      `OK — pin parity verified for ${PINNED_PACKAGES.length} external + ${INTERNAL_PINNED_PACKAGES.length} internal + ${ZUDO_DOC_ZFB_PACKAGES.length * 2} workspace-package field(s) + ${FIRST_PARTY_PEER_CHECKS.length} first-party peer floor(s):`,
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
    for (const pkgName of ZUDO_DOC_ZFB_PACKAGES) {
      const rootPin = rootPkg.dependencies[pkgName];
      console.log(
        `  packages/zudo-doc devDependencies[${pkgName}] = ${zudoDocPkg.devDependencies?.[pkgName]} (exact)`,
      );
      console.log(
        `  packages/zudo-doc peerDependencies[${pkgName}] = ${zudoDocPkg.peerDependencies?.[pkgName]} (^${rootPin})`,
      );
    }
    for (const { pkg, getSource } of FIRST_PARTY_PEER_CHECKS) {
      const sourceValue = getSource(rootPkg);
      console.log(
        `  packages/zudo-doc peerDependencies[${pkg}] = ${zudoDocPkg.peerDependencies?.[pkg]} (matched ^${sourceValue})`,
      );
    }
    return 0;
  }

  console.error("");
  console.error(
    "Pin parity check FAILED — failure mode: W1A §5#4 (pin sources out of lockstep).",
  );
  console.error("");
  for (const m of mismatches) {
    if (m.kind === "external") {
      console.error(`  [${m.pkg}]  ${m.reason}`);
      console.error(`    root dependencies: ${m.rootPin ?? "(missing)"}`);
      console.error(`    scaffold.ts:       ${m.scaffoldPin ?? "(missing)"}`);
    } else if (m.kind === "internal") {
      console.error(`  [${m.pkg}]  ${m.reason}`);
      console.error(`    expected (release version): ${m.rootPin}`);
      console.error(`    scaffold.ts:                ${m.scaffoldPin ?? "(missing)"}`);
    } else if (m.kind === "first-party-peer") {
      console.error(`  [${m.pkg}]  ${m.reason}`);
      console.error(`    file:     ${m.file}`);
      console.error(`    field:    ${m.field}`);
      console.error(`    expected: ${m.expected}`);
      console.error(`    actual:   ${m.actual}`);
    } else {
      // workspace-package
      console.error(`  [${m.pkg}]  ${m.reason}`);
      console.error(`    file:     ${m.file}`);
      console.error(`    field:    ${m.field}`);
      console.error(`    expected: ${m.expected}`);
      console.error(`    actual:   ${m.actual}`);
    }
    console.error("");
  }
  console.error("Fix — align the pin(s) in:");
  console.error(`  - ${ROOT_PKG_PATH}`);
  console.error(
    `      external pins live in "dependencies"; the internal release version is the "version" field`,
  );
  console.error(`  - ${SCAFFOLD_TS_PATH}`);
  console.error(`  - ${ZUDO_DOC_PKG_PATH}`);
  console.error(
    `      devDependencies must be exact-equal to root pins; peerDependencies must be ^<root pin>`,
  );
  console.error("then re-run this check.");
  return 1;
}

process.exit(main());
