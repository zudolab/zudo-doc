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

  it("never uses the banned compatibility-contract literals", () => {
    for (const banned of [
      "SKIP_DOC_HISTORY",
      "--follow",
      ".shiki",
      "./integrations/changelog",
      "zudo-doc-tweak-state-v2",
      "zudo-doc-tweak-state-v3",
    ]) {
      expect(AUTHORING_GUIDE).not.toContain(banned);
    }
  });
});
