import { describe, expect, it } from "vitest";

import { KNOWN_DIRECTIVES, lintMarkdown } from "../authoring-lint";

describe("lintMarkdown", () => {
  it("says nothing about a well-formed page", () => {
    expect(
      lintMarkdown("Intro prose.\n\n## Section\n\n:::note[Heads up]\nBody.\n:::\n"),
    ).toEqual([]);
  });

  it("flags an h1 in the body, with its line", () => {
    const warnings = lintMarkdown("Intro.\n\n# Not allowed\n");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe("h1-in-body");
    expect(warnings[0]?.line).toBe(3);
  });

  it("does not mistake h2 or a hash inside a word for an h1", () => {
    expect(lintMarkdown("## Fine\n\nIssue #123 and C# too.\n")).toEqual([]);
  });

  it("ignores headings and directives inside fenced code", () => {
    const markdown = [
      "Example:",
      "",
      "```md",
      "# This is sample content",
      ":::nope",
      "```",
      "",
      "Done.",
    ].join("\n");
    expect(lintMarkdown(markdown)).toEqual([]);
  });

  it("closes a fence only on a matching marker", () => {
    const markdown = ["~~~md", "```", "# still inside", "~~~", "# outside"].join("\n");
    const warnings = lintMarkdown(markdown);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.line).toBe(5);
  });

  it("flags an unknown directive and names the supported ones", () => {
    const warnings = lintMarkdown(":::caution\nok\n:::\n\n:::sidebar\nnope\n:::\n");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe("unknown-directive");
    expect(warnings[0]?.line).toBe(5);
    for (const directive of KNOWN_DIRECTIVES) {
      expect(warnings[0]?.message).toContain(directive);
    }
  });

  it("accepts every known directive", () => {
    for (const directive of KNOWN_DIRECTIVES) {
      expect(lintMarkdown(`:::${directive}\nbody\n:::\n`)).toEqual([]);
    }
  });

  it("flags the brace form of a directive title", () => {
    const warnings = lintMarkdown(':::note{title="Heads up"}\nbody\n:::\n');
    expect(warnings.map((warning) => warning.code)).toEqual(["brace-admonition-title"]);
    expect(warnings[0]?.message).toContain(":::note[Title]");
  });

  it("reports both problems when a directive is unknown and brace-titled", () => {
    const warnings = lintMarkdown(':::sidebar{title="X"}\nbody\n:::\n');
    expect(warnings.map((warning) => warning.code)).toEqual([
      "unknown-directive",
      "brace-admonition-title",
    ]);
  });
});
