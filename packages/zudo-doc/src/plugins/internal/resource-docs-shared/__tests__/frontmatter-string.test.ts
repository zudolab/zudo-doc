import { describe, expect, it } from "vitest";
import { format } from "@takazudo/mdx-formatter";
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

  it("matches mdx-formatter's quote policy for otherwise-valid plain scalars", () => {
    expect(formatFrontmatterString("Claude's Code")).toBe('"Claude\'s Code"');
    expect(formatFrontmatterString('Use a "quoted" value')).toBe(
      '"Use a \\"quoted\\" value"',
    );
    expect(formatFrontmatterString("-not-a-list")).toBe('"-not-a-list"');
    expect(formatFrontmatterString("?not-a-key")).toBe('"?not-a-key"');
    expect(formatFrontmatterString(":not-a-key")).toBe('":not-a-key"');
    expect(formatFrontmatterString("YES")).toBe('"YES"');
    expect(formatFrontmatterString("OFF")).toBe('"OFF"');
    expect(formatFrontmatterString("NaN")).toBe('"NaN"');
    expect(formatFrontmatterString("Infinity")).toBe('"Infinity"');
  });

  it("keeps legacy YAML scalar names stable in the real formatter", async () => {
    for (const value of ["yes", "YES", "no", "OFF", "NaN", "Infinity"]) {
      const source = `---\ntitle: ${formatFrontmatterString(value)}\n---\n\nBody\n`;
      expect(await format(source), value).toBe(source);
    }
  });
});
