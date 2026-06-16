import { describe, it, expect } from "vitest";
import { stripImportsAndJsx } from "../strip.js";

describe("stripImportsAndJsx JSX comment removal (zudo-doc#2175)", () => {
  it("removes a single-line JSX/MDX block comment", () => {
    const out = stripImportsAndJsx("{/* internal note */}\n\nReal body.");
    expect(out).not.toContain("{/*");
    expect(out).not.toContain("internal note");
    expect(out).toContain("Real body.");
  });

  it("removes a multi-line JSX/MDX block comment at any position", () => {
    const input = [
      "## Heading",
      "",
      "{/* a comment",
      "spanning multiple",
      "lines */}",
      "",
      "Trailing prose.",
    ].join("\n");
    const out = stripImportsAndJsx(input);
    expect(out).not.toContain("{/*");
    expect(out).not.toContain("*/}");
    expect(out).not.toContain("spanning multiple");
    expect(out).toContain("## Heading");
    expect(out).toContain("Trailing prose.");
  });

  it("removes a bare comment entirely (it previously leaked whole into the body)", () => {
    const out = stripImportsAndJsx("{/* The EN /docs/x index does NOT exist */}");
    expect(out).toBe("");
  });
});
