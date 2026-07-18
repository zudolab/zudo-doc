// deriveSourceExt — manifest `ext` derivation for the view-source URL.
//
// The content walkers (`collectContentFiles` in
// @takazudo/zudo-doc-history-server) accept both .md and .mdx, but the
// doc-history area historically hardcoded ".mdx" when
// composing the GitHub view-source URL — producing broken links for .md
// pages. The preBuild manifest records each tracked file's real extension via
// deriveSourceExt; no-meta pages receive the current entry's extension through
// a separate explicit path.

import { describe, it, expect } from "vitest";
import { deriveSourceExt } from "../pre-build.js";

describe("deriveSourceExt", () => {
  it("returns .md for .md files", () => {
    expect(deriveSourceExt("/repo/src/content/docs/notes.md")).toBe(".md");
  });

  it("returns .mdx for .mdx files", () => {
    expect(deriveSourceExt("/repo/src/content/docs/intro.mdx")).toBe(".mdx");
  });

  it("does not confuse .mdx with the .md suffix check", () => {
    // ".mdx".endsWith(".md") is false — ordering of the check matters.
    expect(deriveSourceExt("guides/getting-started/index.mdx")).toBe(".mdx");
  });

  it("handles dotted directory names before the file extension", () => {
    expect(deriveSourceExt("/repo/src/content/docs-v1.0/page.md")).toBe(".md");
    expect(deriveSourceExt("/repo/src/content/docs-v1.0/page.mdx")).toBe(".mdx");
  });

  it("handles a .md basename that contains 'mdx' in the name", () => {
    expect(deriveSourceExt("docs/about-mdx.md")).toBe(".md");
  });
});
