#!/usr/bin/env node
// scripts/check-scaffold-pin-freshness.mjs
//
// Scaffold pin STALENESS gate (#3456, epic #3455 — the recurrence-prevention
// half of #3442). Failure mode this closes: `create-zudo-doc@5.5.3` shipped
// on 2026-08-17 pinning `@takazudo/zfb` at `2.5.2` — three weeks after the
// upstream mermaid fix landed on 2026-07-27. Every fresh scaffold with
// mermaid diagrams was broken out of the box, and the failure was invisible
// to every automated gate: build exits 0, typecheck passes, link check
// passes. It only shows in a browser. Nothing checked that the pin was
// current AT RELEASE TIME. That is what this script checks.
//
// This is deliberately NOT a "relax the pin to a caret" tool — #3455
// explicitly REJECTED that option. scripts/check-pin-parity.mjs documents
// the scaffold literal as a reproducibility guarantee ("a fresh scaffold
// gets EXACTLY these versions") and enforces exact equality. This script
// leaves that contract untouched; it only detects staleness so a human /
// release process can decide to bump the exact pin.
//
// Semantics (also asserted in
// scripts/__tests__/check-scaffold-pin-freshness.test.mjs):
//
//   1. FAIL CLOSED on registry/network error. A lookup failure is a GATE
//      FAILURE, never a silent pass — a release blocked by a flaky registry
//      is recoverable; a stale release published to npm is not. It is
//      reported as a DISTINCT finding kind ("lookup-error") from a stale
//      pin ("stale"), so an operator can tell "the registry was
//      unreachable" apart from "a pin is actually behind" from the output
//      alone.
//   2. BOUNDED REQUEST TIMEOUT (see DEFAULT_TIMEOUT_MS) on the real registry
//      fetch, so a hung/slow registry can never hang a release indefinitely.
//      A request that times out surfaces as an aborted fetch, which is
//      caught and reported the same way as any other lookup failure (#1).
//   3. PRERELEASE SEMANTICS. RELEASE.md ("dist-tag table" / "How `latest`
//      stays current") documents that `next` and `latest` are two
//      permanently-diverging channels once a package has any stable
//      release — `next` is NOT "the next version after latest", it is a
//      separate, often much OLDER, opt-in preview line. #3442 names this
//      divergence as the likely cause of the original 3-week gap: naively
//      comparing every pin against `latest` would ALSO misfire in the
//      opposite direction, permanently flagging a correct prerelease pin
//      (e.g. `0.2.0-next.9`) as "stale" against a numerically higher stable
//      `latest` it was never meant to track. So: a pin carrying a
//      `-prerelease` suffix is compared against the registry's `next`
//      dist-tag, never a STABLE `latest`. Two sub-cases when there is no
//      `next` tag: if `latest` is itself a prerelease the package has no
//      stable line at all and `latest` IS the preview channel, so it is used
//      as the comparison target (skipping there would leave the gate
//      permanently blind to the very staleness shape it exists to catch);
//      if `latest` is stable, the package is reported "skipped" — not
//      stale, not a failure.
//
// Design: the registry lookup is INJECTED (`fetchDistTags`) so
// checkScaffoldPinFreshness() is pure and the test suite never touches the
// real network. The CLI wrapper at the bottom of this file supplies the
// real npm registry fetch (bounded by DEFAULT_TIMEOUT_MS).
//
// Wired in by #3457: Safeguard 4/5 of .github/workflows/publish-create-zudo-doc.yml
// (immediately before `npm publish`, run even on a dry run), plus an early-feedback
// preflight in scripts/release-create-zudo-doc.sh and the `check:scaffold-pin-freshness`
// package script. Deliberately NOT a PR gate — it hits the live registry, so an
// upstream publish must never be able to fail an unrelated PR.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

import { PINNED_PACKAGES, readScaffoldPin } from "./check-pin-parity.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..");
const SCAFFOLD_TS_PATH = resolve(
  ROOT_DIR,
  "packages/create-zudo-doc/src/scaffold.ts",
);

/** Per-request timeout (ms) for the real registry lookup — semantics #2. */
export const DEFAULT_TIMEOUT_MS = 10_000;

const REGISTRY_BASE = "https://registry.npmjs.org";

/**
 * True when `version` carries a `-prerelease` suffix (e.g. "0.2.0-next.9").
 * A leading `^`/`~` is tolerated even though scaffold pins are expected to be
 * exact literals — matches the tolerance in check-pin-parity.mjs's
 * parseSemverCore().
 */
export function isPrereleaseVersion(version) {
  return (
    typeof version === "string" && /-/.test(version.replace(/^[\^~]/, ""))
  );
}

/**
 * Parse the numeric MAJOR.MINOR.PATCH core out of a version string, dropping
 * any prerelease/build suffix. Mirrors check-pin-parity.mjs's
 * parseSemverCore(): this gate cares about cross-version staleness (is the
 * pin numerically behind?), not exact prerelease-identifier ordering.
 * Returns null when the three numeric segments can't be read.
 *
 * KNOWN LIMITATION (intentional, mirrors satisfiesCaret()'s rationale): two
 * prereleases sharing a core — e.g. "0.2.0-next.9" vs "0.2.0-next.20" —
 * compare EQUAL and are never reported stale against each other. Catching
 * that class would need real prerelease-identifier ordering (fragile across
 * -next/-beta/-rc), which is out of scope for the false-positive this gate
 * exists to prevent (see semantics #3). A core-level bump (e.g. 0.2.0-next.9
 * vs 0.3.0-next.1) is still caught.
 */
function parseCore(version) {
  if (typeof version !== "string") return null;
  const core = version.trim().replace(/^[\^~]/, "").split(/[-+]/, 1)[0];
  const m = core.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareCore(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Evaluate every package in `packages` for pin staleness against the
 * registry, using the injected `fetchDistTags(pkgName) => Promise<Record<string,string>>`
 * (a dist-tag-name → version map, e.g. `{ latest: "2.7.1", next: "0.2.0-next.9" }`
 * — the shape `GET /-/package/<pkg>/dist-tags` returns).
 *
 * Returns `{ ok, findings }`. `ok` is false when ANY package is "stale" OR
 * ANY lookup failed ("lookup-error" / "unreadable-pin") — fail-closed, see
 * semantics #1 above. Each finding has a `kind` of:
 *   "stale"          — pin is behind the comparison dist-tag.
 *   "ok"              — pin is current.
 *   "skipped"         — prerelease pin with no "next" tag to compare against.
 *   "lookup-error"    — registry fetch failed, or returned an unusable shape.
 *   "unreadable-pin"  — scaffold.ts has no parseable literal for this
 *                        package (should already be caught by
 *                        check-pin-parity.mjs; reported here too so this
 *                        gate never passes on a pin it could not actually
 *                        read).
 */
export async function checkScaffoldPinFreshness({
  scaffoldSrc,
  packages = PINNED_PACKAGES,
  fetchDistTags,
}) {
  if (typeof fetchDistTags !== "function") {
    throw new TypeError(
      "checkScaffoldPinFreshness requires a fetchDistTags(pkgName) function",
    );
  }

  const findings = [];

  for (const pkgName of packages) {
    const scaffoldPin = readScaffoldPin(scaffoldSrc, pkgName);
    if (scaffoldPin === null) {
      findings.push({
        kind: "unreadable-pin",
        pkg: pkgName,
        message: `Could not locate a literal pin for ${pkgName} in scaffold.ts.`,
      });
      continue;
    }

    let distTags;
    try {
      distTags = await fetchDistTags(pkgName);
    } catch (error) {
      findings.push({
        kind: "lookup-error",
        pkg: pkgName,
        pin: scaffoldPin,
        message:
          `Registry lookup failed for ${pkgName} — treating as a gate ` +
          `failure distinct from staleness (fail-closed): ${
            error instanceof Error ? error.message : String(error)
          }`,
      });
      continue;
    }

    const prerelease = isPrereleaseVersion(scaffoldPin);
    let targetTag = prerelease ? "next" : "latest";
    let registryVersion = distTags?.[targetTag];

    // Semantics #3, refinement: a package with NO stable release yet has no
    // separate "next" tag — its "latest" IS the preview line (e.g. a 0.x
    // package published only as 0.5.0-next.N). Skipping there would make the
    // gate permanently blind to exactly the #3442 staleness shape it exists
    // to catch, so fall back to "latest" when "latest" is itself a
    // prerelease. When "latest" is stable, the skip below still applies —
    // that is the diverging-channels case the skip was written for.
    if (prerelease && !registryVersion && isPrereleaseVersion(distTags?.latest)) {
      targetTag = "latest";
      registryVersion = distTags.latest;
    }

    if (!registryVersion) {
      if (prerelease) {
        // Semantics #3: a prerelease pin with nothing to compare against is
        // NOT a failure and NOT "stale" — it is simply not evaluated.
        findings.push({
          kind: "skipped",
          pkg: pkgName,
          pin: scaffoldPin,
          message:
            `${pkgName} pin ${scaffoldPin} is a prerelease, the registry has no ` +
            `"next" dist-tag, and "latest" is a stable line this pin was never ` +
            `meant to track — skipping (not reported stale).`,
        });
        continue;
      }
      findings.push({
        kind: "lookup-error",
        pkg: pkgName,
        pin: scaffoldPin,
        message:
          `Registry response for ${pkgName} had no "latest" dist-tag — ` +
          `treating as a gate failure distinct from staleness (fail-closed).`,
      });
      continue;
    }

    const pinCore = parseCore(scaffoldPin);
    const registryCore = parseCore(registryVersion);
    if (!pinCore || !registryCore) {
      findings.push({
        kind: "lookup-error",
        pkg: pkgName,
        pin: scaffoldPin,
        message:
          `Could not parse a semver core from ${pkgName} pin (${scaffoldPin}) ` +
          `or registry version (${registryVersion}) — treating as a gate ` +
          `failure distinct from staleness (fail-closed).`,
      });
      continue;
    }

    if (compareCore(pinCore, registryCore) < 0) {
      findings.push({
        kind: "stale",
        pkg: pkgName,
        pin: scaffoldPin,
        registryVersion,
        tag: targetTag,
        message:
          `${pkgName} scaffold pin is STALE — scaffold.ts pins ${scaffoldPin}, ` +
          `but registry "${targetTag}" is ${registryVersion}. Bump the pin in ` +
          `packages/create-zudo-doc/src/scaffold.ts.`,
      });
      continue;
    }

    findings.push({
      kind: "ok",
      pkg: pkgName,
      pin: scaffoldPin,
      registryVersion,
      tag: targetTag,
      message: `${pkgName} pin ${scaffoldPin} is current (registry "${targetTag}" = ${registryVersion}).`,
    });
  }

  const ok = findings.every((f) => f.kind === "ok" || f.kind === "skipped");
  return { ok, findings };
}

/**
 * Real registry lookup: GET the dist-tags map for `pkgName`, bounded by
 * `timeoutMs` (semantics #2). Never called from tests — see the injected
 * `fetchDistTags` seam on checkScaffoldPinFreshness().
 */
async function fetchDistTagsFromRegistry(pkgName, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const url = `${REGISTRY_BASE}/-/package/${encodeURIComponent(pkgName)}/dist-tags`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(
        `npm registry returned ${res.status} ${res.statusText} for ${pkgName}`,
      );
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function formatFinding(f) {
  const label =
    f.kind === "ok"
      ? "OK     "
      : f.kind === "skipped"
        ? "SKIP   "
        : f.kind === "stale"
          ? "STALE  "
          : "ERROR  ";
  return `  ${label} ${f.message}`;
}

async function main() {
  const scaffoldSrc = readFileSync(SCAFFOLD_TS_PATH, "utf-8");
  const result = await checkScaffoldPinFreshness({
    scaffoldSrc,
    fetchDistTags: (pkgName) => fetchDistTagsFromRegistry(pkgName),
  });

  for (const f of result.findings) {
    console.log(formatFinding(f));
  }

  if (!result.ok) {
    const stale = result.findings.filter((f) => f.kind === "stale");
    const errors = result.findings.filter(
      (f) => f.kind === "lookup-error" || f.kind === "unreadable-pin",
    );
    console.error("");
    console.error("Scaffold pin freshness check FAILED.");
    if (stale.length > 0) {
      console.error(
        `  ${stale.length} stale pin(s) — bump packages/create-zudo-doc/src/scaffold.ts to the versions named above.`,
      );
    }
    if (errors.length > 0) {
      console.error(
        `  ${errors.length} lookup error(s) — registry unreachable, timed out, or returned an unusable response. This is DISTINCT from staleness: it means the gate could not verify freshness at all, not that a pin was confirmed stale. Retry once the registry is reachable.`,
      );
    }
    return 1;
  }

  console.log("");
  console.log("OK — all scaffold pins are current (or intentionally skipped as prerelease-with-no-next-tag).");
  return 0;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("Unexpected failure in check-scaffold-pin-freshness:", error);
      process.exit(1);
    });
}
