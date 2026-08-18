// scripts/__tests__/check-scaffold-pin-freshness.test.mjs
//
// Unit tests for scripts/check-scaffold-pin-freshness.mjs (#3456). The
// registry lookup is always INJECTED via the `fetchDistTags` parameter —
// these tests never touch the real npm registry. Covers the four
// acceptance-criteria behaviors from #3456:
//   1. A deliberately-stale pin fails, naming package/current pin/newer version.
//   2. A current pin passes.
//   3. A simulated registry/network failure fails the gate, reported
//      distinctly from staleness ("lookup-error" vs "stale").
//   4. A prerelease pin is compared against "next" (not "latest") and is not
//      falsely reported stale merely because a stable "latest" is numerically
//      higher.
//
// File extension note: this test intentionally lives at `.test.mjs` (not the
// repo's usual `.test.ts` for scripts/__tests__) because the file name is
// specified exactly by #3456. vitest.config.ts's "scripts" project include
// glob was widened to also match `*.test.mjs` so this file actually runs
// under `pnpm test:unit` / `vitest run` — see the comment there.

import { describe, it, expect } from "vitest";

import {
  checkScaffoldPinFreshness,
  isPrereleaseVersion,
  DEFAULT_TIMEOUT_MS,
} from "../check-scaffold-pin-freshness.mjs";

// A minimal scaffold.ts stand-in exercising every literal pin form
// readScaffoldPin() understands (see check-pin-parity.mjs's docs).
const SCAFFOLD_SRC = `
export const ZUDO_DOC_PIN = "^0.2.22";

function generatePackageJson() {
  return {
    dependencies: {
      "@takazudo/zfb": "2.7.1",
      "@takazudo/zfb-runtime": "2.7.1",
      "@takazudo/zfb-md-wasm": "2.7.1",
      "@takazudo/zdtp": "0.4.1",
      "@takazudo/zudo-doc": ZUDO_DOC_PIN,
    },
  };
}
`;

const PRERELEASE_SCAFFOLD_SRC = `
function generatePackageJson() {
  return {
    dependencies: {
      "@takazudo/zfb": "0.2.0-next.9",
    },
  };
}
`;

/** Builds an injected fetchDistTags stub from a plain { pkg: distTagsMap } table. */
function stubRegistry(table) {
  return async (pkgName) => {
    const entry = table[pkgName];
    if (entry === undefined) {
      throw new Error(`stubRegistry: no entry configured for ${pkgName}`);
    }
    if (entry instanceof Error) {
      throw entry;
    }
    return entry;
  };
}

describe("isPrereleaseVersion", () => {
  it("detects a -next.N suffix", () => {
    expect(isPrereleaseVersion("0.2.0-next.9")).toBe(true);
  });

  it("treats a clean version as not prerelease", () => {
    expect(isPrereleaseVersion("2.7.1")).toBe(false);
  });

  it("tolerates a leading caret", () => {
    expect(isPrereleaseVersion("^0.2.0-next.9")).toBe(true);
  });
});

describe("checkScaffoldPinFreshness — validation", () => {
  it("throws when fetchDistTags is not a function", async () => {
    await expect(
      checkScaffoldPinFreshness({ scaffoldSrc: SCAFFOLD_SRC }),
    ).rejects.toThrow(/fetchDistTags/);
  });
});

describe("checkScaffoldPinFreshness — (1) stale pin", () => {
  it("fails and names the package, current pin, and newer version", async () => {
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "2.9.0" },
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(false);
    expect(result.findings).toHaveLength(1);
    const [finding] = result.findings;
    expect(finding.kind).toBe("stale");
    // Actionable: names the package, the pin currently in scaffold.ts, and
    // the newer version the registry has.
    expect(finding.message).toContain("@takazudo/zfb");
    expect(finding.message).toContain("2.7.1"); // current (stale) pin
    expect(finding.message).toContain("2.9.0"); // newer version available
    expect(finding.pin).toBe("2.7.1");
    expect(finding.registryVersion).toBe("2.9.0");
  });
});

describe("checkScaffoldPinFreshness — (2) current pin", () => {
  it("passes when the pin exactly matches the registry latest", async () => {
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "2.7.1" },
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([
      expect.objectContaining({ kind: "ok", pkg: "@takazudo/zfb" }),
    ]);
  });

  it("passes when the pin is numerically AHEAD of latest (not just equal)", async () => {
    // A pin ahead of the registry (e.g. an in-flight bump not yet propagated
    // to `latest`) must not be reported stale — only "behind" is stale.
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "2.5.0" },
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(true);
    expect(result.findings[0].kind).toBe("ok");
  });
});

describe("checkScaffoldPinFreshness — (3) registry/network failure", () => {
  it("fails the gate on a rejected lookup, reported distinctly from staleness", async () => {
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": new Error("network timeout"),
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(false);
    const [finding] = result.findings;
    expect(finding.kind).toBe("lookup-error");
    expect(finding.kind).not.toBe("stale");
    expect(finding.message).toContain("network timeout");
  });

  it("fails when the registry response has no usable latest tag (malformed shape)", async () => {
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": {}, // no "latest" key at all
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].kind).toBe("lookup-error");
  });

  it("does not swallow a lookup failure alongside other passing packages (fail-closed overall)", async () => {
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "2.7.1" }, // current
      "@takazudo/zdtp": new Error("ECONNRESET"), // fails
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zfb", "@takazudo/zdtp"],
      fetchDistTags,
    });

    // One package is fine, but any lookup error fails the whole gate.
    expect(result.ok).toBe(false);
    const kinds = result.findings.map((f) => f.kind).sort();
    expect(kinds).toEqual(["lookup-error", "ok"]);
  });
});

describe("checkScaffoldPinFreshness — (4) prerelease semantics", () => {
  it("compares a prerelease pin against the 'next' tag, not 'latest' — not falsely stale", async () => {
    // The pin (0.2.0-next.9) is numerically LOWER than the stable `latest`
    // (2.7.1) — a naive latest-only compare would wrongly flag this stale.
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "2.7.1", next: "0.2.0-next.9" },
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: PRERELEASE_SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(true);
    expect(result.findings[0]).toEqual(
      expect.objectContaining({ kind: "ok", tag: "next", pin: "0.2.0-next.9" }),
    );
  });

  it("still catches genuine cross-core staleness on the next line itself", async () => {
    // Comparison is on the numeric MAJOR.MINOR.PATCH core only (mirrors
    // check-pin-parity.mjs's parseSemverCore/satisfiesCaret rationale), so
    // two prereleases sharing a core (e.g. 0.2.0-next.9 vs 0.2.0-next.20)
    // compare equal — this test uses a core bump (0.2.0 -> 0.3.0) so the
    // "next" line's own staleness is still caught.
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "2.7.1", next: "0.3.0-next.1" },
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: PRERELEASE_SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toEqual(
      expect.objectContaining({
        kind: "stale",
        tag: "next",
        registryVersion: "0.3.0-next.1",
      }),
    );
  });

  it("does not treat a same-core prerelease bump as stale (core-only comparison)", async () => {
    // Documents the known limitation from the test above: 0.2.0-next.9 vs
    // 0.2.0-next.20 share a core and are NOT distinguished — this is
    // intentional (see checkScaffoldPinFreshness's parseCore/compareCore),
    // not a bug, and is asserted here so a future change to that behavior
    // is a deliberate, visible decision.
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "2.7.1", next: "0.2.0-next.20" },
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: PRERELEASE_SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(true);
    expect(result.findings[0].kind).toBe("ok");
  });

  it("falls back to 'latest' when there is no 'next' tag AND 'latest' is itself a prerelease", async () => {
    // A package with no stable release yet (e.g. published only as
    // 0.x.y-next.N) has no separate "next" tag — its "latest" IS the preview
    // line. Skipping there would make the gate permanently blind to exactly
    // the #3442 staleness shape it exists to catch.
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "0.3.0-next.1" }, // no "next" key
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: PRERELEASE_SCAFFOLD_SRC, // pins 0.2.0-next.9
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toEqual(
      expect.objectContaining({
        kind: "stale",
        tag: "latest",
        registryVersion: "0.3.0-next.1",
      }),
    );
  });

  it("skips (does not fail or report stale) a prerelease pin when the registry has no 'next' tag and 'latest' is stable", async () => {
    const fetchDistTags = stubRegistry({
      "@takazudo/zfb": { latest: "2.7.1" }, // no "next" key
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: PRERELEASE_SCAFFOLD_SRC,
      packages: ["@takazudo/zfb"],
      fetchDistTags,
    });

    expect(result.ok).toBe(true);
    expect(result.findings[0].kind).toBe("skipped");
  });
});

describe("checkScaffoldPinFreshness — unreadable pin", () => {
  it("fails when scaffold.ts has no literal pin for the package", async () => {
    const fetchDistTags = stubRegistry({
      "@takazudo/does-not-exist": { latest: "1.0.0" },
    });

    const result = await checkScaffoldPinFreshness({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/does-not-exist"],
      fetchDistTags,
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].kind).toBe("unreadable-pin");
  });
});

describe("module exports", () => {
  it("exposes a bounded default timeout", () => {
    expect(typeof DEFAULT_TIMEOUT_MS).toBe("number");
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
