import { describe, it, expect } from "vitest";

import {
  parseSemverCore,
  satisfiesCaret,
  evaluateFirstPartyPeer,
  workspaceZfbDevPinMatches,
  workspaceZfbPeerFloorMatches,
} from "../check-pin-parity.mjs";

describe("workspace zfb pin policy", () => {
  const rootPin = "0.1.0-next.85";

  it("requires an exact dev pin", () => {
    expect(workspaceZfbDevPinMatches(rootPin, rootPin)).toBe(true);
    expect(workspaceZfbDevPinMatches(rootPin, `^${rootPin}`)).toBe(false);
  });

  it("requires the canonical compatible peer floor", () => {
    expect(workspaceZfbPeerFloorMatches(rootPin, `^${rootPin}`)).toBe(true);
    expect(workspaceZfbPeerFloorMatches(rootPin, rootPin)).toBe(false);
    expect(workspaceZfbPeerFloorMatches(rootPin, "^0.1.0-next.80")).toBe(false);
  });
});

describe("parseSemverCore", () => {
  it("parses a plain version", () => {
    expect(parseSemverCore("2.1.0")).toEqual({ major: 2, minor: 1, patch: 0 });
  });

  it("tolerates a leading caret", () => {
    expect(parseSemverCore("^2.0.1")).toEqual({ major: 2, minor: 0, patch: 1 });
  });

  it("drops prerelease / build suffixes", () => {
    expect(parseSemverCore("0.1.0-next.71")).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
    });
  });

  it("returns null for unparseable input", () => {
    expect(parseSemverCore("latest")).toBeNull();
    expect(parseSemverCore("2.1")).toBeNull();
    expect(parseSemverCore(undefined as unknown as string)).toBeNull();
  });
});

describe("satisfiesCaret", () => {
  it("accepts a same-major lagging floor (the publish-lag case)", () => {
    expect(satisfiesCaret("2.1.0", "^2.0.1")).toBe(true);
  });

  it("accepts an exact-match floor", () => {
    expect(satisfiesCaret("2.1.0", "^2.1.0")).toBe(true);
  });

  it("rejects a cross-major stale floor (#2381 / #2445)", () => {
    // 2.0.1 is NOT within ^1.2.0 (caret on major 1 stops below 2.0.0).
    expect(satisfiesCaret("2.0.1", "^1.2.0")).toBe(false);
  });

  it("rejects a floor above the root version", () => {
    expect(satisfiesCaret("2.1.0", "^2.2.0")).toBe(false);
  });

  it("honors 0.x caret semantics", () => {
    expect(satisfiesCaret("0.4.5", "^0.4.1")).toBe(true);
    expect(satisfiesCaret("0.5.0", "^0.4.1")).toBe(false);
    expect(satisfiesCaret("0.0.4", "^0.0.4")).toBe(true);
    expect(satisfiesCaret("0.0.5", "^0.0.4")).toBe(false);
  });

  it("returns null for non-caret range forms (loud failure upstream)", () => {
    expect(satisfiesCaret("2.1.0", "2.1.0")).toBeNull();
    expect(satisfiesCaret("2.1.0", "~2.1.0")).toBeNull();
    expect(satisfiesCaret("2.1.0", ">=2.0.0")).toBeNull();
  });

  it("compares a prerelease root on its core triple (intentional — avoids the publish-lag deadlock)", () => {
    // Strict npm semantics would say `^2.1.0` excludes `2.2.0-next.1`; this guard
    // deliberately compares cores so a prerelease release isn't forced to name an
    // unpublished prerelease in the floor. See satisfiesCaret() docs / RELEASE.md.
    expect(satisfiesCaret("2.2.0-next.1", "^2.1.0")).toBe(true);
    // Cross-major staleness is still caught even for a prerelease root.
    expect(satisfiesCaret("2.0.0-next.1", "^1.5.0")).toBe(false);
  });
});

describe("evaluateFirstPartyPeer — lockstep (satisfies)", () => {
  const base = {
    pkg: "@takazudo/zudo-doc-history-server",
    sourceKind: "lockstep (root version)",
    comparison: "satisfies" as const,
  };

  it("(a) PASSES when the floor lags but still includes the root version", () => {
    const res = evaluateFirstPartyPeer({
      ...base,
      sourceValue: "2.1.0",
      actualPeer: "^2.0.1",
    });
    expect(res.ok).toBe(true);
    // A lagging-but-valid floor emits a non-fatal advisory nudging a bump.
    expect(res.advisory).toBeTruthy();
  });

  it("(b) PASSES on an exact match with no advisory", () => {
    const res = evaluateFirstPartyPeer({
      ...base,
      sourceValue: "2.1.0",
      actualPeer: "^2.1.0",
    });
    expect(res.ok).toBe(true);
    expect(res.advisory).toBeUndefined();
  });

  it("(c) FAILS on a cross-major stale floor", () => {
    const res = evaluateFirstPartyPeer({
      ...base,
      sourceValue: "2.0.1",
      actualPeer: "^1.2.0",
    });
    expect(res.ok).toBe(false);
  });

  it("(d) FAILS when the floor is above the root version", () => {
    const res = evaluateFirstPartyPeer({
      ...base,
      sourceValue: "2.1.0",
      actualPeer: "^2.2.0",
    });
    expect(res.ok).toBe(false);
  });

  it("FAILS loudly on an unrecognizable (non-caret) floor", () => {
    const res = evaluateFirstPartyPeer({
      ...base,
      sourceValue: "2.1.0",
      actualPeer: "~2.0.1",
    });
    expect(res.ok).toBe(false);
  });

  it("FAILS when the floor is missing", () => {
    const res = evaluateFirstPartyPeer({
      ...base,
      sourceValue: "2.1.0",
      actualPeer: undefined,
    });
    expect(res.ok).toBe(false);
    expect(res.actual).toBe("(missing)");
  });
});

describe("evaluateFirstPartyPeer — pinned (exact)", () => {
  const base = {
    pkg: "@takazudo/zdtp",
    sourceKind: 'pinned (root dependencies["@takazudo/zdtp"])',
    comparison: "exact" as const,
  };

  it("(e) PASSES only on exact equality", () => {
    expect(
      evaluateFirstPartyPeer({ ...base, sourceValue: "0.4.1", actualPeer: "^0.4.1" }).ok,
    ).toBe(true);
  });

  it("(e) FAILS a lagging floor even though it would satisfy — pinned stays strict", () => {
    const res = evaluateFirstPartyPeer({
      ...base,
      sourceValue: "0.4.1",
      actualPeer: "^0.4.0",
    });
    expect(res.ok).toBe(false);
  });
});
