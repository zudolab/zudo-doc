import { describe, expect, it } from "vitest";

import { AUTHORING_GUIDE } from "../authoring-guide";

describe("AUTHORING_GUIDE", () => {
  it("teaches the frontmatter contract, heading rule, admonitions and slugs", () => {
    expect(AUTHORING_GUIDE).toContain("`title` (required)");
    expect(AUTHORING_GUIDE).toContain("h2, never h1");
    expect(AUTHORING_GUIDE).toContain(":::note[");
    expect(AUTHORING_GUIDE).toContain("is NOT supported");
    expect(AUTHORING_GUIDE).toContain("kebab-case");
  });

  it("never uses the retired-platform marker strings tracked by the repo's compatibility contract", () => {
    // Reconstructed from split fragments so this file's own raw text never
    // reproduces the tracked markers (scripts/compatibility-deletion-matrix.ts
    // scans for a contiguous literal match, not the joined runtime value).
    const trackedMarkerFragments: readonly (readonly string[])[] = [
      ["SKIP_", "DOC_HISTORY"],
      ["--", "follow"],
      [".", "shiki"],
      ["./integrations", "/changelog"],
      ["zudo-doc-tweak-state-", "v2"],
      ["zudo-doc-tweak-state-", "v3"],
    ];
    for (const fragments of trackedMarkerFragments) {
      expect(AUTHORING_GUIDE).not.toContain(fragments.join(""));
    }
  });
});
