import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseAllowlist,
  partitionFallbacks,
} from "../check-content-fallback.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("parseAllowlist", () => {
  it("keeps bare entries and drops comments and blank lines", () => {
    expect(
      parseAllowlist(
        ["# a comment", "", "docs/foo/", "  docs/bar/  ", "# reason: why"].join(
          "\n",
        ),
      ),
    ).toEqual(["docs/foo/", "docs/bar/"]);
  });

  it("returns nothing for a comment-only file", () => {
    expect(parseAllowlist("# only\n# comments\n")).toEqual([]);
  });
});

describe("partitionFallbacks", () => {
  it("fails a page that matches no allowlist entry", () => {
    const { exempt, offenders } = partitionFallbacks(
      ["docs/reference/design-token-panel/index.html"],
      ["docs/claude-skills/"],
    );
    expect(offenders).toEqual(["docs/reference/design-token-panel/index.html"]);
    expect(exempt).toEqual([]);
  });

  it("exempts every locale of an allowlisted route from one entry", () => {
    const { exempt, offenders } = partitionFallbacks(
      [
        "docs/claude-skills/x/index.html",
        "ja/docs/claude-skills/x/index.html",
      ],
      ["docs/claude-skills/"],
    );
    expect(exempt).toHaveLength(2);
    expect(offenders).toEqual([]);
  });

  it("treats an empty allowlist as exempting nothing", () => {
    const { exempt, offenders } = partitionFallbacks(["docs/a/index.html"], []);
    expect(exempt).toEqual([]);
    expect(offenders).toEqual(["docs/a/index.html"]);
  });
});

describe(".content-fallback-allowlist", () => {
  // Guards against the allowlist quietly growing into a place where real
  // shipped regressions get parked instead of fixed (#3134).
  it("only exempts the locally-generated claude-skills routes", () => {
    const entries = parseAllowlist(
      readFileSync(resolve(ROOT, ".content-fallback-allowlist"), "utf8"),
    );
    expect(entries).toEqual(["docs/claude-skills/"]);
  });
});
