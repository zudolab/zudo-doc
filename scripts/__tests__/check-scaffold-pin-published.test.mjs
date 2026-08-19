// Unit tests for check-scaffold-pin-published.mjs. Registry responses are
// always injected, so this spec never touches the network.

import { describe, it, expect } from "vitest";

import {
  checkScaffoldPinPublished,
  satisfiesCaretPublished,
  DEFAULT_TIMEOUT_MS,
} from "../check-scaffold-pin-published.mjs";

const SCAFFOLD_SRC = `
export const ZUDO_DOC_PIN = "^5.7.0";
function scaffold() {
  const deps = {
    "@takazudo/zudo-doc": ZUDO_DOC_PIN,
  };
  deps["@takazudo/zudo-doc-history-server"] = "^5.7.0";
  return deps;
}
`;

const PRERELEASE_SCAFFOLD_SRC = `
const ZUDO_DOC_PIN = "^5.7.0-next.2";
const deps = { "@takazudo/zudo-doc": ZUDO_DOC_PIN };
`;

function stubRegistry(table) {
  return async (pkgName) => {
    const entry = table[pkgName];
    if (entry === undefined) {
      throw new Error(`stubRegistry: no entry configured for ${pkgName}`);
    }
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

function packument(...versions) {
  return { versions: Object.fromEntries(versions.map((version) => [version, {}])) };
}

describe("satisfiesCaretPublished", () => {
  it("handles caret lower and upper boundaries", () => {
    expect(satisfiesCaretPublished("5.7.0", "^5.7.0")).toBe(true);
    expect(satisfiesCaretPublished("5.6.9", "^5.7.0")).toBe(false);
    expect(satisfiesCaretPublished("5.9.0", "^5.7.0")).toBe(true);
    expect(satisfiesCaretPublished("6.0.0", "^5.7.0")).toBe(false);
    expect(satisfiesCaretPublished("6.0.0-next.1", "^5.7.0")).toBe(false);
    expect(satisfiesCaretPublished("0.5.0", "^0.4.0")).toBe(false);
    expect(satisfiesCaretPublished("0.4.9", "^0.4.0")).toBe(true);
    expect(satisfiesCaretPublished("0.0.5", "^0.0.4")).toBe(false);
  });

  it("orders prereleases instead of ignoring their identifiers", () => {
    expect(satisfiesCaretPublished("5.7.0-next.1", "^5.7.0-next.2")).toBe(false);
    expect(satisfiesCaretPublished("5.7.0-next.2", "^5.7.0-next.2")).toBe(true);
    expect(satisfiesCaretPublished("5.7.0-next.10", "^5.7.0-next.2")).toBe(true);
    expect(satisfiesCaretPublished("5.7.0", "^5.7.0-next.2")).toBe(true);
    expect(satisfiesCaretPublished("5.7.1-next.1", "^5.7.0-next.2")).toBe(false);
    expect(satisfiesCaretPublished("5.8.0", "^5.7.0-next.2")).toBe(true);
  });

  it("returns null for malformed ranges or versions", () => {
    expect(satisfiesCaretPublished("5.7.0", "5.7.0")).toBe(null);
    expect(satisfiesCaretPublished("not-semver", "^5.7.0")).toBe(null);
    expect(satisfiesCaretPublished("5.7", "^5.7.0")).toBe(null);
  });
});

describe("checkScaffoldPinPublished", () => {
  it("passes when a published version satisfies the internal pin", async () => {
    const result = await checkScaffoldPinPublished({
      scaffoldSrc: SCAFFOLD_SRC,
      fetchPackument: stubRegistry({
        "@takazudo/zudo-doc": packument("5.6.1", "5.7.0"),
        "@takazudo/zudo-doc-history-server": packument("5.7.1"),
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([
      expect.objectContaining({
        kind: "ok",
        pkg: "@takazudo/zudo-doc",
        pin: "^5.7.0",
        publishedVersion: "5.7.0",
      }),
      expect.objectContaining({
        kind: "ok",
        pkg: "@takazudo/zudo-doc-history-server",
        publishedVersion: "5.7.1",
      }),
    ]);
  });

  it("fails unsatisfied when the pin is ahead of the registry", async () => {
    const result = await checkScaffoldPinPublished({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zudo-doc"],
      fetchPackument: stubRegistry({
        "@takazudo/zudo-doc": packument("5.6.0"),
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toEqual(
      expect.objectContaining({ kind: "unsatisfied", pkg: "@takazudo/zudo-doc" }),
    );
  });

  it("fails closed with a distinct lookup-error on registry failure", async () => {
    const result = await checkScaffoldPinPublished({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zudo-doc"],
      fetchPackument: stubRegistry({
        "@takazudo/zudo-doc": new Error("network timeout"),
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].kind).toBe("lookup-error");
    expect(result.findings[0].message).toContain("network timeout");
  });

  it("reports malformed and empty versions payloads as lookup-error", async () => {
    for (const payload of [{}, { versions: {} }, { versions: null }, { versions: [] }]) {
      const result = await checkScaffoldPinPublished({
        scaffoldSrc: SCAFFOLD_SRC,
        packages: ["@takazudo/zudo-doc"],
        fetchPackument: stubRegistry({ "@takazudo/zudo-doc": payload }),
      });
      expect(result.ok).toBe(false);
      expect(result.findings[0].kind).toBe("lookup-error");
    }
  });

  it("checks both internal pins and handles an unreadable pin", async () => {
    const result = await checkScaffoldPinPublished({
      scaffoldSrc: SCAFFOLD_SRC,
      packages: ["@takazudo/zudo-doc", "@takazudo/missing"],
      fetchPackument: stubRegistry({
        "@takazudo/zudo-doc": packument("5.7.0"),
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.findings.map(({ kind }) => kind)).toEqual([
      "ok",
      "unreadable-pin",
    ]);
  });

  it("reports an invalid pin range as unreadable-pin without looking it up", async () => {
    const fetchPackument = async () => {
      throw new Error("must not look up an invalid pin");
    };
    const result = await checkScaffoldPinPublished({
      scaffoldSrc: `const deps = { "@takazudo/zudo-doc": "5.7.0" };`,
      packages: ["@takazudo/zudo-doc"],
      fetchPackument,
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toEqual(
      expect.objectContaining({ kind: "unreadable-pin", pin: "5.7.0" }),
    );
  });

  it("does not accept a prerelease below the pin floor", async () => {
    const result = await checkScaffoldPinPublished({
      scaffoldSrc: PRERELEASE_SCAFFOLD_SRC,
      packages: ["@takazudo/zudo-doc"],
      fetchPackument: stubRegistry({
        "@takazudo/zudo-doc": packument("5.7.0-next.1"),
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].kind).toBe("unsatisfied");
  });
});

describe("module exports", () => {
  it("exposes a bounded default timeout", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });
});
