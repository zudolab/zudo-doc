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
//   4. LOUD SKIP ON SAME-CORE PRERELEASE MISMATCH (#3475, closing the blind
//      spot #3469 found). This gate compares only the numeric
//      MAJOR.MINOR.PATCH core (see parseCore/compareCore below), so two
//      prereleases sharing a core — e.g. pin `0.2.0-next.9` vs registry
//      `0.2.0-next.20` — are indistinguishable by that comparison alone.
//      Reporting those "ok" would be a false pass: the pin could be many
//      prereleases behind and the gate would stay silent. So when a
//      prerelease pin's core matches the registry target's core but the
//      FULL version strings differ, this is reported as "skipped" with a
//      visible warning naming the package, the pin, and the registry
//      target, saying freshness was NOT verified for it — never "ok". An
//      EXACTLY-identical prerelease pin (core AND full string both match)
//      is still "ok" — nothing to warn about there, and warning on a true
//      match would just train people to ignore the gate. A "skipped"
//      finding does NOT fail the gate (see the `ok` computation at the end
//      of checkScaffoldPinFreshness) — this is a known coverage limit
//      surfaced for a human to check by hand, not a confirmed-stale pin.
//      Deliberately NOT full semver §11 prerelease-identifier comparison —
//      that was considered and rejected (#3469) as diverging from
//      check-pin-parity.mjs's core-only convention; the goal is removing
//      the silence, not closing the coverage gap.
//   5. FIRST-PARTY PEER RANGE FRESHNESS (#4065). The scaffold pin checks above
//      do not say whether packages/zudo-doc's declared @takazudo/* peer ranges
//      still admit the registry's current release. The peer check below covers
//      all five first-party peers explicitly listed in FIRST_PARTY_PEER_SCOPE:
//      zdtp, zfb, zfb-md-wasm, zfb-runtime, and zudo-doc-history-server. Their
//      current declarations are stable ranges, so each reads the stable
//      "latest" dist-tag. A prerelease scaffold pin or range selects "next"
//      instead, using the same missing-"next" behavior as pin checks.
//      This uses the semver package for complete range membership, including
//      prerelease rules; it does not reuse the pin check's core-only compare.
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
import semver from "semver";

import { PINNED_PACKAGES, readScaffoldPin } from "./check-pin-parity.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..");
const SCAFFOLD_TS_PATH = resolve(
  ROOT_DIR,
  "packages/create-zudo-doc/src/scaffold.ts",
);
const ZUDO_DOC_PKG_PATH = resolve(ROOT_DIR, "packages/zudo-doc/package.json");

/** Per-request timeout (ms) for the real registry lookup — semantics #2. */
export const DEFAULT_TIMEOUT_MS = 10_000;

const REGISTRY_BASE = "https://registry.npmjs.org";

/**
 * Explicit scope for the first-party peer-range guard (#4065).
 *
 * Keep this list deliberately separate from PINNED_PACKAGES: the scaffold
 * emits four external pins, while packages/zudo-doc declares five first-party
 * peers. Every row is in scope, including the optional history-server peer
 * whose floor intentionally trails the lockstep release (see RELEASE.md's
 * publish-lag note). `channelSource` records the current stable channel for
 * each declaration; selectPeerChannel() switches a prerelease range to
 * `next` without silently narrowing this scope.
 */
export const FIRST_PARTY_PEER_SCOPE = [
  { pkg: "@takazudo/zdtp", channelSource: "latest" },
  { pkg: "@takazudo/zfb", channelSource: "latest" },
  { pkg: "@takazudo/zfb-md-wasm", channelSource: "latest" },
  { pkg: "@takazudo/zfb-runtime", channelSource: "latest" },
  {
    pkg: "@takazudo/zudo-doc-history-server",
    channelSource: "latest",
  },
];

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
 * compare EQUAL here and are never reported STALE against each other.
 * Catching that class for real would need full prerelease-identifier
 * ordering (fragile across -next/-beta/-rc), which is out of scope (see
 * semantics #3/#4). This is NOT silent, though: the caller reports a
 * same-core-but-differing prerelease pair as "skipped" with a warning
 * rather than a false "ok" — see semantics #4 above. A core-level bump
 * (e.g. 0.2.0-next.9 vs 0.3.0-next.1) is still caught as "stale" here.
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
 * Read the five scoped peer ranges from packages/zudo-doc/package.json.
 * The normal CLI supplies both package and scaffold text; unit tests can
 * inject tiny peer tables (and optional pins) without touching the filesystem.
 */
export function readFirstPartyPeerRanges(packageSrc, scaffoldSrc) {
  let packageJson;
  try {
    packageJson =
      typeof packageSrc === "string" ? JSON.parse(packageSrc) : packageSrc;
  } catch {
    packageJson = null;
  }

  return FIRST_PARTY_PEER_SCOPE.map(({ pkg, channelSource }) => {
    const pin =
      typeof scaffoldSrc === "string"
        ? readScaffoldPin(scaffoldSrc, pkg)
        : undefined;
    return {
      pkg,
      channelSource,
      range: packageJson?.peerDependencies?.[pkg],
      ...(pin === undefined ? {} : { pin }),
    };
  });
}

/**
 * A valid semver range selects the preview channel when any authored
 * comparator names a prerelease. `semver.validRange` validates the complete
 * range; the authored-token check below avoids treating semver's synthetic
 * prerelease upper bounds as a channel selector.
 */
export function isPrereleaseRange(range) {
  if (typeof range !== "string" || validPeerRange(range) === null) {
    return false;
  }

  // Inspect the authored range rather than Range#set: semver expands caret
  // bounds such as `^0.5.2` to `<0.6.0-0`, and that synthetic `-0` marker is
  // not an authored prerelease channel selector.
  return /(?:^|[^\d])\d+\.\d+\.\d+-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*(?=$|[^0-9A-Za-z-])/.test(
    range,
  );
}

function validPeerRange(range) {
  if (typeof range !== "string" || range.trim() === "") return null;
  try {
    return semver.validRange(range);
  } catch {
    return null;
  }
}

function peerChannel(range, pin) {
  return isPrereleaseVersion(pin) || isPrereleaseRange(range)
    ? "next"
    : "latest";
}

function registryLookupError(pkg, error, range) {
  return {
    kind: "lookup-error",
    pkg,
    range,
    message:
      `Registry lookup failed for first-party peer ${pkg} — treating as a ` +
      `gate failure distinct from peer-range exclusion (fail-closed): ${
        error instanceof Error ? error.message : String(error)
      }`,
  };
}

/**
 * Evaluate one declared first-party peer range against its channel-appropriate
 * registry dist-tag. The caller supplies the lookup so tests remain offline.
 */
async function evaluateFirstPartyPeerRange({
  pkg,
  pin,
  range,
  channelSource = "latest",
  fetchDistTags,
}) {
  const normalizedRange = validPeerRange(range);
  if (normalizedRange === null) {
    return {
      kind: "invalid-range",
      pkg,
      range,
      message:
        `Declared peer range for ${pkg} is invalid or missing (${JSON.stringify(
          range,
        )}); fix packages/zudo-doc/package.json before checking registry ${
          channelSource === "latest" ? '"latest"' : '"next"'
        }.`,
    };
  }

  const prereleaseRange = isPrereleaseRange(range);
  const prereleasePin = isPrereleaseVersion(pin);
  const prerelease = prereleasePin || prereleaseRange;
  let tag = peerChannel(range, pin);
  let registryVersion;
  let distTags;
  try {
    distTags = await fetchDistTags(pkg);
  } catch (error) {
    return registryLookupError(pkg, error, range);
  }

  if (
    distTags === null ||
    typeof distTags !== "object" ||
    Array.isArray(distTags)
  ) {
    return registryLookupError(
      pkg,
      new Error("registry response was not a dist-tags object"),
      range,
    );
  }

  registryVersion = distTags[tag];

  // A present channel key with an empty/non-string value is malformed. Check
  // it before the prerelease fallback so `next: ""` cannot be mistaken for a
  // legitimately absent next tag when latest is itself a prerelease.
  if (
    Object.prototype.hasOwnProperty.call(distTags, tag) &&
    (typeof registryVersion !== "string" || registryVersion === "")
  ) {
    return registryLookupError(
      pkg,
      new Error(
        `registry "${tag}" dist-tag was present but unusable (${JSON.stringify(
          registryVersion,
        )})`,
      ),
      range,
    );
  }

  // Preserve the existing prerelease missing-"next" rule exactly: a
  // prerelease pin or range may use latest only when latest itself is prerelease;
  // otherwise freshness is intentionally skipped rather than compared to a
  // stable line. `channelSource` documents today's stable default but cannot
  // override this range-driven selection.
  if (prerelease && !registryVersion && isPrereleaseVersion(distTags?.latest)) {
    tag = "latest";
    registryVersion = distTags.latest;
  }

  if (!registryVersion) {
    if (prerelease) {
      const latest = distTags.latest;
      if (latest === undefined || latest === null || latest === "") {
        return registryLookupError(
          pkg,
          new Error(
            'registry response had neither a "next" nor a usable "latest" dist-tag',
          ),
          range,
        );
      }
      if (
        typeof latest !== "string" ||
        semver.valid(latest) === null ||
        !isPrereleaseVersion(latest)
      ) {
        if (typeof latest !== "string" || semver.valid(latest) === null) {
          return registryLookupError(
            pkg,
            new Error(
              `registry "latest" dist-tag is not a valid semver version (${JSON.stringify(
                latest,
              )})`,
            ),
            range,
          );
        }
        // A stable latest with no next tag is the established intentional
        // skip. The pin and range are preview-channel inputs, so comparing
        // them against this stable line would be a false exclusion.
        return {
          kind: "skipped",
          pkg,
          pin,
          range,
          tag: "next",
          message:
            `${pkg} ${prereleasePin ? `scaffold pin ${pin}` : `peer range ${JSON.stringify(range)}`} ` +
            `selects the prerelease channel, the registry has no "next" ` +
            `dist-tag, and "latest" is a stable line this input was never ` +
            `meant to track — skipping (not reported stale).`,
        };
      }
      // A package with no stable line uses latest as its preview channel.
      registryVersion = latest;
      tag = "latest";
    }
    if (!registryVersion) {
      return {
        kind: "lookup-error",
        pkg,
        pin,
        range,
        message:
          `Registry response for first-party peer ${pkg} had no "latest" dist-tag ` +
          `— treating as a gate failure distinct from peer-range exclusion ` +
          `(fail-closed).`,
      };
    }
  }

  if (typeof registryVersion !== "string" || semver.valid(registryVersion) === null) {
    return registryLookupError(
      pkg,
      new Error(
        `registry "${tag}" dist-tag is not a valid semver version (${JSON.stringify(
          registryVersion,
        )})`,
      ),
      range,
    );
  }

  let satisfies;
  try {
    // Do not set includePrerelease: npm's default semver rule is significant:
    // a prerelease satisfies only a comparator carrying a matching prerelease
    // tuple. That is the proper range membership this gate is meant to test.
    satisfies = semver.satisfies(registryVersion, normalizedRange);
  } catch (error) {
    return {
      kind: "invalid-range",
      pkg,
      range,
      message:
        `Declared peer range for ${pkg} could not be evaluated (${JSON.stringify(
          range,
        )}): ${error instanceof Error ? error.message : String(error)}.`,
    };
  }

  if (!satisfies) {
    return {
      kind: "peer-range-excludes-latest",
      pkg,
      pin,
      range,
      registryVersion,
      tag,
      message:
        `${pkg} declared peer range ${JSON.stringify(
          range,
        )} EXCLUDES registry "${tag}" ${registryVersion}. Verify that this ` +
        `channel version is compatible before widening or updating the peer ` +
        `range in packages/zudo-doc/package.json, then rerun the freshness check.`,
    };
  }

  return {
    kind: "ok",
    pkg,
    pin,
    range,
    registryVersion,
    tag,
    message:
      `${pkg} peer range ${JSON.stringify(range)} admits registry "${tag}" ` +
      `${registryVersion}.`,
  };
}

/**
 * Check a supplied set of first-party peer ranges. The default table is the
 * explicit five-package scope with ranges loaded from this checkout's
 * packages/zudo-doc/package.json and scaffold pins loaded from scaffold.ts.
 * Tests should pass a small `peerRanges` table and an injected `fetchDistTags`
 * function.
 */
export async function checkFirstPartyPeerFreshness({
  peerRanges = readFirstPartyPeerRanges(
    readFileSync(ZUDO_DOC_PKG_PATH, "utf-8"),
    readFileSync(SCAFFOLD_TS_PATH, "utf-8"),
  ),
  fetchDistTags,
}) {
  if (typeof fetchDistTags !== "function") {
    throw new TypeError(
      "checkFirstPartyPeerFreshness requires a fetchDistTags(pkgName) function",
    );
  }

  const findings = [];
  for (const peer of peerRanges) {
    findings.push(
      await evaluateFirstPartyPeerRange({
        ...peer,
        fetchDistTags,
      }),
    );
  }
  return {
    ok: findings.every((finding) => finding.kind === "ok" || finding.kind === "skipped"),
    findings,
  };
}

/**
 * Evaluate every package in `packages` for pin staleness against the
 * registry, using the injected `fetchDistTags(pkgName) => Promise<Record<string,string>>`
 * (a dist-tag-name → version map, e.g. `{ latest: "2.7.1", next: "0.2.0-next.9" }`
 * — the shape `GET /-/package/<pkg>/dist-tags` returns).
 * When `peerRanges` is supplied, append the first-party peer-range findings
 * from checkFirstPartyPeerFreshness(). It is optional for backwards
 * compatibility with callers that only exercise scaffold pins; the CLI passes
 * the explicit five-peer scope.
 *
 * Returns `{ ok, findings }`. `ok` is false when ANY package is "stale", a
 * first-party peer range is excluded/invalid, OR ANY lookup failed
 * ("lookup-error" / "unreadable-pin") — fail-closed, see semantics #1 above.
 * Each finding has a `kind` of:
 *   "stale"          — pin is behind the comparison dist-tag.
 *   "ok"              — pin is current.
 *   "skipped"         — freshness was NOT verified for this pin. Two causes:
 *                        (a) prerelease pin with no "next" tag to compare
 *                        against, or (b) prerelease pin whose core matches
 *                        the registry target but the full version strings
 *                        differ (semantics #4) — the gate cannot tell
 *                        whether it is current or many prereleases behind.
 *                        Never fails the gate (see the `ok` computation
 *                        below) but is always visible in the finding
 *                        message.
 *   "lookup-error"    — registry fetch failed, or returned an unusable shape.
 *   "unreadable-pin"  — scaffold.ts has no parseable literal for this
 *                        package (should already be caught by
 *                        check-pin-parity.mjs; reported here too so this
 *                        gate never passes on a pin it could not actually
 *                        read).
 *   "peer-range-excludes-latest" — a first-party peer range excludes the
 *                        selected registry channel version.
 *   "invalid-range"    — a first-party peer range is missing or malformed.
 */
export async function checkScaffoldPinFreshness({
  scaffoldSrc,
  packages = PINNED_PACKAGES,
  peerRanges,
  fetchDistTags,
}) {
  if (typeof fetchDistTags !== "function") {
    throw new TypeError(
      "checkScaffoldPinFreshness requires a fetchDistTags(pkgName) function",
    );
  }

  const findings = [];
  const distTagsCache = new Map();
  const fetchDistTagsOnce = (pkgName) => {
    if (!distTagsCache.has(pkgName)) {
      // Store the promise, including a rejection, so a package shared by the
      // scaffold and peer scopes has one bounded lookup per run.
      distTagsCache.set(
        pkgName,
        Promise.resolve().then(() => fetchDistTags(pkgName)),
      );
    }
    return distTagsCache.get(pkgName);
  };

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
      distTags = await fetchDistTagsOnce(pkgName);
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

    // Semantics #4: same core, but the full version strings differ (e.g.
    // pin "0.2.0-next.9" vs registry "0.2.0-next.20"). compareCore() cannot
    // see this difference, so an "ok" here would be a false pass — the pin
    // could be many prereleases behind. Report "skipped" with a warning
    // instead. An exact string match (identical pin) falls through to "ok"
    // below — nothing to warn about there. The warning is worded per case:
    // a prerelease registry target genuinely cannot be ordered here, but a
    // STABLE target sharing the core (pin "0.2.0-next.9" vs "next" =
    // "0.2.0") outranks the pin by semver §11 — still not failed (that
    // would be a behaviour change to semantics #3's "never compare a
    // prerelease pin against a stable line" stance), but not described as
    // unknowable either.
    if (
      prerelease &&
      compareCore(pinCore, registryCore) === 0 &&
      scaffoldPin.replace(/^[\^~]/, "") !== registryVersion
    ) {
      findings.push({
        kind: "skipped",
        pkg: pkgName,
        pin: scaffoldPin,
        registryVersion,
        tag: targetTag,
        message: isPrereleaseVersion(registryVersion)
          ? `${pkgName} scaffold pin ${scaffoldPin} was NOT checked for freshness — ` +
            `it shares its MAJOR.MINOR.PATCH core with registry "${targetTag}" ` +
            `${registryVersion}, but the full prerelease strings differ. This gate ` +
            `compares numeric cores only (known limitation), so it cannot tell ` +
            `whether ${pkgName} is current or several prereleases behind. Verify ` +
            `manually.`
          : `${pkgName} scaffold pin ${scaffoldPin} was NOT checked for freshness — ` +
            `registry "${targetTag}" is the STABLE release ${registryVersion}, which ` +
            `shares the pin's MAJOR.MINOR.PATCH core. Per semver a release outranks ` +
            `its own prereleases, so this pin is behind — but this gate compares ` +
            `numeric cores only (known limitation) and does not fail on it. Bump the ` +
            `pin, or confirm by hand that the prerelease line is the intended target.`,
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

  if (peerRanges !== undefined && peerRanges !== null) {
    const peerResult = await checkFirstPartyPeerFreshness({
      peerRanges: peerRanges.map((peer) => ({
        ...peer,
        pin:
          peer.pin ??
          (typeof scaffoldSrc === "string"
            ? readScaffoldPin(scaffoldSrc, peer.pkg)
            : undefined),
      })),
      fetchDistTags: fetchDistTagsOnce,
    });
    findings.push(...peerResult.findings);
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
          : f.kind === "peer-range-excludes-latest"
            ? "PEER   "
          : "ERROR  ";
  return `  ${label} ${f.message}`;
}

async function main() {
  const scaffoldSrc = readFileSync(SCAFFOLD_TS_PATH, "utf-8");
  const peerRanges = readFirstPartyPeerRanges(
    readFileSync(ZUDO_DOC_PKG_PATH, "utf-8"),
    scaffoldSrc,
  );
  const result = await checkScaffoldPinFreshness({
    scaffoldSrc,
    peerRanges,
    fetchDistTags: (pkgName) => fetchDistTagsFromRegistry(pkgName),
  });

  for (const f of result.findings) {
    console.log(formatFinding(f));
  }

  if (!result.ok) {
    const stale = result.findings.filter((f) => f.kind === "stale");
    const excludedPeerRanges = result.findings.filter(
      (f) => f.kind === "peer-range-excludes-latest",
    );
    const invalidRanges = result.findings.filter(
      (f) => f.kind === "invalid-range",
    );
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
    if (excludedPeerRanges.length > 0) {
      console.error(
        `  ${excludedPeerRanges.length} first-party peer range(s) exclude the registry channel version — widen/update packages/zudo-doc/package.json as described above.`,
      );
    }
    if (invalidRanges.length > 0) {
      console.error(
        `  ${invalidRanges.length} invalid first-party peer range(s) — fix packages/zudo-doc/package.json before rerunning the gate.`,
      );
    }
    if (errors.length > 0) {
      console.error(
        `  ${errors.length} lookup error(s) — registry unreachable, timed out, or returned an unusable response. This is DISTINCT from staleness: it means the gate could not verify freshness at all, not that a pin was confirmed stale. Retry once the registry is reachable.`,
      );
    }
    return 1;
  }

  const skipped = result.findings.filter((f) => f.kind === "skipped");
  console.log("");
  console.log("OK — all scaffold pins are current (or intentionally skipped).");
  if (skipped.length > 0) {
    console.log(
      `  ${skipped.length} pin(s) skipped — freshness NOT verified for these, see SKIP lines above for why.`,
    );
  }
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
