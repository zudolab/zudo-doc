import { describe, expect, it } from "vitest";
import {
  escapeMarkdownTableCell,
  renderCodeFence,
} from "../markdown-structure.js";

describe("renderCodeFence", () => {
  it("uses a minimum triple-backtick fence", () => {
    expect(renderCodeFence("const value = 1;", "typescript")).toBe(
      "```typescript\nconst value = 1;\n```",
    );
  });

  it("uses a fence longer than backtick runs in raw instructions and commands", () => {
    const source = [
      "developer_instructions = '''",
      "```ts",
      "const view = <Foo>{value}</Foo>;",
      "```",
      "command = `run | verify`",
    ].join("\n");
    const rendered = renderCodeFence(source, "toml");

    expect(rendered.startsWith("````toml\n")).toBe(true);
    expect(rendered.endsWith("\n````")).toBe(true);
    expect(rendered).toContain("```ts");
  });

  it("outgrows arbitrary longer runs", () => {
    expect(renderCodeFence("before ````` after").startsWith("``````\n")).toBe(
      true,
    );
  });
});

describe("escapeMarkdownTableCell", () => {
  it("renders empty values as an em dash", () => {
    expect(escapeMarkdownTableCell(undefined)).toBe("—");
    expect(escapeMarkdownTableCell("")).toBe("—");
  });

  it("escapes pipes and collapses newlines in hook and rule values", () => {
    expect(escapeMarkdownTableCell("allow | prompt\njustify { <Foo> }")).toBe(
      "`allow \\| prompt justify { <Foo> }`",
    );
  });

  it("chooses a delimiter longer than runs in config values", () => {
    expect(escapeMarkdownTableCell("use `one` and ``two``")).toBe(
      "``` use `one` and ``two`` ```",
    );
  });

  it("pads values that start or end with a backtick", () => {
    expect(escapeMarkdownTableCell("`literal`")).toBe("`` `literal` ``");
  });
});
