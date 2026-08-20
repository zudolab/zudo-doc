import { describe, expect, it } from "vitest";
import { formatFrontmatterString } from "../mdx.js";

describe("formatFrontmatterString", () => {
  it("uses formatter-stable plain scalars when YAML can represent them safely", () => {
    expect(formatFrontmatterString("Codex")).toBe("Codex");
    expect(formatFrontmatterString("OpenAI Codex configuration reference.")).toBe(
      "OpenAI Codex configuration reference.",
    );
    expect(formatFrontmatterString("/AGENTS.md")).toBe("/AGENTS.md");
    expect(
      formatFrontmatterString(
        "Reviews documentation for accuracy, clarity, and completeness.",
      ),
    ).toBe("Reviews documentation for accuracy, clarity, and completeness.");
  });

  it("retains quotes when plain YAML would change the value", () => {
    expect(formatFrontmatterString("")).toBe('""');
    expect(formatFrontmatterString("true")).toBe('"true"');
    expect(formatFrontmatterString("123")).toBe('"123"');
    expect(formatFrontmatterString("Use when: a command runs")).toBe(
      '"Use when: a command runs"',
    );
  });
});
