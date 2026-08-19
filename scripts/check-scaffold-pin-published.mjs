#!/usr/bin/env node
// scripts/check-scaffold-pin-published.mjs
//
// Verify that every internal package pin emitted by the scaffold has at least
// one published version in the npm registry that satisfies its caret range.
// This catches a release-ordering failure that a parity check cannot see:
// scaffold.ts can be updated to the next lockstep version before that version
// has actually been published.
//
// The registry lookup is injected into checkScaffoldPinPublished() so the pure
// check is network-free in tests. The command-line wrapper uses the abbreviated
// npm packument, which includes the complete versions map.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

import {
  INTERNAL_PINNED_PACKAGES,
  readScaffoldPin,
} from "./check-pin-parity.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..");
const SCAFFOLD_TS_PATH = resolve(
  ROOT_DIR,
  "packages/create-zudo-doc/src/scaffold.ts",
);

/** Per-request timeout for the real registry lookup. */
export const DEFAULT_TIMEOUT_MS = 10_000;

const REGISTRY_BASE = "https://registry.npmjs.org";
const REGISTRY_ACCEPT = "application/vnd.npm.install-v1+json";

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function compareNumericIdentifier(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function isNumericIdentifier(identifier) {
  return /^(?:0|[1-9]\d*)$/.test(identifier);
}

/**
 * Parse a complete semver version. Build metadata is accepted and ignored for
 * precedence, as required by semver. Returning null keeps malformed registry
 * entries and malformed scaffold ranges fail-closed rather than silently
 * matching them.
 */
export function parsePublishedVersion(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(SEMVER_RE);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function compareParsedVersions(a, b) {
  const core =
    a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  if (core !== 0) return core < 0 ? -1 : 1;

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const left = a.prerelease[index];
    const right = b.prerelease[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left === right) continue;

    const leftNumeric = isNumericIdentifier(left);
    const rightNumeric = isNumericIdentifier(right);
    if (leftNumeric && rightNumeric) {
      return compareNumericIdentifier(left, right);
    }
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return left < right ? -1 : 1;
  }
  return 0;
}

function parseCaretRange(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("^") || trimmed.length === 1) return null;
  const version = parsePublishedVersion(trimmed.slice(1));
  return version ? { floor: version } : null;
}

/**
 * Test one published version against an internal scaffold caret pin.
 *
 * This intentionally does not use check-pin-parity.mjs's satisfiesCaret():
 * that helper compares only numeric cores. Here prerelease identifiers are
 * significant. The behavior mirrors npm/pnpm semver resolution:
 *
 *   - A prerelease candidate is excluded unless the range itself has a
 *     prerelease comparator with the same major/minor/patch tuple.
 *   - Once opted into that prerelease tuple, identifiers are ordered locally
 *     according to semver (numeric identifiers before string identifiers,
 *     numeric comparison without Number overflow).
 *   - Stable releases satisfy a prerelease floor when they are otherwise in
 *     range (for example, 5.7.0 satisfies ^5.7.0-next.2).
 *
 * Returns null for a malformed/non-caret range so callers can report an
 * "unreadable-pin" finding instead of passing an invalid pin.
 */
export function satisfiesCaretPublished(version, caretRange) {
  const candidate = parsePublishedVersion(version);
  const range = parseCaretRange(caretRange);
  if (!candidate || !range) return null;

  const floor = range.floor;
  const candidateCore =
    candidate.major - floor.major ||
    candidate.minor - floor.minor ||
    candidate.patch - floor.patch;

  // npm's prerelease rule: a prerelease is eligible only when the range
  // carries a prerelease comparator for exactly this core tuple.
  if (
    candidate.prerelease.length > 0 &&
    (floor.prerelease.length === 0 || candidateCore !== 0)
  ) {
    return false;
  }

  if (compareParsedVersions(candidate, floor) < 0) return false;

  // Caret upper bounds are exclusive, including prereleases at the upper
  // boundary (e.g. 6.0.0-next.1 is outside ^5.7.0).
  let upper;
  if (floor.major > 0) {
    upper = { major: floor.major + 1, minor: 0, patch: 0 };
  } else if (floor.minor > 0) {
    upper = { major: 0, minor: floor.minor + 1, patch: 0 };
  } else {
    upper = { major: 0, minor: 0, patch: floor.patch + 1 };
  }
  if (
    candidate.major > upper.major ||
    (candidate.major === upper.major && candidate.minor > upper.minor) ||
    (candidate.major === upper.major &&
      candidate.minor === upper.minor &&
      candidate.patch >= upper.patch)
  ) {
    return false;
  }
  return true;
}

function publishedVersionsFromPackument(packument, pkgName) {
  if (
    !packument ||
    typeof packument !== "object" ||
    Array.isArray(packument) ||
    !packument.versions ||
    typeof packument.versions !== "object" ||
    Array.isArray(packument.versions)
  ) {
    throw new Error(
      `Registry response for ${pkgName} has no usable "versions" map`,
    );
  }

  const versionNames = Object.keys(packument.versions);
  if (versionNames.length === 0) {
    throw new Error(`Registry response for ${pkgName} has an empty "versions" map`);
  }

  const versions = versionNames.map((version) => {
    const parsed = parsePublishedVersion(version);
    if (!parsed) {
      throw new Error(
        `Registry response for ${pkgName} contains invalid published version ${JSON.stringify(version)}`,
      );
    }
    return { name: version, parsed };
  });
  return versions;
}

/**
 * Evaluate all internal scaffold pins using an injected packument lookup.
 * `fetchPackument(pkgName)` must resolve to an npm packument with a complete
 * `versions` map. Every lookup and malformed response fails closed.
 */
export async function checkScaffoldPinPublished({
  scaffoldSrc,
  packages = INTERNAL_PINNED_PACKAGES,
  fetchPackument,
}) {
  if (typeof fetchPackument !== "function") {
    throw new TypeError(
      "checkScaffoldPinPublished requires a fetchPackument(pkgName) function",
    );
  }

  const findings = [];
  for (const pkgName of packages) {
    const scaffoldPin = readScaffoldPin(scaffoldSrc, pkgName);
    const range = parseCaretRange(scaffoldPin);
    if (scaffoldPin === null || !range) {
      findings.push({
        kind: "unreadable-pin",
        pkg: pkgName,
        pin: scaffoldPin,
        message:
          scaffoldPin === null
            ? `Could not locate a literal pin for ${pkgName} in scaffold.ts.`
            : `Scaffold pin for ${pkgName} is not a valid caret semver range: ${JSON.stringify(scaffoldPin)}.`,
      });
      continue;
    }

    let versions;
    try {
      const packument = await fetchPackument(pkgName);
      versions = publishedVersionsFromPackument(packument, pkgName);
    } catch (error) {
      findings.push({
        kind: "lookup-error",
        pkg: pkgName,
        pin: scaffoldPin,
        message:
          `Registry lookup failed for ${pkgName} — treating as a gate ` +
          `failure (fail-closed): ${
            error instanceof Error ? error.message : String(error)
          }`,
      });
      continue;
    }

    const matching = versions
      .filter(({ parsed }) =>
        satisfiesCaretPublished(parsedToVersion(parsed), scaffoldPin),
      )
      .sort((a, b) => compareParsedVersions(b.parsed, a.parsed));

    if (matching.length === 0) {
      findings.push({
        kind: "unsatisfied",
        pkg: pkgName,
        pin: scaffoldPin,
        publishedVersions: versions.map(({ name }) => name),
        message:
          `${pkgName} scaffold pin ${scaffoldPin} is UNSATISFIED — no ` +
          `published registry version satisfies this range.`,
      });
      continue;
    }

    const publishedVersion = matching[0].name;
    findings.push({
      kind: "ok",
      pkg: pkgName,
      pin: scaffoldPin,
      publishedVersion,
      message:
        `${pkgName} scaffold pin ${scaffoldPin} is satisfied by published ` +
        `version ${publishedVersion}.`,
    });
  }

  return {
    ok: findings.every((finding) => finding.kind === "ok"),
    findings,
  };
}

// Reconstructing a parsed version for the public predicate keeps the registry
// scan's parsed representation private while preserving build metadata-free
// semver precedence. Packument keys are already complete validated versions,
// so this conversion cannot fail.
function parsedToVersion(parsed) {
  const core = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  return parsed.prerelease.length > 0
    ? `${core}-${parsed.prerelease.join(".")}`
    : core;
}

/** Real npm registry lookup, bounded so a release cannot hang indefinitely. */
async function fetchPackumentFromRegistry(
  pkgName,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const url = `${REGISTRY_BASE}/${encodeURIComponent(pkgName)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: REGISTRY_ACCEPT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `npm registry returned ${response.status} ${response.statusText} for ${pkgName}`,
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function formatFinding(finding) {
  const label =
    finding.kind === "ok"
      ? "OK     "
      : finding.kind === "unsatisfied"
        ? "UNSAT  "
        : finding.kind === "unreadable-pin"
          ? "ERROR  "
          : "ERROR  ";
  return `  ${label} ${finding.message}`;
}

async function main() {
  const scaffoldSrc = readFileSync(SCAFFOLD_TS_PATH, "utf-8");
  const result = await checkScaffoldPinPublished({
    scaffoldSrc,
    fetchPackument: (pkgName) => fetchPackumentFromRegistry(pkgName),
  });

  for (const finding of result.findings) console.log(formatFinding(finding));
  if (!result.ok) {
    console.error("");
    console.error("Scaffold published-pin check FAILED.");
    console.error(
      "  Every internal scaffold pin must have at least one published registry version satisfying its range.",
    );
    return 1;
  }

  console.log("");
  console.log("OK — all internal scaffold pins have a published satisfying version.");
  return 0;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("Unexpected failure in check-scaffold-pin-published:", error);
      process.exit(1);
    });
}
