import { describe, expect, it } from "vitest";

import {
  parsePageFile,
  serializePageFile,
} from "../store/frontmatter";

describe("serializePageFile", () => {
  it("emits the fields in a fixed order so equal content is byte-equal", () => {
    const a = serializePageFile(
      { title: "Install", description: "How", draft: true },
      "Body.\n",
    );
    const b = serializePageFile(
      { draft: true, description: "How", title: "Install" },
      "Body.\n",
    );
    expect(a).toBe(b);
    expect(a).toBe('---\ntitle: "Install"\ndescription: "How"\ndraft: true\n---\n\nBody.\n');
  });

  it("omits optional fields that are absent", () => {
    expect(serializePageFile({ title: "Only" }, "x")).toBe('---\ntitle: "Only"\n---\n\nx');
  });

  it("writes an empty body without a trailing blank line", () => {
    expect(serializePageFile({ title: "Empty" }, "")).toBe('---\ntitle: "Empty"\n---\n');
  });
});

describe("parsePageFile", () => {
  it("round-trips every supported field", () => {
    const file = serializePageFile(
      { title: "Getting started", description: "Intro", draft: false },
      "## Heading\n\nText.\n",
    );
    const parsed = parsePageFile(file);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.frontmatter).toEqual({
      title: "Getting started",
      description: "Intro",
      draft: false,
    });
    expect(parsed.value.markdown).toBe("## Heading\n\nText.\n");
  });

  it("round-trips values that would break a naive YAML writer", () => {
    const nasty = 'He said "yes": 100% — line\nbreak\tand a \\ backslash';
    const parsed = parsePageFile(serializePageFile({ title: nasty }, "body"));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.frontmatter.title).toBe(nasty);
  });

  it("reads plain and single-quoted scalars a human would hand-write", () => {
    const parsed = parsePageFile(
      "---\ntitle: Plain title\ndescription: 'It''s quoted'\ndraft: true\n---\nbody\n",
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.frontmatter).toEqual({
      title: "Plain title",
      description: "It's quoted",
      draft: true,
    });
  });

  it("ignores blank lines and comments inside the block", () => {
    const parsed = parsePageFile("---\n# a comment\n\ntitle: Kept\n---\nbody");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.frontmatter.title).toBe("Kept");
  });

  it.each([
    ["no frontmatter block", "just markdown\n"],
    ["unterminated block", "---\ntitle: X\nstill going\n"],
    ["missing title", "---\ndraft: true\n---\nbody"],
    ["empty title", '---\ntitle: ""\n---\nbody'],
    ["unknown key", "---\ntitle: X\ntags: a\n---\nbody"],
    ["non-boolean draft", "---\ntitle: X\ndraft: yes\n---\nbody"],
    ["unsupported YAML value", "---\ntitle: |\n---\nbody"],
    ["line without a colon", "---\ntitle: X\nbroken\n---\nbody"],
  ])("rejects %s", (_label, raw) => {
    const parsed = parsePageFile(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem.length).toBeGreaterThan(0);
  });

  it("tolerates CRLF line endings and a BOM", () => {
    const parsed = parsePageFile('﻿---\r\ntitle: "CRLF"\r\n---\r\nbody\r\n');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.frontmatter.title).toBe("CRLF");
    expect(parsed.value.markdown).toBe("body\n");
  });
});
