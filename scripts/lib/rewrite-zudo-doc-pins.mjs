#!/usr/bin/env node
// scripts/lib/rewrite-zudo-doc-pins.mjs
//
// Lockstep rewrite of every place the released @takazudo/zudo-doc version is
// spelled out as a literal (#3306). Two surfaces move together:
//
//   1. packages/create-zudo-doc/src/scaffold.ts — the exported `ZUDO_DOC_PIN`
//      constant, which is the pin a fresh scaffold emits into the generated
//      downstream package.json.
//   2. packages/zudo-doc/src/__tests__/fixtures/target-manifest/package.json —
//      the fixture documented as mirroring "the PUBLISHED shape a real
//      create-zudo-doc consumer gets". Its pin is documentary (the slow test
//      extracts a packed tarball rather than resolving from the registry), so
//      nothing fails when it drifts — which is exactly why it silently fell a
//      full major behind between 4.5 and 5.1.1.
//
// WHY a module instead of a second inline `node -e` in the release script:
// the release path's failure mode is "the next release breaks", verifiable
// only by performing a release. Behind an importable seam that takes the repo
// root as a parameter, the same code the shell step runs is exercised by
// ordinary unit tests against a temp tree — permanent coverage instead of a
// one-off manual simulation. (scripts/check-pin-parity.mjs resolves its paths
// relative to its own location, which is what makes simulating the shell step
// against a scratch copy fragile; this helper deliberately does not.)
//
// Called by:
//   - scripts/release-create-zudo-doc.sh Step 2c (as a CLI, see the bottom)
//   - scripts/__tests__/rewrite-zudo-doc-pins.test.ts (as a module)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Path of the scaffold source, relative to the repo root. */
export const SCAFFOLD_TS_RELATIVE =
  "packages/create-zudo-doc/src/scaffold.ts";

/** Path of the target-manifest fixture, relative to the repo root. */
export const TARGET_MANIFEST_RELATIVE =
  "packages/zudo-doc/src/__tests__/fixtures/target-manifest/package.json";

/** The dependency key the fixture pins. */
export const ZUDO_DOC_PACKAGE = "@takazudo/zudo-doc";

// Matches the `ZUDO_DOC_PIN` declaration and captures the quotes around the
// version so the replacement rewrites only the literal. Tolerates both stable
// (^X.Y.Z) and prerelease (^X.Y.Z-next.N) forms, with or without the caret —
// carried over verbatim from the inline Step 2c regex it replaces.
const SCAFFOLD_PIN_RE =
  /(export const ZUDO_DOC_PIN\s*=\s*")\^?[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(")/;

// Same shape the release script validates before it gets this far: X.Y.Z with
// an optional prerelease suffix. An optional leading caret is accepted and
// normalized away, since the emitted pin always carries one.
const VERSION_RE = /^\^?([0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.]+)?)$/;

/**
 * Rewrite the @takazudo/zudo-doc pin in both lockstep surfaces.
 *
 * Throws (never silently no-ops) when either target is missing or does not
 * contain the pin it is supposed to carry — a silent no-op is precisely the
 * failure class this helper exists to remove.
 *
 * @param {object} options
 * @param {string} options.repoRoot - absolute path to the repository root
 * @param {string} options.version - target version, e.g. "5.2.0" or "5.2.0-next.1"
 * @returns {{ pin: string, files: string[] }} the emitted pin and the absolute
 *   paths of the files that were rewritten, in the order they were written
 */
export function rewriteZudoDocPins({ repoRoot, version } = {}) {
  if (!repoRoot) {
    throw new Error("rewriteZudoDocPins: repoRoot is required");
  }
  const versionMatch = VERSION_RE.exec(String(version ?? ""));
  if (!versionMatch) {
    throw new Error(
      `rewriteZudoDocPins: invalid version ${JSON.stringify(version)} — expected X.Y.Z or X.Y.Z-<prerelease>`,
    );
  }
  const pin = `^${versionMatch[1]}`;

  const scaffoldPath = resolve(repoRoot, SCAFFOLD_TS_RELATIVE);
  const manifestPath = resolve(repoRoot, TARGET_MANIFEST_RELATIVE);

  // Read and validate BOTH files before writing either, so a missing pin in
  // the second one cannot leave the tree half-rewritten.
  const scaffoldSource = readFileOrThrow(scaffoldPath);
  if (!SCAFFOLD_PIN_RE.test(scaffoldSource)) {
    throw new Error(
      `could not locate the ZUDO_DOC_PIN constant in ${scaffoldPath}`,
    );
  }

  const manifestRaw = readFileOrThrow(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (error) {
    throw new Error(
      `could not parse ${manifestPath} as JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    !manifest ||
    typeof manifest.dependencies !== "object" ||
    manifest.dependencies === null ||
    typeof manifest.dependencies[ZUDO_DOC_PACKAGE] !== "string"
  ) {
    throw new Error(
      `could not locate the ${ZUDO_DOC_PACKAGE} dependency in ${manifestPath}`,
    );
  }

  writeFileSync(scaffoldPath, scaffoldSource.replace(SCAFFOLD_PIN_RE, `$1${pin}$3`));

  manifest.dependencies[ZUDO_DOC_PACKAGE] = pin;
  // 2-space indent + trailing newline — the shape every other package.json
  // write in scripts/release-create-zudo-doc.sh produces.
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { pin, files: [scaffoldPath, manifestPath] };
}

/**
 * @param {string} path
 * @returns {string}
 */
function readFileOrThrow(path) {
  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    if (error instanceof Error && /** @type {any} */ (error).code === "ENOENT") {
      throw new Error(`could not find ${path}`);
    }
    throw error;
  }
}

/**
 * CLI entry — a thin argv parser over `rewriteZudoDocPins`, so the release
 * script and the unit tests exercise the same code.
 *
 * @param {string[]} argv
 * @returns {number} process exit code
 */
export function main(argv) {
  /** @type {Record<string, string>} */
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo-root" || arg === "--version") {
      const value = argv[i + 1];
      if (value === undefined) {
        console.error(`Error: ${arg} requires a value`);
        return usage();
      }
      flags[arg] = value;
      i += 1;
    } else {
      console.error(`Error: unknown argument ${arg}`);
      return usage();
    }
  }

  if (!flags["--repo-root"] || !flags["--version"]) {
    console.error("Error: both --repo-root and --version are required");
    return usage();
  }

  try {
    const { pin, files } = rewriteZudoDocPins({
      repoRoot: flags["--repo-root"],
      version: flags["--version"],
    });
    for (const file of files) {
      console.log(`  ✓ ${file} ${ZUDO_DOC_PACKAGE} → ${pin}`);
    }
    return 0;
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}

/** @returns {number} */
function usage() {
  console.error(
    "usage: node scripts/lib/rewrite-zudo-doc-pins.mjs --repo-root <dir> --version <X.Y.Z[-next.N]>",
  );
  return 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
